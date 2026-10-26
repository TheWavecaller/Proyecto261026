import type { FilaTransformada, Medicion, Rechazo } from "./tipos"
import { formatearFechaUtc } from "./formato"

export const NOMBRES_MEDIDAS = {
  temperatura_c: "Temperatura",
  humedad_pct: "Humedad",
  precipitacion_mm: "Precipitación",
} as const

/** Devuelve el problema del valor o null si es un número finito. Nunca convierte null en 0. */
export function problemaNumerico(valor: unknown): string | null {
  if (valor === undefined) return "valor ausente"
  if (valor === null) return "valor nulo"
  if (valor === "") return "cadena vacía"
  if (typeof valor !== "number") return `tipo no numérico (${typeof valor})`
  if (!Number.isFinite(valor)) return "valor no finito"
  return null
}

/** Reglas de calidad compartidas por la limpieza del navegador y la validación del servidor. */
export function motivosDeCalidad(r: {
  ciudad: unknown
  fecha_hora: unknown
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}): string[] {
  const motivos: string[] = []
  if (typeof r.ciudad !== "string" || r.ciudad.trim() === "") motivos.push("Sin ciudad")
  if (typeof r.fecha_hora !== "string" || r.fecha_hora === "") {
    motivos.push("Sin fecha y hora válida")
  }

  for (const campo of Object.keys(NOMBRES_MEDIDAS) as (keyof typeof NOMBRES_MEDIDAS)[]) {
    const problema = problemaNumerico(r[campo])
    if (problema) motivos.push(`${NOMBRES_MEDIDAS[campo]}: ${problema}`)
  }

  const h = r.humedad_pct
  if (typeof h === "number" && Number.isFinite(h) && (h < 0 || h > 100)) {
    motivos.push(`Humedad fuera de [0, 100] %: ${h}`)
  }
  const p = r.precipitacion_mm
  if (typeof p === "number" && Number.isFinite(p) && p < 0) {
    motivos.push(`Precipitación negativa: ${p} mm`)
  }
  return motivos
}

export function claveMedicion(m: { ciudad: string; fecha_hora: string }): string {
  return `${m.ciudad}|${m.fecha_hora}`
}

export interface ResultadoLimpieza {
  validos: Medicion[]
  rechazados: Rechazo[]
}

/**
 * Valida cada fila y elimina duplicados por (ciudad, fecha_hora).
 * Criterio de duplicados: se conserva la PRIMERA aparición válida en el orden de extracción
 * (orden de ciudades y, dentro de cada una, orden de la respuesta). Las repeticiones
 * posteriores se rechazan indicando qué fila se conservó. Las filas con errores de calidad no
 * participan en la deduplicación, para que una fila defectuosa no desplace a una correcta.
 */
export function limpiarFilas(filas: readonly FilaTransformada[]): ResultadoLimpieza {
  const validos: Medicion[] = []
  const rechazados: Rechazo[] = []
  const vistos = new Map<string, FilaTransformada>()

  for (const fila of filas) {
    const motivos = motivosDeCalidad(fila)
    if (fila.fecha_hora === null && fila.hora_original !== undefined) {
      // Detallamos el texto original para que se vea por qué no se pudo interpretar.
      motivos.splice(
        motivos.indexOf("Sin fecha y hora válida"),
        1,
        `Fecha y hora no válida: ${JSON.stringify(fila.hora_original)}`
      )
    }
    if (motivos.length > 0) {
      rechazados.push({ fila, tipo: "calidad", motivos })
      continue
    }

    const medicion: Medicion = {
      ciudad: fila.ciudad,
      fecha_hora: fila.fecha_hora as string,
      temperatura_c: fila.temperatura_c as number,
      humedad_pct: fila.humedad_pct as number,
      precipitacion_mm: fila.precipitacion_mm as number,
    }
    const clave = claveMedicion(medicion)
    const conservada = vistos.get(clave)
    if (conservada) {
      rechazados.push({
        fila,
        tipo: "duplicado",
        motivos: [
          `Duplicado de ${fila.ciudad} · ${formatearFechaUtc(medicion.fecha_hora)}: se conserva la primera aparición (posición ${conservada.indice} de la respuesta)`,
        ],
      })
      continue
    }
    vistos.set(clave, fila)
    validos.push(medicion)
  }

  return { validos, rechazados }
}
