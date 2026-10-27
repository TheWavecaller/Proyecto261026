"use client"

import * as React from "react"
import { CheckIcon, DownloadCloudIcon, PlusIcon, RotateCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { CIUDADES } from "@/lib/etl/ciudades"
import { diasEntre, MAX_DIAS, validarExtraccion } from "@/lib/etl/extraccion"
import { formatearDuracion, formatearNumero } from "@/lib/etl/formato"
import { resumirPorCiudad } from "@/lib/etl/resumen"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { Campo, ListaMensajes } from "./campos"
import { EstadoEtiqueta } from "./estado"
import { MapaCiudades } from "./mapa"

export function Configuracion({ etl }: { etl: PipelineEtl }) {
  const [ciudades, setCiudades] = React.useState<string[]>(CIUDADES.map((c) => c.id))
  const [inicio, setInicio] = React.useState("2026-09-01")
  const [fin, setFin] = React.useState("2026-09-30")
  const [intentado, setIntentado] = React.useState(false)

  const { errores, avisos } = validarExtraccion(ciudades, inicio, fin)
  const dias = errores.length === 0 ? diasEntre(inicio, fin) : 0
  const ext = etl.extraccion
  const ocupado = ext?.estado === "en_curso" || etl.cargaEnCurso

  const alternar = (id: string, marcar: boolean) =>
    setCiudades((prev) =>
      marcar ? CIUDADES.filter((c) => prev.includes(c.id) || c.id === id).map((c) => c.id) : prev.filter((x) => x !== id)
    )

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setIntentado(true)
    if (errores.length === 0) void etl.extraer(ciudades, inicio, fin)
  }

  const estados = ext ? ext.ciudades.map((c) => ext.porCiudad[c.id]) : []
  const procesadas = estados.filter((e) => e.estado === "completada" || e.estado === "error")
  const pendientes = estados.filter((e) => e.estado === "pendiente" || e.estado === "en_curso")
  const procesado = etl.procesado
  const resumen = React.useMemo(
    () => (procesado ? resumirPorCiudad(procesado.validos, procesado.rechazados) : null),
    [procesado]
  )

  return (
    <section
      aria-labelledby="titulo-configuracion"
      className="grid overflow-hidden rounded-3xl border bg-card shadow-sm lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]"
    >
      <MapaCiudades
        className="h-80 sm:h-96 lg:h-auto lg:min-h-[34rem]"
        seleccionadas={ciudades}
        alAlternar={alternar}
        deshabilitado={ocupado}
        resumen={resumen}
        estados={Object.fromEntries(estados.map((e) => [e.ciudad.id, e.estado]))}
      />

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 id="titulo-configuracion" className="flex items-center gap-2 text-lg font-semibold">
            <PasoNumero>1</PasoNumero>
            Configura la extracción
          </h2>
          <p className="text-sm text-muted-foreground">
            API histórica de Open-Meteo: temperatura (°C), humedad (%) y precipitación (mm) por
            hora, en UTC.
          </p>
        </div>

        <form onSubmit={enviar} className="flex flex-col gap-5" noValidate>
          <fieldset className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <legend className="text-xs font-medium text-muted-foreground">
                Ciudades · {ciudades.length} de {CIUDADES.length}
              </legend>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={ocupado || ciudades.length === CIUDADES.length}
                  onClick={() => setCiudades(CIUDADES.map((c) => c.id))}
                >
                  Todas
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={ocupado || ciudades.length === 0}
                  onClick={() => setCiudades([])}
                >
                  Ninguna
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {CIUDADES.map((c) => {
                const marcada = ciudades.includes(c.id)
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={marcada}
                    disabled={ocupado}
                    onClick={() => alternar(c.id, !marcada)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border pr-3 pl-2 text-sm font-medium transition outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
                      marcada
                        ? "border-rubor bg-accent text-accent-foreground"
                        : "border-dashed text-muted-foreground hover:border-rubor hover:text-foreground"
                    )}
                  >
                    {marcada ? <CheckIcon className="size-3.5" /> : <PlusIcon className="size-3.5" />}
                    {c.nombre}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Desde (UTC)" htmlFor="fecha-inicio">
              <Input
                id="fecha-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                disabled={ocupado}
                aria-invalid={intentado && errores.length > 0}
              />
            </Campo>
            <Campo etiqueta="Hasta (UTC, incluida)" htmlFor="fecha-fin">
              <Input
                id="fecha-fin"
                type="date"
                value={fin}
                onChange={(e) => setFin(e.target.value)}
                disabled={ocupado}
                aria-invalid={intentado && errores.length > 0}
              />
            </Campo>
          </div>

          <div className="rounded-2xl bg-muted px-4 py-3" aria-live="polite">
            {dias > 0 ? (
              <>
                <p className="text-2xl font-semibold tabular-nums">
                  {formatearNumero(dias * 24 * ciudades.length)}
                  <span className="ml-1.5 text-sm font-normal text-muted-foreground">registros horarios</span>
                </p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {ciudades.length} {ciudades.length === 1 ? "ciudad" : "ciudades"} × {dias} días × 24 h ·{" "}
                  {formatearNumero(ciudades.length)} peticiones
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Corrige la configuración para ver el volumen (máximo {MAX_DIAS} días).
              </p>
            )}
          </div>

          <ListaMensajes mensajes={errores} tono="error" />
          <ListaMensajes mensajes={avisos} tono="aviso" />

          <Button type="submit" disabled={ocupado} className="h-11 rounded-full text-base shadow-sm">
            <DownloadCloudIcon data-icon="inline-start" />
            {ext?.estado === "en_curso" ? "Extrayendo…" : ext ? "Volver a extraer" : "Extraer datos"}
          </Button>
        </form>

        {ext && (
          <section aria-label="Progreso de la extracción" className="flex flex-col gap-2">
            <p className="text-xs text-muted-foreground" aria-live="polite">
              <strong className="text-foreground">{procesadas.length}</strong> procesadas ·{" "}
              <strong className="text-foreground">{pendientes.length}</strong> pendientes · {ext.inicio} → {ext.fin}
            </p>
            <ul className="flex flex-col divide-y rounded-2xl border">
              {estados.map((e) => (
                <li key={e.ciudad.id} className="flex flex-col gap-1 px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-20 font-medium">{e.ciudad.nombre}</span>
                    <EstadoEtiqueta estado={e.estado} />
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {e.duracionMs !== undefined && formatearDuracion(e.duracionMs)}
                      {e.intentos > 1 && ` · ${e.intentos} intentos`}
                    </span>
                    {e.estado === "error" && (
                      <Button
                        variant="outline"
                        size="xs"
                        className="ml-auto"
                        disabled={ocupado}
                        onClick={() => void etl.reintentarCiudad(e.ciudad.id)}
                      >
                        <RotateCwIcon data-icon="inline-start" />
                        Reintentar
                      </Button>
                    )}
                  </div>
                  {e.error && <p className="text-xs text-destructive">{e.error}</p>}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </section>
  )
}

export function PasoNumero({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
    >
      {children}
    </span>
  )
}
