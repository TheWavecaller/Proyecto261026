"use client"

import * as React from "react"
import { DownloadIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatearCrudo, formatearFechaUtc, formatearNumero } from "@/lib/etl/formato"
import type { FilaTransformada, Medicion, Rechazo } from "@/lib/etl/tipos"
import type { EstadoCiudad, PipelineEtl } from "@/hooks/use-pipeline-etl"
import { ListaMensajes } from "./campos"
import { EstadoEtiqueta } from "./estado"
import { TablaPaginada, type Columna } from "./tabla-paginada"

function descargar(nombre: string, datos: unknown) {
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function SinDatos({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>
}

/** Valor crudo resaltando null, ausentes y textos para que no pasen desapercibidos. */
function Crudo({ valor }: { valor: unknown }) {
  const problema = typeof valor !== "number" || !Number.isFinite(valor)
  return (
    <span className={problema ? "rounded bg-aviso-suave px-1 font-mono text-aviso" : undefined}>
      {formatearCrudo(valor)}
    </span>
  )
}

export const COLUMNAS_MEDICION: Columna<Medicion>[] = [
  { id: "ciudad", titulo: "Ciudad", celda: (m) => m.ciudad },
  { id: "fecha", titulo: "Fecha y hora (UTC)", celda: (m) => formatearFechaUtc(m.fecha_hora) },
  { id: "t", titulo: "Temperatura (°C)", numerica: true, celda: (m) => m.temperatura_c.toFixed(1) },
  { id: "h", titulo: "Humedad (%)", numerica: true, celda: (m) => m.humedad_pct },
  { id: "p", titulo: "Precipitación (mm)", numerica: true, celda: (m) => m.precipitacion_mm.toFixed(2) },
]

export function PestanaJson({ etl }: { etl: PipelineEtl }) {
  const ext = etl.extraccion
  const [elegida, setElegida] = React.useState<string | null>(null)
  if (!ext) return <SinDatos>Todavía no hay respuestas. Lanza una extracción.</SinDatos>

  const estados = ext.ciudades.map((c) => ext.porCiudad[c.id])
  const actual: EstadoCiudad = ext.porCiudad[elegida ?? ""] ?? estados[0]
  const json = actual.json as
    | { latitude?: number; longitude?: number; elevation?: number; hourly_units?: object; hourly?: Record<string, unknown[]> }
    | undefined
  const nombreArchivo = (id: string) => `open-meteo_${id}_${ext.inicio}_${ext.fin}.json`
  const conJson = estados.filter((e) => e.json !== undefined)

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Elegir ciudad">
        {estados.map((e) => (
          <Button
            key={e.ciudad.id}
            size="sm"
            variant={e.ciudad.id === actual.ciudad.id ? "default" : "outline"}
            aria-pressed={e.ciudad.id === actual.ciudad.id}
            onClick={() => setElegida(e.ciudad.id)}
          >
            {e.ciudad.nombre}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={conJson.length === 0}
          onClick={() =>
            descargar(
              `open-meteo_${ext.inicio}_${ext.fin}.json`,
              Object.fromEntries(conJson.map((e) => [e.ciudad.nombre, { url: e.url, respuesta: e.json }]))
            )
          }
        >
          <DownloadIcon data-icon="inline-start" />
          Descargar todos
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <EstadoEtiqueta estado={actual.estado} />
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-1.5 py-0.5 text-xs" title={actual.url}>
          GET {actual.url}
        </code>
        <Button
          size="sm"
          variant="outline"
          disabled={actual.json === undefined}
          onClick={() => descargar(nombreArchivo(actual.ciudad.id), actual.json)}
        >
          <DownloadIcon data-icon="inline-start" />
          Descargar {actual.ciudad.nombre}
        </Button>
      </div>

      {actual.error && <ListaMensajes mensajes={[actual.error]} tono="error" />}
      {json ? (
        <>
          <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-lg bg-muted/60 p-2">
              <dt className="text-muted-foreground">Coordenadas de la celda</dt>
              <dd className="tabular-nums">{json.latitude}, {json.longitude}</dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <dt className="text-muted-foreground">Elevación</dt>
              <dd>{json.elevation} m</dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <dt className="text-muted-foreground">Longitud de los arrays</dt>
              <dd className="tabular-nums">
                {Object.entries(json.hourly ?? {})
                  .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.length : "—"}`)
                  .join(" · ")}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <dt className="text-muted-foreground">Unidades</dt>
              <dd className="break-all">{JSON.stringify(json.hourly_units)}</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Observa que «hourly» contiene arrays paralelos: la posición <em>i</em> de cada array
            corresponde a la hora <em>time[i]</em>. Las coordenadas devueltas son las de la celda de la
            rejilla más cercana, no exactamente las solicitadas.
          </p>
          <pre className="max-h-[28rem] max-w-full overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-xs">
            {JSON.stringify(json, null, 2)}
          </pre>
        </>
      ) : (
        !actual.error && <SinDatos>Respuesta aún no recibida.</SinDatos>
      )}
    </div>
  )
}

const COLUMNAS_TRANSFORMADAS: Columna<FilaTransformada>[] = [
  { id: "ciudad", titulo: "ciudad", celda: (f) => f.ciudad },
  { id: "i", titulo: "Índice en arrays", numerica: true, celda: (f) => f.indice },
  { id: "orig", titulo: "time (original)", celda: (f) => <Crudo valor={f.hora_original} /> },
  { id: "fecha", titulo: "fecha_hora (UTC)", celda: (f) => (f.fecha_hora ? f.fecha_hora : <Crudo valor={null} />) },
  { id: "t", titulo: "temperatura_c (°C)", numerica: true, celda: (f) => <Crudo valor={f.temperatura_c} /> },
  { id: "h", titulo: "humedad_pct (%)", numerica: true, celda: (f) => <Crudo valor={f.humedad_pct} /> },
  { id: "p", titulo: "precipitacion_mm (mm)", numerica: true, celda: (f) => <Crudo valor={f.precipitacion_mm} /> },
]

export function PestanaTransformados({ etl }: { etl: PipelineEtl }) {
  const p = etl.procesado
  if (!p) return <SinDatos>La transformación se ejecuta al terminar la extracción.</SinDatos>
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Cada posición de los arrays paralelos se convierte en un registro. Los valores se copian sin
        corregir; los resaltados (null, ausentes, textos) se evaluarán en la limpieza.
      </p>
      <ListaMensajes mensajes={p.avisos} tono="aviso" />
      <TablaPaginada
        filas={p.transformadas}
        columnas={COLUMNAS_TRANSFORMADAS}
        claveFila={(f) => `${f.ciudad}|${f.indice}`}
        vacio="No hay registros transformados."
      />
    </div>
  )
}

const COLUMNAS_RECHAZADOS: Columna<Rechazo>[] = [
  {
    id: "tipo",
    titulo: "Tipo",
    celda: (r) => (
      <Badge variant={r.tipo === "duplicado" ? "secondary" : "destructive"}>
        {r.tipo === "duplicado" ? "Duplicado" : "Calidad"}
      </Badge>
    ),
  },
  { id: "ciudad", titulo: "Ciudad", celda: (r) => r.fila.ciudad || <Crudo valor={r.fila.ciudad} /> },
  { id: "orig", titulo: "time (original)", celda: (r) => <Crudo valor={r.fila.hora_original} /> },
  { id: "t", titulo: "Temp. (°C)", numerica: true, celda: (r) => <Crudo valor={r.fila.temperatura_c} /> },
  { id: "h", titulo: "Hum. (%)", numerica: true, celda: (r) => <Crudo valor={r.fila.humedad_pct} /> },
  { id: "p", titulo: "Prec. (mm)", numerica: true, celda: (r) => <Crudo valor={r.fila.precipitacion_mm} /> },
  {
    id: "motivo",
    titulo: "Motivo del rechazo",
    className: "min-w-64 whitespace-normal",
    celda: (r) => (
      <ul className="list-disc pl-4">
        {r.motivos.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    ),
  },
]

export function PestanaRechazados({ etl }: { etl: PipelineEtl }) {
  const p = etl.procesado
  if (!p) return <SinDatos>La limpieza se ejecuta al terminar la extracción.</SinDatos>
  const calidad = p.rechazados.filter((r) => r.tipo === "calidad").length
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Descartes por <strong>calidad</strong> ({formatearNumero(calidad)}) y por{" "}
        <strong>duplicado</strong> ({formatearNumero(p.rechazados.length - calidad)}). Ante un duplicado
        de ciudad y fecha_hora se conserva la primera aparición. Los registros que solo quedan fuera
        por los filtros <em>no</em> aparecen aquí: siguen siendo válidos.
      </p>
      <TablaPaginada
        filas={p.rechazados}
        columnas={COLUMNAS_RECHAZADOS}
        claveFila={(r) => `${r.fila.ciudad}|${r.fila.indice}|${r.tipo}`}
        vacio="Ningún registro rechazado: todas las filas superaron la limpieza."
      />
    </div>
  )
}
