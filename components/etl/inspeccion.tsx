"use client"

import * as React from "react"
import { DownloadCloudIcon, DownloadIcon, ShuffleIcon, SparklesIcon, type LucideIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { formatearCrudo, formatearFechaUtc, formatearNumero } from "@/lib/etl/formato"
import type { FilaTransformada, Medicion, Rechazo } from "@/lib/etl/tipos"
import type { EstadoCiudad, PipelineEtl } from "@/hooks/use-pipeline-etl"
import { ListaMensajes } from "./campos"
import { EstadoEtiqueta } from "./estado"
import { BotonExportar } from "./exportar"
import { GraficaRechazos } from "./graficas"
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

/** Estado vacío de un paso: qué falta y qué hacer para que aparezcan datos. */
export function SinDatos({
  icono: Icono,
  titulo,
  cargando = false,
  children,
}: {
  icono: LucideIcon
  titulo: string
  /** Muestra un indicador de carga en lugar del icono. */
  cargando?: boolean
  children: React.ReactNode
}) {
  return (
    <Empty className="rounded-2xl border border-dashed py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">{cargando ? <Spinner /> : <Icono />}</EmptyMedia>
        <EmptyTitle>{titulo}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
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

/** Los id coinciden con los campos de ordenación (CampoOrden) para poder ordenar por cabecera. */
export const COLUMNAS_MEDICION: Columna<Medicion>[] = [
  { id: "ciudad", titulo: "Ciudad", celda: (m) => m.ciudad, valor: (m) => m.ciudad },
  {
    id: "fecha_hora",
    titulo: "Fecha y hora (UTC)",
    celda: (m) => formatearFechaUtc(m.fecha_hora),
    valor: (m) => formatearFechaUtc(m.fecha_hora),
  },
  {
    id: "temperatura_c",
    titulo: "Temperatura (°C)",
    numerica: true,
    celda: (m) => m.temperatura_c.toFixed(1),
    valor: (m) => m.temperatura_c,
  },
  { id: "humedad_pct", titulo: "Humedad (%)", numerica: true, celda: (m) => m.humedad_pct, valor: (m) => m.humedad_pct },
  {
    id: "precipitacion_mm",
    titulo: "Precipitación (mm)",
    numerica: true,
    celda: (m) => m.precipitacion_mm.toFixed(2),
    valor: (m) => m.precipitacion_mm,
  },
]

/** Número para ordenar; los valores crudos que no son números quedan al final. */
const numeroCrudo = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null)

export function PestanaJson({ etl }: { etl: PipelineEtl }) {
  const ext = etl.extraccion
  const [elegida, setElegida] = React.useState<string | null>(null)
  if (!ext)
    return (
      <SinDatos icono={DownloadCloudIcon} titulo="Todavía no hay extracción">
        Elige ciudades y periodo en el paso 1 y pulsa «Extraer datos».
      </SinDatos>
    )

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
        !actual.error && (
          <SinDatos icono={DownloadCloudIcon} titulo="Esperando respuesta" cargando={actual.estado === "en_curso"}>
            Open-Meteo todavía no ha respondido para {actual.ciudad.nombre}.
          </SinDatos>
        )
      )}
    </div>
  )
}

const COLUMNAS_TRANSFORMADAS: Columna<FilaTransformada>[] = [
  { id: "ciudad", titulo: "ciudad", celda: (f) => f.ciudad, valor: (f) => f.ciudad },
  { id: "i", titulo: "Índice en arrays", numerica: true, celda: (f) => f.indice, valor: (f) => f.indice },
  {
    id: "orig",
    titulo: "time (original)",
    celda: (f) => <Crudo valor={f.hora_original} />,
    valor: (f) => formatearCrudo(f.hora_original),
  },
  {
    id: "fecha",
    titulo: "fecha_hora (UTC)",
    celda: (f) => (f.fecha_hora ? f.fecha_hora : <Crudo valor={null} />),
    valor: (f) => f.fecha_hora,
  },
  {
    id: "t",
    titulo: "temperatura_c (°C)",
    numerica: true,
    celda: (f) => <Crudo valor={f.temperatura_c} />,
    valor: (f) => numeroCrudo(f.temperatura_c),
  },
  {
    id: "h",
    titulo: "humedad_pct (%)",
    numerica: true,
    celda: (f) => <Crudo valor={f.humedad_pct} />,
    valor: (f) => numeroCrudo(f.humedad_pct),
  },
  {
    id: "p",
    titulo: "precipitacion_mm (mm)",
    numerica: true,
    celda: (f) => <Crudo valor={f.precipitacion_mm} />,
    valor: (f) => numeroCrudo(f.precipitacion_mm),
  },
]

export function PestanaTransformados({ etl }: { etl: PipelineEtl }) {
  const p = etl.procesado
  if (!p)
    return (
      <SinDatos icono={ShuffleIcon} titulo="Esperando a la extracción" cargando={etl.extraccion?.estado === "en_curso"}>
        La transformación se ejecuta al terminar la extracción.
      </SinDatos>
    )
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
        buscar
        acciones={
          <BotonExportar
            nombre="transformados"
            total={p.transformadas.length}
            obtener={() => p.transformadas as unknown as Record<string, unknown>[]}
          />
        }
        vacio="No hay registros transformados."
      />
    </div>
  )
}

const COLUMNAS_RECHAZADOS: Columna<Rechazo>[] = [
  {
    id: "tipo",
    titulo: "Tipo",
    valor: (r) => (r.tipo === "duplicado" ? "Duplicado" : "Calidad"),
    celda: (r) => (
      <Badge variant={r.tipo === "duplicado" ? "secondary" : "destructive"}>
        {r.tipo === "duplicado" ? "Duplicado" : "Calidad"}
      </Badge>
    ),
  },
  {
    id: "ciudad",
    titulo: "Ciudad",
    celda: (r) => r.fila.ciudad || <Crudo valor={r.fila.ciudad} />,
    valor: (r) => r.fila.ciudad,
  },
  {
    id: "orig",
    titulo: "time (original)",
    celda: (r) => <Crudo valor={r.fila.hora_original} />,
    valor: (r) => formatearCrudo(r.fila.hora_original),
  },
  {
    id: "t",
    titulo: "Temp. (°C)",
    numerica: true,
    celda: (r) => <Crudo valor={r.fila.temperatura_c} />,
    valor: (r) => numeroCrudo(r.fila.temperatura_c),
  },
  {
    id: "h",
    titulo: "Hum. (%)",
    numerica: true,
    celda: (r) => <Crudo valor={r.fila.humedad_pct} />,
    valor: (r) => numeroCrudo(r.fila.humedad_pct),
  },
  {
    id: "p",
    titulo: "Prec. (mm)",
    numerica: true,
    celda: (r) => <Crudo valor={r.fila.precipitacion_mm} />,
    valor: (r) => numeroCrudo(r.fila.precipitacion_mm),
  },
  {
    id: "motivo",
    titulo: "Motivo del rechazo",
    valor: (r) => r.motivos.join(" · "),
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
  if (!p)
    return (
      <SinDatos icono={SparklesIcon} titulo="Esperando a la extracción" cargando={etl.extraccion?.estado === "en_curso"}>
        La limpieza se ejecuta al terminar la extracción.
      </SinDatos>
    )
  const calidad = p.rechazados.filter((r) => r.tipo === "calidad").length
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Descartes por <strong>calidad</strong> ({formatearNumero(calidad)}) y por{" "}
        <strong>duplicado</strong> ({formatearNumero(p.rechazados.length - calidad)}). Ante un duplicado
        de ciudad y fecha_hora se conserva la primera aparición. Los registros que solo quedan fuera
        por los filtros <em>no</em> aparecen aquí: siguen siendo válidos.
      </p>
      <GraficaRechazos rechazados={p.rechazados} />
      <TablaPaginada
        filas={p.rechazados}
        columnas={COLUMNAS_RECHAZADOS}
        claveFila={(r) => `${r.fila.ciudad}|${r.fila.indice}|${r.tipo}`}
        buscar
        acciones={
          <BotonExportar
            nombre="rechazados"
            total={p.rechazados.length}
            obtener={() =>
              p.rechazados.map(({ tipo, motivos, fila }) => ({ tipo, ...fila, motivos: motivos.join(" | ") }))
            }
          />
        }
        vacio="Ningún registro rechazado: todas las filas superaron la limpieza."
      />
    </div>
  )
}
