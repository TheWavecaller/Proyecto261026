"use client"

import * as React from "react"
import { DownloadCloudIcon, RotateCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { CIUDADES } from "@/lib/etl/ciudades"
import { diasEntre, MAX_DIAS, validarExtraccion } from "@/lib/etl/extraccion"
import { formatearDuracion, formatearNumero } from "@/lib/etl/formato"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { Campo, ListaMensajes } from "./campos"
import { EstadoEtiqueta } from "./estado"

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

  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Configuración de la extracción</CardTitle>
        <CardDescription>
          API histórica de Open-Meteo · variables horarias de temperatura (°C), humedad relativa
          (%) y precipitación (mm) · horas en UTC.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <form onSubmit={enviar} className="flex flex-col gap-4" noValidate>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">
              Ciudades ({ciudades.length} de {CIUDADES.length})
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CIUDADES.map((c) => (
                <label
                  key={c.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm has-data-checked:border-primary/50 has-data-checked:bg-muted/60"
                >
                  <Checkbox
                    checked={ciudades.includes(c.id)}
                    onCheckedChange={(v) => alternar(c.id, v)}
                    disabled={ocupado}
                  />
                  <span className="flex flex-col leading-tight">
                    {c.nombre}
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {c.latitud}, {c.longitud}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <Campo etiqueta="Fecha inicial (UTC)" htmlFor="fecha-inicio">
              <Input
                id="fecha-inicio"
                type="date"
                value={inicio}
                onChange={(e) => setInicio(e.target.value)}
                disabled={ocupado}
                aria-invalid={intentado && errores.length > 0}
              />
            </Campo>
            <Campo etiqueta="Fecha final (UTC, incluida)" htmlFor="fecha-fin">
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

          <div className="rounded-lg bg-muted/60 px-3 py-2 text-sm" aria-live="polite">
            <span className="font-medium">Volumen previsto: </span>
            {dias > 0 ? (
              <>
                {formatearNumero(ciudades.length)} peticiones · {dias} días × 24 h ×{" "}
                {ciudades.length} ciudades ={" "}
                <strong className="tabular-nums">{formatearNumero(dias * 24 * ciudades.length)}</strong>{" "}
                registros horarios
              </>
            ) : (
              <span className="text-muted-foreground">corrige la configuración (máximo {MAX_DIAS} días).</span>
            )}
          </div>

          <ListaMensajes mensajes={errores} tono="error" />
          <ListaMensajes mensajes={avisos} tono="aviso" />

          <Button type="submit" size="lg" disabled={ocupado} className="self-start">
            <DownloadCloudIcon data-icon="inline-start" />
            {ext?.estado === "en_curso" ? "Extrayendo…" : "Extraer datos"}
          </Button>
        </form>

        <section aria-label="Progreso de la extracción" className="flex flex-col gap-3">
          <h3 className="text-xs font-medium text-muted-foreground">Peticiones a Open-Meteo</h3>
          {!ext ? (
            <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Aún no se ha extraído nada. Pulsa «Extraer datos» para lanzar una petición por ciudad.
            </p>
          ) : (
            <>
              <p className="text-sm" aria-live="polite">
                <strong>{procesadas.length}</strong> procesadas ·{" "}
                <strong>{pendientes.length}</strong> pendientes · periodo {ext.inicio} → {ext.fin}
              </p>
              <ul className="flex flex-col divide-y rounded-lg border">
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
                          Reintentar {e.ciudad.nombre}
                        </Button>
                      )}
                    </div>
                    {e.error && <p className="text-xs text-destructive">{e.error}</p>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </CardContent>
    </Card>
  )
}
