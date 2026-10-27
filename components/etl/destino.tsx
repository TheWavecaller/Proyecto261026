"use client"

import * as React from "react"
import { DatabaseIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CIUDADES } from "@/lib/etl/ciudades"
import { formatearFechaUtc, formatearNumero } from "@/lib/etl/formato"
import { Campo, ListaMensajes, Selector } from "./campos"
import { CAMPOS_ORDEN } from "./seleccion"
import { Paginacion } from "./tabla-paginada"

interface FilaDestino {
  id: number
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
  importado_en: string
}

/** Lectura real de la tabla a través del servidor. Nada de lo que se ve aquí es estado local. */
export function PestanaDestino({ version, pendientes }: { version: number; pendientes: number }) {
  const [ciudad, setCiudad] = React.useState("")
  const [desde, setDesde] = React.useState("")
  const [hasta, setHasta] = React.useState("")
  const [orden, setOrden] = React.useState("fecha_hora")
  const [dir, setDir] = React.useState<"asc" | "desc">("asc")
  const [pagina, setPagina] = React.useState(0)
  const [tamano, setTamano] = React.useState(25)
  const [recarga, setRecarga] = React.useState(0)
  const [resultado, setResultado] = React.useState<{ filas: FilaDestino[]; total: number; leidoEn: Date } | null>(null)
  const [respondida, setRespondida] = React.useState<{ clave: string; error: string | null } | null>(null)

  const params = new URLSearchParams({ orden, dir, pagina: String(pagina), tam: String(tamano) })
  if (ciudad) params.set("ciudad", ciudad)
  if (desde) params.set("desde", `${desde}:00Z`)
  if (hasta) params.set("hasta", `${hasta}:00Z`)
  const consulta = params.toString()
  // Cada lectura se identifica por su consulta y por los contadores de recarga.
  const clave = `${consulta}#${recarga}#${version}`
  const cargando = respondida?.clave !== clave
  const error = respondida?.error ?? null

  React.useEffect(() => {
    const control = new AbortController()
    fetch(`/api/mediciones?${consulta}`, { signal: control.signal, cache: "no-store" })
      .then(async (res) => {
        const cuerpo = await res.json()
        if (!res.ok) throw new Error(cuerpo.error ?? `HTTP ${res.status}`)
        setResultado({ filas: cuerpo.filas, total: cuerpo.total, leidoEn: new Date() })
        setRespondida({ clave, error: null })
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setRespondida({ clave, error: e.message })
      })
    return () => control.abort()
  }, [consulta, clave])

  const filtrar = <T,>(fijar: (v: T) => void) => (v: T) => {
    fijar(v)
    setPagina(0)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-start gap-2 rounded-lg border border-exito/30 bg-exito-suave px-3 py-2">
          <DatabaseIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            <strong>Datos persistidos:</strong> lectura real de la tabla{" "}
            <code className="font-mono text-xs">mediciones_meteorologicas</code>
            {resultado && ` · ${formatearNumero(resultado.total)} filas con estos filtros`}.
          </p>
        </div>
        <div className="rounded-lg border border-dashed px-3 py-2">
          <strong>Datos locales pendientes:</strong> {formatearNumero(pendientes)} registros seleccionados
          en esta sesión del navegador. No están en Supabase hasta que se suban.
        </div>
      </div>

      <div className="grid items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Campo etiqueta="Ciudad" htmlFor="destino-ciudad">
          <Selector id="destino-ciudad" value={ciudad} onChange={(e) => filtrar(setCiudad)(e.target.value)}>
            <option value="">Todas</option>
            {CIUDADES.map((c) => (
              <option key={c.id} value={c.nombre}>
                {c.nombre}
              </option>
            ))}
          </Selector>
        </Campo>
        <Campo etiqueta="Desde (UTC)" htmlFor="destino-desde">
          <Input id="destino-desde" type="datetime-local" value={desde} onChange={(e) => filtrar(setDesde)(e.target.value)} />
        </Campo>
        <Campo etiqueta="Hasta (UTC)" htmlFor="destino-hasta">
          <Input id="destino-hasta" type="datetime-local" value={hasta} onChange={(e) => filtrar(setHasta)(e.target.value)} />
        </Campo>
        <Campo etiqueta="Ordenar por (ORDER BY)" htmlFor="destino-orden">
          <Selector id="destino-orden" value={orden} onChange={(e) => filtrar(setOrden)(e.target.value)}>
            {CAMPOS_ORDEN.map((c) => (
              <option key={c.valor} value={c.valor}>
                {c.texto}
              </option>
            ))}
            <option value="importado_en">Importado en</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Dirección" htmlFor="destino-dir">
          <Selector id="destino-dir" value={dir} onChange={(e) => filtrar(setDir)(e.target.value as "asc" | "desc")}>
            <option value="asc">Ascendente</option>
            <option value="desc">Descendente</option>
          </Selector>
        </Campo>
        <Button variant="outline" onClick={() => setRecarga((n) => n + 1)} disabled={cargando}>
          <RefreshCwIcon data-icon="inline-start" className={cargando ? "animate-spin" : undefined} />
          Actualizar
        </Button>
      </div>

      {error && <ListaMensajes tono="error" mensajes={[error]} />}
      {resultado && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Leído a las {resultado.leidoEn.toLocaleTimeString("es-ES")}
          {cargando && " · actualizando…"}
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-right">id</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Fecha y hora (UTC)</TableHead>
              <TableHead className="text-right">Temperatura (°C)</TableHead>
              <TableHead className="text-right">Humedad (%)</TableHead>
              <TableHead className="text-right">Precipitación (mm)</TableHead>
              <TableHead>Importado en (UTC)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!resultado || resultado.filas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-20 text-center text-muted-foreground">
                  {cargando ? "Leyendo Supabase…" : error ? "No se pudo leer la tabla." : "No hay filas almacenadas con estos filtros."}
                </TableCell>
              </TableRow>
            ) : (
              resultado.filas.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="text-right text-muted-foreground tabular-nums">{f.id}</TableCell>
                  <TableCell>{f.ciudad}</TableCell>
                  <TableCell>{formatearFechaUtc(f.fecha_hora)}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.temperatura_c.toFixed(1)}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.humedad_pct}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.precipitacion_mm.toFixed(2)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatearFechaUtc(f.importado_en)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Paginacion
        pagina={pagina}
        totalPaginas={Math.ceil((resultado?.total ?? 0) / tamano)}
        total={resultado?.total ?? 0}
        tamano={tamano}
        alCambiarPagina={setPagina}
        alCambiarTamano={filtrar(setTamano)}
      />
    </div>
  )
}
