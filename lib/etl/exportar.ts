/** Escapa un valor según RFC 4180. null y ausentes quedan vacíos; los objetos van como JSON. */
function celdaCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return ""
  const texto = typeof valor === "object" ? JSON.stringify(valor) : String(valor)
  return /[",\r\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto
}

/**
 * Convierte filas planas en CSV separado por comas, con cabecera. Si no se indican columnas se
 * usan las claves de la primera fila, en su orden.
 */
export function aCsv(filas: readonly Record<string, unknown>[], columnas?: readonly string[]): string {
  const cabecera = columnas ?? Object.keys(filas[0] ?? {})
  const lineas = [cabecera.map(celdaCsv).join(",")]
  for (const fila of filas) lineas.push(cabecera.map((c) => celdaCsv(fila[c])).join(","))
  return lineas.join("\r\n")
}

export type FormatoExportacion = "csv" | "json"

/** Descarga en el navegador. El CSV lleva BOM para que Excel reconozca UTF-8 (tildes, °). */
export function descargarArchivo(
  nombre: string,
  filas: readonly Record<string, unknown>[],
  formato: FormatoExportacion
) {
  const [contenido, tipo] =
    formato === "csv"
      ? [`﻿${aCsv(filas)}`, "text/csv;charset=utf-8"]
      : [JSON.stringify(filas, null, 2), "application/json"]
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = Object.assign(document.createElement("a"), { href: url, download: `${nombre}.${formato}` })
  a.click()
  URL.revokeObjectURL(url)
}
