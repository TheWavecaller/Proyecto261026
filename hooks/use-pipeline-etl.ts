"use client"

import * as React from "react"

import { CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import {
  crearLotes,
  ejecutarLotes,
  huellaMediciones,
  type Lote,
} from "@/lib/etl/carga"
import { construirUrlArchivo, descargarCiudad } from "@/lib/etl/extraccion"
import {
  filtrarYOrdenar,
  FILTROS_INICIALES,
  ORDEN_INICIAL,
  resumirSeleccion,
  type Filtros,
} from "@/lib/etl/filtros"
import { claveMedicion, limpiarFilas } from "@/lib/etl/limpieza"
import type { EstadoFase, FilaTransformada, Medicion, Orden, Rechazo } from "@/lib/etl/tipos"
import { transformarRespuesta } from "@/lib/etl/transformacion"

export interface EstadoCiudad {
  ciudad: Ciudad
  url: string
  estado: EstadoFase
  intentos: number
  json?: unknown
  error?: string
  duracionMs?: number
}

export interface Extraccion {
  inicio: string
  fin: string
  ciudades: Ciudad[]
  porCiudad: Record<string, EstadoCiudad>
  estado: EstadoFase
  /** Suma del tiempo real de todas las peticiones, incluidos los reintentos. */
  duracionMs: number
}

export interface Procesado {
  respuestas: number
  transformadas: FilaTransformada[]
  avisos: string[]
  duracionTransformacionMs: number
  validos: Medicion[]
  rechazados: Rechazo[]
  duracionLimpiezaMs: number
}

export interface Carga {
  lotes: Lote[]
  total: number
  /** Huella de la vista previa en el momento de pulsar el botón y de la copia congelada. */
  huellaVistaPrevia: string
  huellaCongelada: string
  estado: EstadoFase
  duracionMs: number
}

async function enviarLote(registros: Medicion[]) {
  const res = await fetch("/api/carga", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ registros }),
  })
  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) {
    const extra = cuerpo.errores?.length > 1 ? ` (y ${cuerpo.errores.length - 1} errores más)` : ""
    throw new Error(`HTTP ${res.status}: ${cuerpo.error ?? res.statusText}${extra}`)
  }
  if (cuerpo.huella !== huellaMediciones(registros)) {
    throw new Error("El servidor recibió un contenido distinto del enviado (huella diferente).")
  }
  return { procesados: cuerpo.procesados as number, huella: cuerpo.huella as string }
}

async function verificarLote(registros: Medicion[]) {
  const res = await fetch("/api/verificacion", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      claves: registros.map(({ ciudad, fecha_hora }) => ({ ciudad, fecha_hora })),
    }),
  })
  const cuerpo = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${cuerpo.error ?? res.statusText}`)
  return { presentes: cuerpo.presentes as number, ausentes: cuerpo.ausentes as number }
}

function cronometrar<T>(fn: () => T): readonly [T, number] {
  const t0 = performance.now()
  const resultado = fn()
  return [resultado, performance.now() - t0]
}

function procesar(ext: Extraccion): Procesado {
  const completadas = ext.ciudades
    .map((c) => ext.porCiudad[c.id])
    .filter((e) => e.estado === "completada")

  const t0 = performance.now()
  const transformadas: FilaTransformada[] = []
  const avisos: string[] = []
  for (const e of completadas) {
    const r = transformarRespuesta(e.ciudad.nombre, e.json)
    transformadas.push(...r.filas)
    avisos.push(...r.avisos)
  }
  const t1 = performance.now()
  const { validos, rechazados } = limpiarFilas(transformadas)
  const t2 = performance.now()

  return {
    respuestas: completadas.length,
    transformadas,
    avisos,
    duracionTransformacionMs: t1 - t0,
    validos,
    rechazados,
    duracionLimpiezaMs: t2 - t1,
  }
}

function estadoGlobal(ext: Extraccion): EstadoFase {
  const estados = Object.values(ext.porCiudad).map((e) => e.estado)
  if (estados.some((e) => e === "en_curso" || e === "pendiente")) return "en_curso"
  return estados.some((e) => e === "error") ? "error" : "completada"
}

export function usePipelineEtl() {
  const [extraccion, setExtraccionEstado] = React.useState<Extraccion | null>(null)
  const extraccionRef = React.useRef<Extraccion | null>(null)
  const [procesado, setProcesado] = React.useState<Procesado | null>(null)
  const [filtros, setFiltros] = React.useState<Filtros>(FILTROS_INICIALES)
  const [orden, setOrden] = React.useState<Orden>(ORDEN_INICIAL)
  const [seleccion, setSeleccion] = React.useState<ReadonlySet<string>>(new Set())
  const [carga, setCargaEstado] = React.useState<Carga | null>(null)
  const cargaRef = React.useRef<Carga | null>(null)
  const cargando = React.useRef(false)
  const [versionDestino, setVersionDestino] = React.useState(0)

  const setExtraccion = (e: Extraccion) => {
    extraccionRef.current = e
    setExtraccionEstado(e)
  }
  const setCarga = (c: Carga) => {
    cargaRef.current = c
    setCargaEstado(c)
  }
  const actualizarCiudad = (id: string, cambio: Partial<EstadoCiudad>) => {
    const ext = extraccionRef.current!
    const porCiudad = { ...ext.porCiudad, [id]: { ...ext.porCiudad[id], ...cambio } }
    const siguiente = { ...ext, porCiudad }
    setExtraccion({ ...siguiente, estado: estadoGlobal(siguiente) })
  }

  const descargar = async (id: string) => {
    const ext = extraccionRef.current!
    const previo = ext.porCiudad[id]
    actualizarCiudad(id, { estado: "en_curso", intentos: previo.intentos + 1, error: undefined })
    const t0 = performance.now()
    try {
      const json = await descargarCiudad(previo.ciudad, ext.inicio, ext.fin)
      actualizarCiudad(id, { estado: "completada", json, duracionMs: performance.now() - t0 })
    } catch (e) {
      actualizarCiudad(id, {
        estado: "error",
        json: undefined,
        error: (e as Error).message,
        duracionMs: performance.now() - t0,
      })
    }
    const actual = extraccionRef.current!
    setExtraccion({ ...actual, duracionMs: actual.duracionMs + (performance.now() - t0) })
  }

  const extraer = async (idsCiudades: string[], inicio: string, fin: string) => {
    if (extraccionRef.current?.estado === "en_curso" || cargando.current) return
    const ciudades = CIUDADES.filter((c) => idsCiudades.includes(c.id))
    setExtraccion({
      inicio,
      fin,
      ciudades,
      estado: "en_curso",
      duracionMs: 0,
      porCiudad: Object.fromEntries(
        ciudades.map((c) => [
          c.id,
          { ciudad: c, url: construirUrlArchivo(c, inicio, fin), estado: "pendiente", intentos: 0 },
        ])
      ),
    })
    // Una extracción nueva sustituye por completo a la anterior.
    setProcesado(null)
    setSeleccion(new Set())
    setFiltros(FILTROS_INICIALES)
    setCargaEstado(null)
    cargaRef.current = null

    // En serie: se ve qué ciudades se han procesado y cuáles faltan, y no saturamos la API.
    for (const c of ciudades) await descargar(c.id)
    setProcesado(procesar(extraccionRef.current!))
  }

  /** Vuelve a pedir solo esa ciudad. Sustituye su respuesta: no se acumulan duplicados. */
  const reintentarCiudad = async (id: string) => {
    if (extraccionRef.current?.estado === "en_curso" || cargando.current) return
    await descargar(id)
    setProcesado(procesar(extraccionRef.current!))
  }

  // El resultado es puro; solo la duración medida varía, y queda memorizada con el resultado.
  const [filtradas, duracionFiltrosMs] = React.useMemo(
    () => cronometrar(() => filtrarYOrdenar(procesado?.validos ?? [], filtros, orden)),
    [procesado, filtros, orden]
  )

  const { paraSubir, fueraDeFiltros } = React.useMemo(
    () => resumirSeleccion(filtradas, seleccion),
    [filtradas, seleccion]
  )

  const alternarSeleccion = React.useCallback((claves: string[], seleccionar: boolean) => {
    setSeleccion((previa) => {
      const s = new Set(previa)
      for (const c of claves) {
        if (seleccionar) s.add(c)
        else s.delete(c)
      }
      return s
    })
  }, [])
  const seleccionarFiltradas = () => alternarSeleccion(filtradas.map(claveMedicion), true)
  const vaciarSeleccion = () => setSeleccion(new Set())
  const descartarFueraDeFiltros = () => setSeleccion(new Set(paraSubir.map(claveMedicion)))

  const correrLotes = async (lotes: Lote[]) => {
    const t0 = performance.now()
    const finales = await ejecutarLotes(lotes, enviarLote, verificarLote, (ls) =>
      setCarga({ ...cargaRef.current!, lotes: ls })
    )
    const conErrores = finales.some(
      (l) => l.estado === "error" || (l.verificacion && (l.verificacion.ausentes > 0 || l.verificacion.error))
    )
    const c = cargaRef.current!
    setCarga({
      ...c,
      lotes: finales,
      estado: conErrores ? "error" : "completada",
      duracionMs: c.duracionMs + (performance.now() - t0),
    })
    cargando.current = false
    setVersionDestino((v) => v + 1)
  }

  const subir = async () => {
    // El ref impide un segundo envío aunque se pulse dos veces antes de volver a renderizar.
    if (cargando.current || paraSubir.length === 0) return
    cargando.current = true
    // Copia congelada: cambiar los filtros durante la carga no altera lo que se envía.
    const congelado = paraSubir.map((m) => ({ ...m }))
    const lotes = crearLotes(congelado)
    setCarga({
      lotes,
      total: congelado.length,
      huellaVistaPrevia: huellaMediciones(paraSubir),
      huellaCongelada: huellaMediciones(congelado),
      estado: "en_curso",
      duracionMs: 0,
    })
    await correrLotes(lotes)
  }

  const reintentarLotesFallidos = async () => {
    const c = cargaRef.current
    if (cargando.current || !c) return
    cargando.current = true
    setCarga({ ...c, estado: "en_curso" })
    // ejecutarLotes omite los lotes completados: solo se reenvían los fallidos.
    await correrLotes(c.lotes)
  }

  return {
    extraccion,
    procesado,
    filtros,
    setFiltros,
    restablecerFiltros: () => setFiltros(FILTROS_INICIALES),
    orden,
    setOrden,
    seleccion,
    filtradas,
    duracionFiltrosMs,
    paraSubir,
    fueraDeFiltros,
    alternarSeleccion,
    seleccionarFiltradas,
    vaciarSeleccion,
    descartarFueraDeFiltros,
    carga,
    cargaEnCurso: carga?.estado === "en_curso",
    versionDestino,
    extraer,
    reintentarCiudad,
    subir,
    reintentarLotesFallidos,
  }
}

export type PipelineEtl = ReturnType<typeof usePipelineEtl>
