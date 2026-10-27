import type { Ciudad } from "./ciudades"

export const ARCHIVE_API_URL = "https://archive-api.open-meteo.com/v1/archive"
export const VARIABLES_HORARIAS = [
  "temperature_2m",
  "relative_humidity_2m",
  "precipitation",
] as const
export const MAX_DIAS = 365
/** Primer día disponible en el archivo histórico de Open-Meteo (ERA5). */
export const FECHA_MINIMA = "1940-01-01"

const DIA_MS = 24 * 60 * 60 * 1000
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

export function construirUrlArchivo(ciudad: Ciudad, inicio: string, fin: string): string {
  const params = new URLSearchParams({
    latitude: String(ciudad.latitud),
    longitude: String(ciudad.longitud),
    start_date: inicio,
    end_date: fin,
    hourly: VARIABLES_HORARIAS.join(","),
    timezone: "GMT",
    temperature_unit: "celsius",
    precipitation_unit: "mm",
    timeformat: "iso8601",
  })
  return `${ARCHIVE_API_URL}?${params}`
}

function parsearFecha(valor: string): number | null {
  if (!FECHA_RE.test(valor)) return null
  const ms = Date.parse(`${valor}T00:00:00Z`)
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== valor) return null
  return ms
}

/** Número de días del intervalo, ambos extremos incluidos. */
export function diasEntre(inicio: string, fin: string): number {
  const a = parsearFecha(inicio)
  const b = parsearFecha(fin)
  if (a === null || b === null) return 0
  return Math.round((b - a) / DIA_MS) + 1
}

export interface ValidacionExtraccion {
  errores: string[]
  avisos: string[]
}

export function validarExtraccion(
  ciudades: readonly string[],
  inicio: string,
  fin: string,
  hoy: Date = new Date()
): ValidacionExtraccion {
  const errores: string[] = []
  const avisos: string[] = []

  if (ciudades.length === 0) errores.push("Selecciona al menos una ciudad.")

  const a = parsearFecha(inicio)
  const b = parsearFecha(fin)
  if (a === null) errores.push("La fecha inicial no es válida (formato AAAA-MM-DD).")
  if (b === null) errores.push("La fecha final no es válida (formato AAAA-MM-DD).")

  if (a !== null && b !== null) {
    const hoyUtc = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate())
    if (a < Date.parse(`${FECHA_MINIMA}T00:00:00Z`)) {
      errores.push(`El archivo histórico empieza el ${FECHA_MINIMA}.`)
    }
    if (a > b) errores.push("La fecha inicial debe ser anterior o igual a la final.")
    else if (diasEntre(inicio, fin) > MAX_DIAS) {
      errores.push(
        `El periodo tiene ${diasEntre(inicio, fin)} días; el máximo por extracción es ${MAX_DIAS}.`
      )
    }
    if (b > hoyUtc) errores.push("La fecha final no puede ser posterior a hoy (datos históricos).")
    else if (b > hoyUtc - 5 * DIA_MS) {
      avisos.push(
        "Los últimos días pueden llegar incompletos (null): el archivo se actualiza con unos días de retraso."
      )
    }
  }

  return { errores, avisos }
}

export interface RespuestaError {
  error: true
  reason: string
}

/** Descarga la respuesta de una ciudad. Lanza un Error con mensaje legible si falla. */
export async function descargarCiudad(
  ciudad: Ciudad,
  inicio: string,
  fin: string,
  signal?: AbortSignal
): Promise<unknown> {
  const url = construirUrlArchivo(ciudad, inicio, fin)
  let res: Response
  try {
    res = await fetch(url, { signal, cache: "no-store" })
  } catch (e) {
    throw new Error(`Error de red al contactar con Open-Meteo: ${(e as Error).message}`)
  }
  let cuerpo: unknown
  try {
    cuerpo = await res.json()
  } catch {
    throw new Error(`Respuesta no válida de Open-Meteo (HTTP ${res.status}).`)
  }
  if (!res.ok || (cuerpo as RespuestaError)?.error) {
    const motivo = (cuerpo as RespuestaError)?.reason ?? res.statusText
    throw new Error(`Open-Meteo respondió HTTP ${res.status}: ${motivo}`)
  }
  return cuerpo
}
