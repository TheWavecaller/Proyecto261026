/** "2026-09-01T00:00:00.000Z" → "2026-09-01 00:00 UTC" sin depender de la zona del navegador. */
export function formatearFechaUtc(iso: string | null | undefined): string {
  if (!iso) return "—"
  const ms = Date.parse(iso)
  if (Number.isNaN(ms)) return String(iso)
  return `${new Date(ms).toISOString().slice(0, 16).replace("T", " ")} UTC`
}

/** Representa un valor crudo sin ocultar null, ausentes ni cadenas. */
export function formatearCrudo(valor: unknown): string {
  if (valor === undefined) return "(ausente)"
  if (valor === null) return "null"
  if (typeof valor === "string") return JSON.stringify(valor)
  return String(valor)
}

export function formatearDuracion(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—"
  if (ms < 1) return "< 1 ms"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

const numero = new Intl.NumberFormat("es-ES")
export function formatearNumero(n: number): string {
  return numero.format(n)
}

/** Huella FNV-1a de 32 bits, suficiente para comprobar que dos listas son idénticas. */
export function huella(texto: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}
