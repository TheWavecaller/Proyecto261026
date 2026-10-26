import { claveMedicion, NOMBRES_MEDIDAS } from "./limpieza"
import type { CampoOrden, Medicion, Orden } from "./tipos"

/** Los valores se guardan como texto, tal como están en los campos del formulario. */
export interface Filtros {
  /** Ciudades desmarcadas. Vacío = todas; así una ciudad reintentada aparece incluida. */
  ciudadesExcluidas: string[]
  /** "AAAA-MM-DDTHH:mm" interpretado como UTC. */
  desde: string
  hasta: string
  temperaturaMin: string
  temperaturaMax: string
  humedadMin: string
  humedadMax: string
  precipitacionMin: string
  precipitacionMax: string
  soloLluvia: boolean
}

export const FILTROS_INICIALES: Filtros = {
  ciudadesExcluidas: [],
  desde: "",
  hasta: "",
  temperaturaMin: "",
  temperaturaMax: "",
  humedadMin: "",
  humedadMax: "",
  precipitacionMin: "",
  precipitacionMax: "",
  soloLluvia: false,
}

export const ORDEN_INICIAL: Orden = { campo: "fecha_hora", direccion: "asc" }

interface Criterios {
  excluidas: Set<string>
  desde: number | null
  hasta: number | null
  rangos: { campo: keyof Medicion; min: number | null; max: number | null }[]
  soloLluvia: boolean
}

function numeroOpcional(texto: string, nombre: string, errores: string[]): number | null {
  if (texto.trim() === "") return null
  const n = Number(texto.replace(",", "."))
  if (!Number.isFinite(n)) {
    errores.push(`${nombre}: «${texto}» no es un número.`)
    return null
  }
  return n
}

function fechaOpcional(texto: string, nombre: string, errores: string[]): number | null {
  if (texto === "") return null
  const ms = Date.parse(`${texto.length === 16 ? `${texto}:00` : texto}Z`)
  if (Number.isNaN(ms)) {
    errores.push(`${nombre}: fecha y hora no válida.`)
    return null
  }
  return ms
}

export function interpretarFiltros(f: Filtros): { criterios: Criterios; errores: string[] } {
  const errores: string[] = []
  const criterios: Criterios = {
    excluidas: new Set(f.ciudadesExcluidas),
    desde: fechaOpcional(f.desde, "Desde", errores),
    hasta: fechaOpcional(f.hasta, "Hasta", errores),
    rangos: [
      {
        campo: "temperatura_c",
        min: numeroOpcional(f.temperaturaMin, "Temperatura mínima", errores),
        max: numeroOpcional(f.temperaturaMax, "Temperatura máxima", errores),
      },
      {
        campo: "humedad_pct",
        min: numeroOpcional(f.humedadMin, "Humedad mínima", errores),
        max: numeroOpcional(f.humedadMax, "Humedad máxima", errores),
      },
      {
        campo: "precipitacion_mm",
        min: numeroOpcional(f.precipitacionMin, "Precipitación mínima", errores),
        max: numeroOpcional(f.precipitacionMax, "Precipitación máxima", errores),
      },
    ],
    soloLluvia: f.soloLluvia,
  }
  if (criterios.desde !== null && criterios.hasta !== null && criterios.desde > criterios.hasta) {
    errores.push("El intervalo de fechas está invertido: «Desde» es posterior a «Hasta».")
  }
  for (const r of criterios.rangos) {
    if (r.min !== null && r.max !== null && r.min > r.max) {
      errores.push(
        `${NOMBRES_MEDIDAS[r.campo as keyof typeof NOMBRES_MEDIDAS]}: el mínimo es mayor que el máximo, no coincidirá ningún registro.`
      )
    }
  }
  return { criterios, errores }
}

/** Filtros con límites inclusivos. Un filtro con texto no numérico se ignora (y se avisa). */
export function aplicarFiltros(validos: readonly Medicion[], f: Filtros): Medicion[] {
  const { criterios: c } = interpretarFiltros(f)
  return validos.filter((m) => {
    if (c.excluidas.has(m.ciudad)) return false
    const t = Date.parse(m.fecha_hora)
    if (c.desde !== null && t < c.desde) return false
    if (c.hasta !== null && t > c.hasta) return false
    for (const r of c.rangos) {
      const v = m[r.campo] as number
      if (r.min !== null && v < r.min) return false
      if (r.max !== null && v > r.max) return false
    }
    if (c.soloLluvia && !(m.precipitacion_mm > 0)) return false
    return true
  })
}

function comparar(a: Medicion, b: Medicion, campo: CampoOrden): number {
  if (campo === "ciudad") return a.ciudad.localeCompare(b.ciudad, "es")
  if (campo === "fecha_hora") return Date.parse(a.fecha_hora) - Date.parse(b.fecha_hora)
  return a[campo] - b[campo]
}

/** Ordenación estable con desempate por ciudad y fecha para que la vista previa sea determinista. */
export function ordenar(filas: readonly Medicion[], orden: Orden): Medicion[] {
  const signo = orden.direccion === "asc" ? 1 : -1
  return [...filas].sort(
    (a, b) =>
      signo * comparar(a, b, orden.campo) ||
      comparar(a, b, "ciudad") ||
      comparar(a, b, "fecha_hora")
  )
}

export function paginar<T>(filas: readonly T[], pagina: number, tamano: number): T[] {
  return filas.slice(pagina * tamano, (pagina + 1) * tamano)
}

/** datos válidos → filtros → ordenación. La paginación se aplica solo después, en la vista. */
export function filtrarYOrdenar(validos: readonly Medicion[], f: Filtros, orden: Orden): Medicion[] {
  return ordenar(aplicarFiltros(validos, f), orden)
}

export interface ResumenSeleccion {
  /** Filas seleccionadas que siguen cumpliendo los filtros, en el orden elegido: lo que se sube. */
  paraSubir: Medicion[]
  /** Claves seleccionadas que ya no cumplen los filtros actuales (no se subirán). */
  fueraDeFiltros: number
}

export function resumirSeleccion(
  filtradasOrdenadas: readonly Medicion[],
  seleccion: ReadonlySet<string>
): ResumenSeleccion {
  const paraSubir = filtradasOrdenadas.filter((m) => seleccion.has(claveMedicion(m)))
  return { paraSubir, fueraDeFiltros: seleccion.size - paraSubir.length }
}
