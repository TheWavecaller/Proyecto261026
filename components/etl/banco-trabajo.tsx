"use client"

import * as React from "react"
import { EyeIcon, UploadCloudIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatearNumero } from "@/lib/etl/formato"
import { usePipelineEtl } from "@/hooks/use-pipeline-etl"
import { PestanaCarga, type EstadoServidor } from "./carga"
import { Configuracion } from "./configuracion"
import { PestanaDestino } from "./destino"
import { PestanaJson, PestanaRechazados, PestanaTransformados } from "./inspeccion"
import { Contadores, Pipeline, type Pestana } from "./pipeline"
import { PestanaValidos } from "./seleccion"

function useEstadoServidor(version: number) {
  const [estado, setEstado] = React.useState<EstadoServidor | null>(null)
  const [comprobacion, setComprobacion] = React.useState(0)
  React.useEffect(() => {
    let vigente = true
    fetch("/api/estado", { cache: "no-store" })
      .then((r) => r.json())
      .then((e: EstadoServidor) => vigente && setEstado(e))
      .catch((e: Error) =>
        vigente && setEstado({ listo: false, escrituraPermitida: false, mensaje: e.message })
      )
    return () => {
      vigente = false
    }
  }, [version, comprobacion])
  return [estado, () => setComprobacion((n) => n + 1)] as const
}

/** Acceso directo a la carga, visible sin entrar en la pestaña de vista previa. */
function BarraCarga({
  etl,
  servidor,
  alVerPrevia,
}: {
  etl: ReturnType<typeof usePipelineEtl>
  servidor: EstadoServidor | null
  alVerPrevia: () => void
}) {
  const n = etl.paraSubir.length
  const motivo = etl.cargaEnCurso
    ? "Carga en curso…"
    : !servidor
      ? "Comprobando la conexión con Supabase…"
      : !servidor.listo
        ? `Supabase no está disponible: ${servidor.mensaje}`
        : !servidor.escrituraPermitida
          ? "Escritura deshabilitada en producción (ETL_PERMITIR_ESCRITURA)."
          : n === 0
            ? "Selecciona registros en la pestaña «Registros válidos»."
            : null
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:items-center">
      <p className="text-sm" role="status">
        <strong className="tabular-nums">{formatearNumero(n)}</strong> registros listos para subir.
        {motivo && <span className="block text-xs text-muted-foreground">{motivo}</span>}
      </p>
      <div className="flex flex-wrap gap-2 sm:ml-auto">
        <Button variant="outline" onClick={alVerPrevia}>
          <EyeIcon data-icon="inline-start" />
          Ver vista previa
        </Button>
        <Button
          onClick={() => {
            alVerPrevia()
            void etl.subir()
          }}
          disabled={motivo !== null}
        >
          <UploadCloudIcon data-icon="inline-start" />
          {etl.cargaEnCurso ? "Subiendo…" : `Subir ${formatearNumero(n)} registros a Supabase`}
        </Button>
      </div>
    </div>
  )
}

export function BancoTrabajo() {
  const etl = usePipelineEtl()
  const [pestana, setPestana] = React.useState<Pestana>("json")
  const [servidor, comprobar] = useEstadoServidor(etl.versionDestino)
  const zonaInspeccion = React.useRef<HTMLElement>(null)

  const inspeccionar = (p: Pestana) => {
    setPestana(p)
    zonaInspeccion.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const p = etl.procesado
  const pestanas: { valor: Pestana; texto: string; cuenta?: number }[] = [
    { valor: "json", texto: "JSON original" },
    { valor: "transformados", texto: "Transformados", cuenta: p?.transformadas.length },
    { valor: "validos", texto: "Registros válidos", cuenta: p?.validos.length },
    { valor: "rechazados", texto: "Rechazados", cuenta: p?.rechazados.length },
    { valor: "carga", texto: "Vista previa de la carga", cuenta: p ? etl.paraSubir.length : undefined },
    { valor: "supabase", texto: "Datos en Supabase", cuenta: servidor?.total },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Configuracion etl={etl} />
      <Pipeline etl={etl} alInspeccionar={inspeccionar} />
      <Contadores etl={etl} />
      {p && <BarraCarga etl={etl} servidor={servidor} alVerPrevia={() => inspeccionar("carga")} />}

      <section ref={zonaInspeccion} aria-labelledby="titulo-inspeccion" className="flex scroll-mt-4 flex-col gap-3">
        <h2 id="titulo-inspeccion" className="text-base font-semibold">
          3. Inspección de datos
        </h2>
        <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)} className="min-w-0">
          <div className="overflow-x-auto pb-1">
            <TabsList>
              {pestanas.map((t) => (
                <TabsTrigger key={t.valor} value={t.valor} className="px-2.5">
                  {t.texto}
                  {t.cuenta !== undefined && (
                    <span className="rounded bg-muted px-1 text-xs tabular-nums text-muted-foreground">
                      {formatearNumero(t.cuenta)}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <div className="min-w-0 rounded-xl border bg-card p-3 sm:p-4">
            <TabsContent value="json">
              <PestanaJson etl={etl} />
            </TabsContent>
            <TabsContent value="transformados">
              <PestanaTransformados etl={etl} />
            </TabsContent>
            <TabsContent value="validos">
              <PestanaValidos etl={etl} />
            </TabsContent>
            <TabsContent value="rechazados">
              <PestanaRechazados etl={etl} />
            </TabsContent>
            <TabsContent value="carga">
              <PestanaCarga etl={etl} servidor={servidor} alComprobar={comprobar} />
            </TabsContent>
            <TabsContent value="supabase">
              <PestanaDestino version={etl.versionDestino} pendientes={etl.paraSubir.length} />
            </TabsContent>
          </div>
        </Tabs>
      </section>
    </div>
  )
}
