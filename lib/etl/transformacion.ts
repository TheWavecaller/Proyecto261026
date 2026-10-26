import type { FilaTransformada } from "./tipos"

const HORA_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

/**
 * Open-Meteo devuelve las horas sin zona ("2026-09-01T00:00"). Como la petición se hace con
 * timezone=GMT, las interpretamos explícitamente como UTC en lugar de dejar que el navegador
 * aplique su zona local. Devuelve null si el texto no es una fecha y hora real.
 */
export function interpretarHoraUtc(valor: unknown): string | null {
  if (typeof valor !== "string") return null
  const m = HORA_RE.exec(valor)
  if (!m) return null
  const [, a, mes, d, h, min, s = "00"] = m
  const ms = Date.UTC(+a, +mes - 1, +d, +h, +min, +s)
  const fecha = new Date(ms)
  // Date.UTC desborda fechas imposibles (31 de septiembre → 1 de octubre): las rechazamos.
  if (
    fecha.getUTCFullYear() !== +a ||
    fecha.getUTCMonth() !== +mes - 1 ||
    fecha.getUTCDate() !== +d ||
    fecha.getUTCHours() !== +h ||
    fecha.getUTCMinutes() !== +min
  ) {
    return null
  }
  return fecha.toISOString()
}

const VARIABLES = {
  temperatura_c: { clave: "temperature_2m", unidad: "°C" },
  humedad_pct: { clave: "relative_humidity_2m", unidad: "%" },
  precipitacion_mm: { clave: "precipitation", unidad: "mm" },
} as const

export interface ResultadoTransformacion {
  filas: FilaTransformada[]
  /** Problemas estructurales de la respuesta (longitudes, variables ausentes, unidades). */
  avisos: string[]
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

/**
 * Convierte los arrays paralelos de `hourly` en un registro por hora. No corrige ni descarta
 * nada: los valores se copian sin conversión para que la fase de limpieza decida.
 */
export function transformarRespuesta(ciudad: string, json: unknown): ResultadoTransformacion {
  const avisos: string[] = []
  const hourly = esObjeto(json) ? json.hourly : undefined
  if (!esObjeto(hourly)) {
    return { filas: [], avisos: [`${ciudad}: la respuesta no contiene el objeto "hourly".`] }
  }

  const unidades = esObjeto(json) && esObjeto(json.hourly_units) ? json.hourly_units : {}
  const tiempos = Array.isArray(hourly.time) ? hourly.time : []
  if (!Array.isArray(hourly.time)) avisos.push(`${ciudad}: falta el array "hourly.time".`)

  const columnas = {} as Record<keyof typeof VARIABLES, unknown[]>
  for (const [campo, { clave, unidad }] of Object.entries(VARIABLES) as [
    keyof typeof VARIABLES,
    (typeof VARIABLES)[keyof typeof VARIABLES],
  ][]) {
    const valores = hourly[clave]
    if (!Array.isArray(valores)) {
      avisos.push(`${ciudad}: falta el array "hourly.${clave}".`)
      columnas[campo] = []
      continue
    }
    if (valores.length !== tiempos.length) {
      avisos.push(
        `${ciudad}: "hourly.${clave}" tiene ${valores.length} valores y "hourly.time" ${tiempos.length}.`
      )
    }
    if (unidades[clave] !== undefined && unidades[clave] !== unidad) {
      avisos.push(`${ciudad}: unidad inesperada para ${clave}: ${String(unidades[clave])}.`)
    }
    columnas[campo] = valores
  }

  // Recorremos la longitud máxima para no perder en silencio valores sobrantes:
  // las posiciones sin pareja quedan como ausentes y se rechazarán en la limpieza.
  const n = Math.max(tiempos.length, ...Object.values(columnas).map((c) => c.length))
  const filas: FilaTransformada[] = []
  for (let i = 0; i < n; i++) {
    filas.push({
      indice: i,
      ciudad,
      hora_original: tiempos[i],
      fecha_hora: interpretarHoraUtc(tiempos[i]),
      temperatura_c: columnas.temperatura_c[i],
      humedad_pct: columnas.humedad_pct[i],
      precipitacion_mm: columnas.precipitacion_mm[i],
    })
  }
  return { filas, avisos }
}
