"use client"

import type * as React from "react"
import {
  ArrowRightIcon,
  DatabaseIcon,
  DownloadCloudIcon,
  ListFilterIcon,
  ShuffleIcon,
  SparklesIcon,
  UploadCloudIcon,
  type LucideIcon,
} from "lucide-react"

import { Termino } from "@/components/ayuda"
import { Button } from "@/components/ui/button"
import { TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { formatearDuracion, formatearNumero } from "@/lib/etl/formato"
import type { EstadoFase } from "@/lib/etl/tipos"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import type { EstadoServidor } from "./carga"
import { EstadoEtiqueta } from "./estado"

export type Pestana = "json" | "transformados" | "rechazados" | "validos" | "carga" | "supabase"

export interface Fase {
  pestana: Pestana
  numero: number
  nombre: string
  icono: LucideIcon
  /** Título del panel de datos que abre el paso. */
  titulo: string
  explicacion: React.ReactNode
  estado: EstadoFase
  textoEstado?: string
  /** Cifra principal que muestra el paso. */
  valor?: number
  unidad: string
  entrada?: string | null
  salida?: string | null
  notas: string[]
  duracionMs: number | null
}

function n(valor: number, unidad: string) {
  return `${formatearNumero(valor)} ${unidad}`
}

export function calcularFases(etl: PipelineEtl, servidor: EstadoServidor | null): Fase[] {
  const { extraccion: ext, procesado: p, carga } = etl
  const estados = ext ? Object.values(ext.porCiudad) : []
  const horasRecibidas = estados.reduce((total, e) => {
    const horas = (e.json as { hourly?: { time?: unknown[] } } | undefined)?.hourly?.time
    return total + (Array.isArray(horas) ? horas.length : 0)
  }, 0)
  const completadas = estados.filter((e) => e.estado === "completada").length
  const conError = estados.filter((e) => e.estado === "error").length
  const procesadoEstado = (): EstadoFase => (p ? "completada" : ext?.estado === "en_curso" ? "en_curso" : "pendiente")

  const calidad = p?.rechazados.filter((r) => r.tipo === "calidad").length ?? 0
  const duplicados = (p?.rechazados.length ?? 0) - calidad
  const excluidos = (p?.validos.length ?? 0) - etl.filtradas.length

  const cargaOk = carga?.lotes.filter((l) => l.estado === "completado") ?? []
  const procesados = cargaOk.reduce((t, l) => t + l.registros.length, 0)
  const verificados = cargaOk.reduce((t, l) => t + (l.verificacion?.presentes ?? 0), 0)

  return [
    {
      pestana: "json",
      numero: 1,
      nombre: "Extracción",
      icono: DownloadCloudIcon,
      titulo: "JSON original",
      explicacion: "Una petición HTTP por ciudad a la API histórica. El JSON se guarda tal cual llega.",
      estado: ext?.estado ?? "pendiente",
      valor: ext ? horasRecibidas : undefined,
      unidad: "horas recibidas",
      entrada: ext && n(ext.ciudades.length, "ciudades"),
      salida: ext && n(horasRecibidas, "horas recibidas"),
      notas: ext ? [`${completadas} correctas${conError ? ` · ${conError} con error` : ""}`] : [],
      duracionMs: ext && ext.duracionMs > 0 ? ext.duracionMs : null,
    },
    {
      pestana: "transformados",
      numero: 2,
      nombre: "Transformación",
      icono: ShuffleIcon,
      titulo: "Registros transformados",
      explicacion: (
        <>
          Los <Termino id="paralelos">arrays paralelos</Termino> de «hourly» se convierten en un registro
          por ciudad y hora (<Termino id="utc" />). No se corrige ningún valor.
        </>
      ),
      estado: procesadoEstado(),
      valor: p?.transformadas.length,
      unidad: "registros horarios",
      entrada: p && n(p.respuestas, "respuestas JSON"),
      salida: p && n(p.transformadas.length, "registros"),
      notas: p?.avisos.length ? [`${p.avisos.length} avisos de estructura`] : [],
      duracionMs: p?.duracionTransformacionMs ?? null,
    },
    {
      pestana: "rechazados",
      numero: 3,
      nombre: "Limpieza",
      icono: SparklesIcon,
      titulo: "Registros rechazados",
      explicacion: (
        <>
          Se validan tipos, rangos y fechas, y se eliminan <Termino id="duplicado">duplicados</Termino>. Nada
          se convierte en cero: lo que no es válido se rechaza con su motivo.
        </>
      ),
      estado: procesadoEstado(),
      valor: p?.validos.length,
      unidad: p ? `válidos · ${formatearNumero(p.rechazados.length)} rechazados` : "válidos",
      entrada: p && n(p.transformadas.length, "registros"),
      salida: p && n(p.validos.length, "válidos"),
      notas: p
        ? [`${formatearNumero(calidad)} rechazados por calidad · ${formatearNumero(duplicados)} duplicados`]
        : [],
      duracionMs: p?.duracionLimpiezaMs ?? null,
    },
    {
      pestana: "validos",
      numero: 4,
      nombre: "Selección",
      icono: ListFilterIcon,
      titulo: "Filtrado y selección",
      explicacion:
        "Filtra y ordena los registros válidos y marca cuáles quieres subir. Solo se suben los seleccionados que cumplen los filtros actuales.",
      estado: !p ? "pendiente" : etl.paraSubir.length > 0 ? "completada" : "pendiente",
      textoEstado: p && etl.paraSubir.length === 0 ? "Sin selección" : undefined,
      valor: p ? etl.paraSubir.length : undefined,
      unidad: "seleccionados",
      entrada: p && n(p.validos.length, "válidos"),
      salida: p && n(etl.paraSubir.length, "seleccionados"),
      notas: p
        ? [
            `${formatearNumero(etl.filtradas.length)} coinciden con los filtros · ${formatearNumero(excluidos)} excluidos`,
            ...(etl.fueraDeFiltros
              ? [`${formatearNumero(etl.fueraDeFiltros)} seleccionados fuera de filtros (no se suben)`]
              : []),
          ]
        : [],
      duracionMs: p ? etl.duracionFiltrosMs : null,
    },
    {
      pestana: "carga",
      numero: 5,
      nombre: "Carga",
      icono: UploadCloudIcon,
      titulo: "Vista previa de la carga",
      explicacion: (
        <>
          <Termino id="upsert" /> en Supabase por <Termino id="lote">lotes</Termino> de 500 desde el servidor
          y verificación posterior en destino.
        </>
      ),
      estado: carga?.estado ?? "pendiente",
      valor: carga ? procesados : undefined,
      unidad: "procesados",
      entrada: carga && n(carga.total, "a enviar"),
      salida: carga && n(procesados, "procesados"),
      notas: carga ? [`${formatearNumero(verificados)} verificados en destino`] : [],
      duracionMs: carga && carga.duracionMs > 0 ? carga.duracionMs : null,
    },
    {
      pestana: "supabase",
      numero: 6,
      nombre: "Destino",
      icono: DatabaseIcon,
      titulo: "Datos en Supabase",
      explicacion: (
        <>
          Lectura real de la tabla en Supabase. Una base de datos no garantiza el orden de inserción: el orden
          se pide siempre con <Termino id="orderby" />.
        </>
      ),
      estado: !servidor ? "en_curso" : servidor.listo ? "completada" : "error",
      textoEstado: !servidor ? "Comprobando" : servidor.listo ? "Conectado" : "Sin conexión",
      valor: servidor?.total,
      unidad: "filas guardadas",
      notas: servidor && !servidor.listo ? [servidor.mensaje] : [],
      duracionMs: null,
    },
  ]
}

/** Los pasos del pipeline hacen de pestañas: cada uno abre sus datos. */
export function PasosPipeline({ fases }: { fases: Fase[] }) {
  return (
    <TabsList
      aria-label="Fases del pipeline"
      className="grid h-auto w-full grid-cols-2 items-stretch gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto sm:grid-cols-3 lg:grid-cols-6"
    >
      {fases.map((f) => {
        const Icono = f.icono
        return (
          <TabsTrigger
            key={f.pestana}
            value={f.pestana}
            className={cn(
              "group/paso h-auto flex-col items-stretch justify-start gap-3 rounded-2xl border bg-card p-3 text-left whitespace-normal text-foreground shadow-xs transition",
              "hover:-translate-y-0.5 hover:border-rubor/70 hover:text-foreground",
              "data-active:border-rubor data-active:bg-accent/70 data-active:shadow-sm",
              "dark:text-foreground dark:data-active:border-rubor dark:data-active:bg-accent"
            )}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-data-active/paso:bg-primary group-data-active/paso:text-primary-foreground">
                <Icono className="size-4" />
              </span>
              <EstadoEtiqueta estado={f.estado} texto={f.textoEstado} soloIcono />
            </span>
            <span className="flex flex-col">
              <span className="text-xs font-medium text-muted-foreground">
                {f.numero}. {f.nombre}
              </span>
              <span className="text-xl font-semibold tabular-nums">
                {f.valor === undefined ? "—" : formatearNumero(f.valor)}
              </span>
              <span className="text-xs leading-snug font-normal text-muted-foreground">{f.unidad}</span>
            </span>
          </TabsTrigger>
        )
      })}
    </TabsList>
  )
}

/** Explicación y métricas del paso abierto, encima de sus datos. */
export function CabeceraFase({
  fase,
  siguiente,
  alSiguiente,
}: {
  fase: Fase
  siguiente?: Fase
  alSiguiente?: () => void
}) {
  const Icono = fase.icono
  const metricas = [
    fase.entrada && { texto: "Entrada", valor: fase.entrada },
    fase.salida && { texto: "Salida", valor: fase.salida },
    fase.duracionMs !== null && { texto: "Duración", valor: formatearDuracion(fase.duracionMs) },
  ].filter((m): m is { texto: string; valor: string } => Boolean(m))

  return (
    <div className="flex flex-col gap-3 border-b px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <Icono className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="flex flex-wrap items-center gap-2 font-semibold">
            {fase.titulo}
            <EstadoEtiqueta estado={fase.estado} texto={fase.textoEstado} />
          </h3>
          <p className="max-w-2xl text-sm text-muted-foreground">{fase.explicacion}</p>
          {fase.notas.map((nota) => (
            <p key={nota} className="text-xs text-muted-foreground">
              {nota}
            </p>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 lg:items-end">
        {metricas.length > 0 && (
          <dl className="flex flex-wrap gap-2 text-xs">
            {metricas.map((m) => (
              <div key={m.texto} className="rounded-xl bg-muted px-3 py-1.5">
                <dt className="text-muted-foreground">{m.texto}</dt>
                <dd className="font-medium tabular-nums">{m.valor}</dd>
              </div>
            ))}
          </dl>
        )}
        {siguiente && alSiguiente && (
          <Button variant="ghost" size="sm" onClick={alSiguiente} className="self-start rounded-full lg:self-end">
            Siguiente: {siguiente.numero}. {siguiente.nombre}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  )
}
