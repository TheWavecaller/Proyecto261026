import { huella } from "./formato"
import { claveMedicion, motivosDeCalidad } from "./limpieza"
import { NOMBRES_CIUDADES } from "./ciudades"
import type { Medicion } from "./tipos"

export const TAMANO_LOTE = 500
/** Margen holgado: 500 registros ocupan unos 70 KB en JSON. */
export const MAX_BYTES_PETICION = 256 * 1024

export function trocear<T>(filas: readonly T[], tamano = TAMANO_LOTE): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < filas.length; i += tamano) lotes.push(filas.slice(i, i + tamano))
  return lotes
}

/** Serialización canónica para calcular la huella de un conjunto ordenado de registros. */
export function huellaMediciones(filas: readonly Medicion[]): string {
  return huella(
    JSON.stringify(
      filas.map((m) => [m.ciudad, m.fecha_hora, m.temperatura_c, m.humedad_pct, m.precipitacion_mm])
    )
  )
}

const ISO_UTC_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/
const CAMPOS = ["ciudad", "fecha_hora", "temperatura_c", "humedad_pct", "precipitacion_mm"]

/** Validación del servidor: no confía en la limpieza del navegador. */
export function validarRegistrosRecibidos(
  cuerpo: unknown,
  max = TAMANO_LOTE
): { registros: Medicion[]; errores: [] } | { registros: null; errores: string[] } {
  const lista = (cuerpo as { registros?: unknown })?.registros
  if (!Array.isArray(lista)) return { registros: null, errores: ['Falta el array "registros".'] }
  if (lista.length === 0) return { registros: null, errores: ["El lote está vacío."] }
  if (lista.length > max) {
    return { registros: null, errores: [`El lote tiene ${lista.length} registros; máximo ${max}.`] }
  }

  const errores: string[] = []
  const registros: Medicion[] = []
  const claves = new Set<string>()
  lista.forEach((r: unknown, i) => {
    if (typeof r !== "object" || r === null) {
      errores.push(`Registro ${i}: no es un objeto.`)
      return
    }
    const o = r as Record<string, unknown>
    const sobrantes = Object.keys(o).filter((k) => !CAMPOS.includes(k))
    const motivos = motivosDeCalidad(o as Parameters<typeof motivosDeCalidad>[0])
    if (sobrantes.length) motivos.push(`campos no permitidos: ${sobrantes.join(", ")}`)
    if (typeof o.ciudad === "string" && !NOMBRES_CIUDADES.has(o.ciudad)) {
      motivos.push(`ciudad desconocida: ${o.ciudad}`)
    }
    if (
      typeof o.fecha_hora === "string" &&
      (!ISO_UTC_RE.test(o.fecha_hora) || Number.isNaN(Date.parse(o.fecha_hora)))
    ) {
      motivos.push("fecha_hora debe ser ISO 8601 en UTC (terminada en Z)")
    }
    if (motivos.length) {
      errores.push(`Registro ${i}: ${motivos.join("; ")}`)
      return
    }
    const m = o as unknown as Medicion
    const clave = claveMedicion({ ciudad: m.ciudad, fecha_hora: new Date(m.fecha_hora).toISOString() })
    if (claves.has(clave)) {
      errores.push(`Registro ${i}: clave (ciudad, fecha_hora) repetida dentro del lote.`)
      return
    }
    claves.add(clave)
    registros.push({
      ciudad: m.ciudad,
      fecha_hora: m.fecha_hora,
      temperatura_c: m.temperatura_c,
      humedad_pct: m.humedad_pct,
      precipitacion_mm: m.precipitacion_mm,
    })
  })

  if (errores.length) return { registros: null, errores }
  return { registros, errores: [] }
}

export type EstadoLote = "pendiente" | "en_curso" | "completado" | "error"

export interface Lote {
  numero: number
  registros: Medicion[]
  estado: EstadoLote
  intentos: number
  error?: string
  /** Filas que Supabase devolvió como afectadas por el upsert (no distingue insertadas/actualizadas). */
  procesados?: number
  /** Huella calculada por el servidor sobre lo que recibió; debe coincidir con la del lote. */
  huellaServidor?: string
  verificacion?: { presentes: number; ausentes: number; error?: string }
}

export type EnviarLote = (
  registros: Medicion[]
) => Promise<{ procesados: number; huella: string }>
export type VerificarLote = (registros: Medicion[]) => Promise<{ presentes: number; ausentes: number }>

/**
 * Ejecuta en serie los lotes indicados (todos los no completados por defecto). Un fallo no
 * detiene los siguientes ni altera los ya completados; después verifica en destino los lotes
 * completados. `alCambiar` recibe una copia nueva tras cada transición de estado.
 */
export async function ejecutarLotes(
  lotes: Lote[],
  enviar: EnviarLote,
  verificar: VerificarLote,
  alCambiar: (lotes: Lote[]) => void
): Promise<Lote[]> {
  let actual = lotes.map((l) => ({ ...l }))
  const fijar = (i: number, cambio: Partial<Lote>) => {
    actual = actual.map((l, j) => (j === i ? { ...l, ...cambio } : l))
    alCambiar(actual)
  }

  for (let i = 0; i < actual.length; i++) {
    if (actual[i].estado === "completado") continue
    fijar(i, { estado: "en_curso", intentos: actual[i].intentos + 1, error: undefined })
    try {
      const r = await enviar(actual[i].registros)
      fijar(i, { estado: "completado", procesados: r.procesados, huellaServidor: r.huella })
    } catch (e) {
      fijar(i, { estado: "error", error: (e as Error).message })
    }
  }

  for (let i = 0; i < actual.length; i++) {
    const v = actual[i].verificacion
    if (actual[i].estado !== "completado" || (v && !v.error && v.ausentes === 0)) continue
    try {
      fijar(i, { verificacion: await verificar(actual[i].registros) })
    } catch (e) {
      fijar(i, { verificacion: { presentes: 0, ausentes: 0, error: (e as Error).message } })
    }
  }
  return actual
}

export function crearLotes(registros: readonly Medicion[]): Lote[] {
  return trocear(registros).map((r, i) => ({
    numero: i + 1,
    registros: r,
    estado: "pendiente",
    intentos: 0,
  }))
}
