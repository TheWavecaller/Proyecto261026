"use client"

import * as React from "react"
import { ChartLineIcon } from "lucide-react"
import { Bar, BarChart, CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts"

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import { CIUDADES } from "@/lib/etl/ciudades"
import { formatearNumero } from "@/lib/etl/formato"
import { contarMotivos, serieTemporal, type MedidaGrafica } from "@/lib/etl/resumen"
import type { Medicion, Rechazo } from "@/lib/etl/tipos"

const MEDIDAS: Record<MedidaGrafica, { texto: string; unidad: string; decimales: number; diaria: string }> = {
  temperatura_c: { texto: "Temperatura", unidad: "°C", decimales: 1, diaria: "media diaria" },
  humedad_pct: { texto: "Humedad", unidad: "%", decimales: 0, diaria: "media diaria" },
  precipitacion_mm: { texto: "Precipitación", unidad: "mm", decimales: 1, diaria: "total diario" },
}

// El color sigue a la ciudad (su posición en CIUDADES), no al orden en que aparece: si se
// filtra una ciudad, las demás conservan su color.
const CONFIG_CIUDADES: ChartConfig = Object.fromEntries(
  CIUDADES.map((c, i) => [c.nombre, { label: c.nombre, color: `var(--serie-${(i % 5) + 1})` }])
)

const fechaDia = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" })
const fechaLarga = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})
const fechaHora = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
})

/** Evolución de una medida por ciudad sobre las filas que se le pasen (p. ej. las filtradas). */
export function GraficaMediciones({ filas, className }: { filas: readonly Medicion[]; className?: string }) {
  const [medida, setMedida] = React.useState<MedidaGrafica>("temperatura_c")
  const info = MEDIDAS[medida]
  const { resolucion, puntos } = React.useMemo(() => {
    const s = serieTemporal(filas, medida)
    const f = 10 ** info.decimales
    return {
      ...s,
      puntos: s.puntos.map((p) => {
        const r: Record<string, number> = { t: p.t }
        for (const [k, v] of Object.entries(p)) if (k !== "t") r[k] = Math.round(v * f) / f
        return r
      }),
    }
  }, [filas, medida, info.decimales])
  const ciudades = React.useMemo(() => {
    const presentes = new Set(filas.map((m) => m.ciudad))
    return CIUDADES.filter((c) => presentes.has(c.nombre))
  }, [filas])

  return (
    <figure className={cn("flex flex-col gap-3 rounded-xl border p-3 sm:p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="text-sm">
          <span className="font-semibold">
            {info.texto} ({info.unidad})
          </span>
          <span className="text-muted-foreground">
            {" "}
            · {resolucion === "dia" ? info.diaria : "por hora"} · {formatearNumero(filas.length)} registros
          </span>
        </figcaption>
        <div role="radiogroup" aria-label="Medida de la gráfica" className="flex gap-1 rounded-lg bg-muted p-0.5">
          {(Object.keys(MEDIDAS) as MedidaGrafica[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={medida === m}
              onClick={() => setMedida(m)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium text-muted-foreground transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                medida === m ? "bg-card text-foreground shadow-xs" : "hover:text-foreground"
              )}
            >
              {MEDIDAS[m].texto}
            </button>
          ))}
        </div>
      </div>

      {puntos.length === 0 ? (
        <Empty className="h-64 sm:h-72">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ChartLineIcon />
            </EmptyMedia>
            <EmptyTitle>No hay registros que dibujar</EmptyTitle>
            <EmptyDescription>Ningún registro cumple los filtros actuales. Amplíalos para ver la gráfica.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ChartContainer config={CONFIG_CIUDADES} className="aspect-auto h-64 w-full sm:h-72">
          <LineChart data={puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(t: number) => (resolucion === "dia" ? fechaDia : fechaHora).format(t)}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tickMargin={4}
              tickFormatter={(v: number) => formatearNumero(v)}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const t = payload?.[0]?.payload?.t as number | undefined
                    if (t === undefined) return null
                    return resolucion === "dia" ? fechaLarga.format(t) : `${fechaHora.format(t)} UTC`
                  }}
                />
              }
            />
            {ciudades.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
            {ciudades.map((c) => (
              <Line
                key={c.id}
                dataKey={c.nombre}
                type="monotone"
                stroke={`var(--color-${c.nombre})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </figure>
  )
}

const CONFIG_RECHAZOS: ChartConfig = { total: { label: "Filas", color: "var(--serie-1)" } }

/** Cuántas filas se rechazaron por cada motivo. Una fila con dos problemas cuenta en ambos. */
export function GraficaRechazos({ rechazados }: { rechazados: readonly Rechazo[] }) {
  const datos = React.useMemo(() => contarMotivos(rechazados), [rechazados])
  if (datos.length === 0) return null
  return (
    <figure className="flex flex-col gap-3 rounded-xl border p-3 sm:p-4">
      <figcaption className="text-sm">
        <span className="font-semibold">Motivos de rechazo</span>
        <span className="text-muted-foreground"> · filas afectadas por cada motivo</span>
      </figcaption>
      <ChartContainer
        config={CONFIG_RECHAZOS}
        className="aspect-auto w-full"
        style={{ height: `${Math.max(2, datos.length) * 2.25 + 1}rem` }}
      >
        <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="motivo"
            width={200}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12 }}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
          <Bar dataKey="total" fill="var(--color-total)" radius={4} barSize={18} isAnimationActive={false}>
            <LabelList
              dataKey="total"
              position="right"
              className="fill-foreground"
              fontSize={12}
              formatter={(v) => formatearNumero(Number(v))}
            />
          </Bar>
        </BarChart>
      </ChartContainer>
    </figure>
  )
}
