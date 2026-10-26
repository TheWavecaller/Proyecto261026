"use client"

import { ArrowDownIcon, ArrowRightIcon, SearchIcon } from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import { formatearDuracion, formatearNumero } from "@/lib/etl/formato"
import type { EstadoFase } from "@/lib/etl/tipos"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { EstadoEtiqueta } from "./estado"

export type Pestana = "json" | "transformados" | "validos" | "rechazados" | "carga" | "supabase"

interface Fase {
  numero: number
  nombre: string
  explicacion: string
  estado: EstadoFase
  entrada: string
  salida: string
  detalle?: string
  duracionMs: number | null
  pestana: Pestana
}

function n(valor: number, unidad: string) {
  return `${formatearNumero(valor)} ${unidad}`
}

function calcularFases(etl: PipelineEtl): Fase[] {
  const { extraccion: ext, procesado: p, carga } = etl
  const estados = ext ? Object.values(ext.porCiudad) : []
  const horasRecibidas = estados.reduce((total, e) => {
    const horas = (e.json as { hourly?: { time?: unknown[] } } | undefined)?.hourly?.time
    return total + (Array.isArray(horas) ? horas.length : 0)
  }, 0)
  const completadas = estados.filter((e) => e.estado === "completada").length
  const conError = estados.filter((e) => e.estado === "error").length
  const procesadoEstado = (): EstadoFase => (p ? "completada" : ext?.estado === "en_curso" ? "en_curso" : "pendiente")

  const cargaOk = carga?.lotes.filter((l) => l.estado === "completado") ?? []
  const verificados = cargaOk.reduce((t, l) => t + (l.verificacion?.presentes ?? 0), 0)

  return [
    {
      numero: 1,
      nombre: "Extracción",
      explicacion: "Una petición HTTP por ciudad a la API histórica. Se guarda el JSON tal cual llega.",
      estado: ext?.estado ?? "pendiente",
      entrada: ext ? n(ext.ciudades.length, "ciudades") : "—",
      salida: ext ? n(horasRecibidas, "horas recibidas") : "—",
      detalle: ext ? `${completadas} correctas${conError ? ` · ${conError} con error` : ""}` : undefined,
      duracionMs: ext && ext.duracionMs > 0 ? ext.duracionMs : null,
      pestana: "json",
    },
    {
      numero: 2,
      nombre: "Transformación",
      explicacion: "Los arrays paralelos de «hourly» se convierten en un registro por ciudad y hora (UTC).",
      estado: procesadoEstado(),
      entrada: p ? n(p.respuestas, "respuestas JSON") : "—",
      salida: p ? n(p.transformadas.length, "registros") : "—",
      detalle: p?.avisos.length ? `${p.avisos.length} avisos de estructura` : undefined,
      duracionMs: p?.duracionTransformacionMs ?? null,
      pestana: "transformados",
    },
    {
      numero: 3,
      nombre: "Limpieza",
      explicacion: "Se validan tipos, rangos y fechas, y se eliminan duplicados. Nada se convierte en cero.",
      estado: procesadoEstado(),
      entrada: p ? n(p.transformadas.length, "registros") : "—",
      salida: p ? n(p.validos.length, "válidos") : "—",
      detalle: p ? `${formatearNumero(p.rechazados.length)} rechazados` : undefined,
      duracionMs: p?.duracionLimpiezaMs ?? null,
      pestana: "rechazados",
    },
    {
      numero: 4,
      nombre: "Filtrado y selección",
      explicacion: "Filtros → ordenación → selección manual. Decides exactamente qué filas se subirán.",
      estado: !p ? "pendiente" : etl.paraSubir.length > 0 ? "completada" : "pendiente",
      entrada: p ? n(p.validos.length, "válidos") : "—",
      salida: p ? n(etl.paraSubir.length, "seleccionados") : "—",
      detalle: p
        ? `${formatearNumero(etl.filtradas.length)} coinciden con los filtros${etl.paraSubir.length === 0 ? " · nada seleccionado" : ""}`
        : undefined,
      duracionMs: p ? etl.duracionFiltrosMs : null,
      pestana: "validos",
    },
    {
      numero: 5,
      nombre: "Carga",
      explicacion: "Upsert en Supabase por lotes de 500 desde el servidor y verificación posterior en destino.",
      estado: carga?.estado ?? "pendiente",
      entrada: carga ? n(carga.total, "a enviar") : "—",
      salida: carga ? n(cargaOk.reduce((t, l) => t + l.registros.length, 0), "procesados") : "—",
      detalle: carga ? `${formatearNumero(verificados)} verificados en destino` : undefined,
      duracionMs: carga && carga.duracionMs > 0 ? carga.duracionMs : null,
      pestana: "carga",
    },
  ]
}

export function Pipeline({
  etl,
  alInspeccionar,
}: {
  etl: PipelineEtl
  alInspeccionar: (p: Pestana) => void
}) {
  const fases = calcularFases(etl)
  return (
    <section aria-labelledby="titulo-pipeline" className="flex flex-col gap-3">
      <h2 id="titulo-pipeline" className="text-base font-semibold">
        2. Pipeline ETL
      </h2>
      <ol className="grid gap-2 lg:grid-cols-[repeat(5,minmax(0,1fr))]">
        {fases.map((f, i) => (
          <React.Fragment key={f.nombre}>
            <li
              className="relative flex flex-col gap-2 rounded-xl border bg-card p-3 text-sm data-[estado=en_curso]:border-sky-600/50 data-[estado=error]:border-destructive/50"
              data-estado={f.estado}
              aria-label={`Fase ${f.numero}: ${f.nombre}`}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold">
                  <span className="text-muted-foreground">{f.numero}.</span> {f.nombre}
                </h3>
                <EstadoEtiqueta estado={f.estado} />
              </div>
              <p className="text-xs text-muted-foreground">{f.explicacion}</p>
              <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
                <dt className="text-muted-foreground">Entrada</dt>
                <dd className="text-right font-medium tabular-nums">{f.entrada}</dd>
                <dt className="text-muted-foreground">Salida</dt>
                <dd className="text-right font-medium tabular-nums">{f.salida}</dd>
                <dt className="text-muted-foreground">Duración</dt>
                <dd className="text-right tabular-nums">{formatearDuracion(f.duracionMs)}</dd>
              </dl>
              {f.detalle && <p className="text-xs">{f.detalle}</p>}
              <Button variant="outline" size="sm" onClick={() => alInspeccionar(f.pestana)}>
                <SearchIcon data-icon="inline-start" />
                Inspeccionar
              </Button>
              {i < fases.length - 1 && (
                <span
                  aria-hidden
                  className="absolute top-1/2 -right-2 z-10 hidden -translate-y-1/2 rounded-full border bg-background p-0.5 text-muted-foreground lg:block"
                >
                  <ArrowRightIcon className="size-3" />
                </span>
              )}
            </li>
            {i < fases.length - 1 && (
              <li aria-hidden className="flex justify-center text-muted-foreground lg:hidden">
                <ArrowDownIcon className="size-4" />
              </li>
            )}
          </React.Fragment>
        ))}
      </ol>
    </section>
  )
}

export function Contadores({ etl }: { etl: PipelineEtl }) {
  const p = etl.procesado
  const calidad = p?.rechazados.filter((r) => r.tipo === "calidad").length ?? 0
  const duplicados = (p?.rechazados.length ?? 0) - calidad
  const excluidos = (p?.validos.length ?? 0) - etl.filtradas.length
  const items = [
    { titulo: "Total extraído", valor: p?.transformadas.length, nota: "registros horarios" },
    { titulo: "Válidos", valor: p?.validos.length, nota: "superan la limpieza" },
    {
      titulo: "Rechazados",
      valor: p?.rechazados.length,
      nota: `${formatearNumero(calidad)} calidad · ${formatearNumero(duplicados)} duplicados`,
    },
    {
      titulo: "Coinciden con los filtros",
      valor: p ? etl.filtradas.length : undefined,
      nota: `${formatearNumero(excluidos)} excluidos por filtros`,
    },
    {
      titulo: "Seleccionados para cargar",
      valor: p ? etl.paraSubir.length : undefined,
      nota: etl.fueraDeFiltros
        ? `${formatearNumero(etl.fueraDeFiltros)} seleccionados fuera de filtros (no se suben)`
        : "seleccionados y dentro de filtros",
      destacado: true,
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-label="Contadores del pipeline">
      {items.map((it) => (
        <div
          key={it.titulo}
          className={
            it.destacado
              ? "col-span-2 rounded-xl border border-primary/40 bg-primary/5 p-3 sm:col-span-1"
              : "rounded-xl border bg-card p-3"
          }
        >
          <dt className="text-xs text-muted-foreground">{it.titulo}</dt>
          <dd className="text-2xl font-semibold tabular-nums">
            {it.valor === undefined ? "—" : formatearNumero(it.valor)}
          </dd>
          <dd className="text-xs text-muted-foreground">{it.nota}</dd>
        </div>
      ))}
    </dl>
  )
}
