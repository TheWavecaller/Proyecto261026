"use client"

import { RotateCwIcon, UploadCloudIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { huellaMediciones } from "@/lib/etl/carga"
import { formatearDuracion, formatearNumero } from "@/lib/etl/formato"
import { claveMedicion } from "@/lib/etl/limpieza"
import type { Carga, PipelineEtl } from "@/hooks/use-pipeline-etl"
import { ListaMensajes } from "./campos"
import { EstadoEtiqueta } from "./estado"
import { BotonExportar } from "./exportar"
import { COLUMNAS_MEDICION, SinDatos } from "./inspeccion"
import { TablaPaginada } from "./tabla-paginada"

export interface EstadoServidor {
  listo: boolean
  mensaje: string
  escrituraPermitida: boolean
  total?: number
}

const ESTADO_LOTE = {
  pendiente: "pendiente",
  en_curso: "en_curso",
  completado: "completada",
  error: "error",
} as const

/** Registros de los lotes ya terminados (bien o mal) sobre el total de la carga. */
export function progresoCarga(carga: Carga) {
  const terminados = carga.lotes
    .filter((l) => l.estado === "completado" || l.estado === "error")
    .reduce((t, l) => t + l.registros.length, 0)
  return { terminados, porcentaje: carga.total === 0 ? 100 : (terminados / carga.total) * 100 }
}

export function ProgresoCarga({ carga, className }: { carga: Carga; className?: string }) {
  const { terminados, porcentaje } = progresoCarga(carga)
  return (
    <Progress value={porcentaje} className={className}>
      <ProgressLabel className="text-xs font-normal text-muted-foreground">
        {formatearNumero(terminados)} de {formatearNumero(carga.total)} registros enviados
      </ProgressLabel>
      <ProgressValue className="text-xs" />
    </Progress>
  )
}

export function PestanaCarga({
  etl,
  servidor,
  alComprobar,
}: {
  etl: PipelineEtl
  servidor: EstadoServidor | null
  alComprobar: () => void
}) {
  const { carga, paraSubir } = etl
  if (!etl.procesado) return <SinDatos>Extrae y selecciona registros para preparar la carga.</SinDatos>

  const ok = carga?.lotes.filter((l) => l.estado === "completado") ?? []
  const fallidos = carga?.lotes.filter((l) => l.estado === "error") ?? []
  const verificables = ok.filter((l) => l.verificacion)
  const presentes = verificables.reduce((t, l) => t + (l.verificacion!.presentes), 0)
  const ausentes = verificables.reduce((t, l) => t + (l.verificacion!.ausentes), 0)
  const erroresVerificacion = ok.filter((l) => l.verificacion?.error)
  const terminada = carga && carga.estado !== "en_curso"
  const bloqueoServidor = !servidor?.listo || !servidor.escrituraPermitida

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <p>
          Esta es la lista <strong>exacta</strong> que se enviará, en el orden elegido (
          {formatearNumero(paraSubir.length)} registros, huella{" "}
          <code className="font-mono text-xs">{huellaMediciones(paraSubir)}</code>). Se envía en lotes
          de hasta 500 y se hace <em>upsert</em> por (ciudad, fecha_hora): repetir la carga actualiza en
          lugar de duplicar.
        </p>
        <p className="mt-1 text-muted-foreground">
          Una base de datos no conserva el orden de inserción: para leer los datos en un orden concreto
          hay que pedirlo siempre con <code className="font-mono text-xs">ORDER BY</code>.
        </p>
      </div>

      {etl.fueraDeFiltros > 0 && (
        <ListaMensajes
          tono="aviso"
          mensajes={[
            `${formatearNumero(etl.fueraDeFiltros)} filas seleccionadas quedan fuera de los filtros y no se incluyen.`,
          ]}
        />
      )}
      {servidor && !servidor.listo && (
        <ListaMensajes tono="error" mensajes={[`Supabase no está disponible: ${servidor.mensaje}`]} />
      )}
      {servidor?.listo && !servidor.escrituraPermitida && (
        <ListaMensajes
          tono="error"
          mensajes={["La escritura está deshabilitada en producción hasta proteger la ruta (ETL_PERMITIR_ESCRITURA)."]}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="lg"
          onClick={() => void etl.subir()}
          disabled={paraSubir.length === 0 || etl.cargaEnCurso || bloqueoServidor}
        >
          <UploadCloudIcon data-icon="inline-start" />
          {etl.cargaEnCurso
            ? "Subiendo…"
            : `Subir ${formatearNumero(paraSubir.length)} registros a Supabase`}
        </Button>
        {fallidos.length > 0 && terminada && (
          <Button variant="outline" size="lg" onClick={() => void etl.reintentarLotesFallidos()}>
            <RotateCwIcon data-icon="inline-start" />
            Reintentar {fallidos.length} lotes fallidos
          </Button>
        )}
        {erroresVerificacion.length > 0 && fallidos.length === 0 && terminada && (
          <Button variant="outline" size="lg" onClick={() => void etl.reintentarLotesFallidos()}>
            <RotateCwIcon data-icon="inline-start" />
            Repetir verificación
          </Button>
        )}
        {bloqueoServidor && (
          <Button variant="ghost" size="sm" onClick={alComprobar}>
            Comprobar conexión de nuevo
          </Button>
        )}
      </div>

      {carga && (
        <section aria-label="Estado de la carga" className="flex flex-col gap-2 rounded-xl border p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <h3 className="font-semibold">Carga en curso o última carga</h3>
            <EstadoEtiqueta estado={carga.estado} />
            <span className="text-muted-foreground tabular-nums">{formatearDuracion(carga.duracionMs)}</span>
          </div>
          <ProgresoCarga carga={carga} />
          <p className="text-xs text-muted-foreground">
            Copia congelada al pulsar el botón: {formatearNumero(carga.total)} registros · huella vista
            previa <code className="font-mono">{carga.huellaVistaPrevia}</code> · huella enviada{" "}
            <code className="font-mono">{carga.huellaCongelada}</code>{" "}
            {carga.huellaVistaPrevia === carga.huellaCongelada ? "(coinciden)" : "(NO coinciden)"}. Cambiar
            los filtros ahora no altera esta carga.
          </p>
          <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
            {carga.lotes.map((l) => (
              <li key={l.numero} className="flex flex-col gap-1 rounded-lg border px-2.5 py-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    Lote {l.numero} · {formatearNumero(l.registros.length)} reg.
                  </span>
                  <EstadoEtiqueta estado={ESTADO_LOTE[l.estado]} />
                </div>
                {l.intentos > 1 && <span className="text-muted-foreground">{l.intentos} intentos</span>}
                {l.estado === "completado" && (
                  <span>
                    {formatearNumero(l.procesados ?? 0)} filas devueltas por el upsert · huella del servidor{" "}
                    <code className="font-mono">{l.huellaServidor}</code>
                  </span>
                )}
                {l.verificacion && !l.verificacion.error && (
                  <span>
                    Verificación: {formatearNumero(l.verificacion.presentes)} presentes
                    {l.verificacion.ausentes > 0 && `, ${formatearNumero(l.verificacion.ausentes)} AUSENTES`}
                  </span>
                )}
                {l.verificacion?.error && (
                  <span className="text-destructive">Verificación fallida: {l.verificacion.error}</span>
                )}
                {l.error && <span className="text-destructive">{l.error}</span>}
              </li>
            ))}
          </ol>
          {terminada && (
            <div role="status" className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <strong>Informe final:</strong>{" "}
              {formatearNumero(ok.reduce((t, l) => t + l.registros.length, 0))} registros procesados
              correctamente en {ok.length} lotes ·{" "}
              {formatearNumero(fallidos.reduce((t, l) => t + l.registros.length, 0))} fallidos en{" "}
              {fallidos.length} lotes · verificados en destino {formatearNumero(presentes)}
              {ausentes > 0 && ` · ${formatearNumero(ausentes)} no encontrados`}.
              <span className="block text-xs text-muted-foreground">
                Supabase no indica en un upsert qué filas se insertaron y cuáles se actualizaron, así que
                no se muestran esos recuentos por separado.
              </span>
            </div>
          )}
        </section>
      )}

      <TablaPaginada
        filas={paraSubir}
        columnas={COLUMNAS_MEDICION}
        claveFila={claveMedicion}
        numerar
        etiquetaNumero="Orden"
        ordenable={false}
        buscar
        acciones={
          <BotonExportar
            nombre="vista-previa-carga"
            total={paraSubir.length}
            obtener={() => paraSubir as unknown as Record<string, unknown>[]}
          />
        }
        vacio="No hay registros seleccionados dentro de los filtros. Selecciónalos en el paso 4 · Selección."
      />
    </div>
  )
}
