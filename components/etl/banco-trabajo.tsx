"use client"

import * as React from "react"
import { EyeIcon, LoaderCircleIcon, UploadCloudIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { formatearNumero } from "@/lib/etl/formato"
import { usePipelineEtl } from "@/hooks/use-pipeline-etl"
import { PestanaCarga, progresoCarga, ProgresoCarga, type EstadoServidor } from "./carga"
import { Configuracion, PasoNumero } from "./configuracion"
import { PestanaDestino } from "./destino"
import { PestanaJson, PestanaRechazados, PestanaTransformados } from "./inspeccion"
import { CabeceraFase, calcularFases, PasosPipeline, type Pestana } from "./pipeline"
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

/** Avisos emergentes cuando termina algo que puede pasar mientras se mira otra parte de la página. */
function useAvisos(etl: ReturnType<typeof usePipelineEtl>, ir: (p: Pestana) => void) {
  const { procesado, extraccion, carga } = etl
  const ultimoProcesado = React.useRef(procesado)
  React.useEffect(() => {
    if (procesado === ultimoProcesado.current) return
    ultimoProcesado.current = procesado
    if (!procesado || !extraccion) return
    const fallidas = Object.values(extraccion.porCiudad).filter((e) => e.estado === "error")
    const descripcion = `${formatearNumero(procesado.validos.length)} válidos · ${formatearNumero(procesado.rechazados.length)} rechazados`
    if (fallidas.length > 0) {
      toast.warning(`${fallidas.length} de ${extraccion.ciudades.length} ciudades fallaron`, {
        description: `${fallidas.map((e) => e.ciudad.nombre).join(", ")}. Puedes reintentarlas. ${descripcion}.`,
        action: { label: "Ver JSON", onClick: () => ir("json") },
      })
    } else {
      toast.success("Datos extraídos y limpios", {
        description: descripcion,
        action: { label: "Seleccionar", onClick: () => ir("validos") },
      })
    }
  }, [procesado, extraccion, ir])

  const estadoCarga = carga?.estado
  const ultimoEstadoCarga = React.useRef(estadoCarga)
  React.useEffect(() => {
    const antes = ultimoEstadoCarga.current
    ultimoEstadoCarga.current = estadoCarga
    if (antes !== "en_curso" || !carga || estadoCarga === "en_curso") return
    const { terminados } = progresoCarga(carga)
    if (estadoCarga === "completada") {
      toast.success("Carga completada", {
        description: `${formatearNumero(terminados)} registros guardados y verificados en Supabase.`,
        action: { label: "Ver destino", onClick: () => ir("supabase") },
      })
    } else {
      toast.error("La carga terminó con errores", {
        description: "Algún lote falló o no se pudo verificar. Puedes reintentar solo los fallidos.",
        action: { label: "Ver lotes", onClick: () => ir("carga") },
      })
    }
  }, [estadoCarga, carga, ir])
}

/** Acceso directo a la carga, fijo abajo para que esté siempre a mano. */
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
            ? "Selecciona registros en el paso 4 · Selección."
            : null
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 px-4 animate-in fade-in slide-in-from-bottom-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border bg-card/95 p-3 pl-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3" role="status">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            {etl.cargaEnCurso ? (
              <LoaderCircleIcon className="size-4 animate-spin" />
            ) : (
              <UploadCloudIcon className="size-4" />
            )}
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p>
              <strong className="tabular-nums">{formatearNumero(n)}</strong> registros listos para subir
            </p>
            {etl.cargaEnCurso && etl.carga ? (
              <ProgresoCarga carga={etl.carga} className="mt-1 gap-x-2 gap-y-1" />
            ) : (
              motivo && <p className="truncate text-xs text-muted-foreground">{motivo}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:ml-auto sm:flex-nowrap">
          <Button variant="ghost" onClick={alVerPrevia} className="rounded-full">
            <EyeIcon data-icon="inline-start" />
            Vista previa
          </Button>
          <Button
            onClick={() => {
              alVerPrevia()
              void etl.subir()
            }}
            disabled={motivo !== null}
            className="rounded-full px-4"
          >
            <UploadCloudIcon data-icon="inline-start" />
            {etl.cargaEnCurso ? "Subiendo…" : "Subir a Supabase"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function BancoTrabajo() {
  const etl = usePipelineEtl()
  const [pestana, setPestana] = React.useState<Pestana>("json")
  const [servidor, comprobar] = useEstadoServidor(etl.versionDestino)
  const zonaPipeline = React.useRef<HTMLElement>(null)

  const inspeccionar = React.useCallback((p: Pestana) => {
    setPestana(p)
    zonaPipeline.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])
  useAvisos(etl, inspeccionar)

  const fases = calcularFases(etl, servidor)
  const indiceActiva = fases.findIndex((f) => f.pestana === pestana)
  const activa = fases[indiceActiva]
  const siguiente = fases[indiceActiva + 1]

  return (
    <div className="flex flex-col gap-10">
      <Configuracion etl={etl} />

      <section ref={zonaPipeline} aria-labelledby="titulo-pipeline" className="flex scroll-mt-4 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="titulo-pipeline" className="flex items-center gap-2 text-lg font-semibold">
            <PasoNumero>2</PasoNumero>
            Sigue el pipeline
          </h2>
          <p className="text-sm text-muted-foreground">
            Cada paso muestra su resultado. Púlsalo para ver sus datos y lo que ha hecho con ellos.
          </p>
        </div>

        <Tabs value={pestana} onValueChange={(v) => setPestana(v as Pestana)} className="min-w-0 gap-3">
          <PasosPipeline fases={fases} />
          <div className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm">
            <CabeceraFase
              fase={activa}
              siguiente={siguiente}
              alSiguiente={siguiente && (() => setPestana(siguiente.pestana))}
            />
            <div className="p-3 sm:p-5">
              <TabsContent value="json">
                <PestanaJson etl={etl} />
              </TabsContent>
              <TabsContent value="transformados">
                <PestanaTransformados etl={etl} />
              </TabsContent>
              <TabsContent value="rechazados">
                <PestanaRechazados etl={etl} />
              </TabsContent>
              <TabsContent value="validos">
                <PestanaValidos etl={etl} />
              </TabsContent>
              <TabsContent value="carga">
                <PestanaCarga etl={etl} servidor={servidor} alComprobar={comprobar} />
              </TabsContent>
              <TabsContent value="supabase">
                <PestanaDestino version={etl.versionDestino} pendientes={etl.paraSubir.length} />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </section>

      {etl.procesado && <BarraCarga etl={etl} servidor={servidor} alVerPrevia={() => inspeccionar("carga")} />}
    </div>
  )
}
