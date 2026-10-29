"use client"

import * as React from "react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CIUDADES } from "@/lib/etl/ciudades"
import { formatearNumero } from "@/lib/etl/formato"
import { perfilMedidas, resumirPorCiudad, type MedidaGrafica } from "@/lib/etl/resumen"
import type { Medicion, Rechazo } from "@/lib/etl/tipos"

const NOMBRE_MEDIDA: Record<MedidaGrafica, string> = {
  temperatura_c: "temperatura_c (°C)",
  humedad_pct: "humedad_pct (%)",
  precipitacion_mm: "precipitacion_mm (mm)",
}

const estadistico = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 })
const porcentaje = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 })

const COLUMNAS_PERFIL = [
  { clave: "media", titulo: "media" },
  { clave: "desviacion", titulo: "desv." },
  { clave: "min", titulo: "mín" },
  { clave: "p25", titulo: "25 %" },
  { clave: "p50", titulo: "50 %" },
  { clave: "p75", titulo: "75 %" },
  { clave: "max", titulo: "máx" },
] as const

/** Estadística descriptiva de las filas filtradas, como `df.describe()` en pandas. */
export function PerfilDatos({ filas }: { filas: readonly Medicion[] }) {
  const perfil = React.useMemo(() => perfilMedidas(filas), [filas])
  if (!perfil) return null
  return (
    <figure className="flex flex-col gap-2 rounded-xl border p-3 sm:p-4">
      <figcaption className="text-sm">
        <span className="font-semibold">Perfil de los datos</span>
        <span className="text-muted-foreground">
          {" "}
          · registros filtrados · equivale a <code className="font-mono text-xs">df.describe()</code>
        </span>
      </figcaption>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead scope="col">Columna</TableHead>
              <TableHead scope="col" className="text-right">
                n
              </TableHead>
              {COLUMNAS_PERFIL.map((c) => (
                <TableHead key={c.clave} scope="col" className="text-right">
                  {c.titulo}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {perfil.map((p) => (
              <TableRow key={p.medida}>
                <TableHead scope="row" className="font-mono text-xs font-medium">
                  {NOMBRE_MEDIDA[p.medida]}
                </TableHead>
                <TableCell className="text-right tabular-nums">{formatearNumero(p.n)}</TableCell>
                {COLUMNAS_PERFIL.map((c) => (
                  <TableCell key={c.clave} className="text-right tabular-nums">
                    {estadistico.format(p[c.clave])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Desviación típica muestral (n − 1) y percentiles con interpolación lineal, igual que pandas. No hay
        nulos: la limpieza ya los ha rechazado.
      </p>
    </figure>
  )
}

/** Proporción de filas válidas por ciudad, para ver si alguna fuente trae peores datos. */
export function CalidadPorCiudad({
  validos,
  rechazados,
}: {
  validos: readonly Medicion[]
  rechazados: readonly Rechazo[]
}) {
  const filas = React.useMemo(() => {
    const resumen = resumirPorCiudad(validos, rechazados)
    const orden = CIUDADES.map((c) => c.nombre)
    return Object.entries(resumen)
      .map(([ciudad, r]) => ({ ciudad, ...r, total: r.validos + r.rechazados }))
      .sort((a, b) => orden.indexOf(a.ciudad) - orden.indexOf(b.ciudad))
  }, [validos, rechazados])
  const sinCiudad = rechazados.filter((r) => !r.fila.ciudad).length
  if (filas.length === 0) return null

  return (
    <figure className="flex flex-col gap-2 rounded-xl border p-3 sm:p-4">
      <figcaption className="text-sm">
        <span className="font-semibold">Calidad por ciudad</span>
        <span className="text-muted-foreground"> · registros transformados que superan la limpieza</span>
      </figcaption>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead scope="col">Ciudad</TableHead>
              <TableHead scope="col" className="text-right">
                Transformados
              </TableHead>
              <TableHead scope="col" className="text-right">
                Válidos
              </TableHead>
              <TableHead scope="col" className="text-right">
                Rechazados
              </TableHead>
              <TableHead scope="col" className="w-48">
                % válidos
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filas.map((f) => {
              const proporcion = f.total === 0 ? 0 : f.validos / f.total
              return (
                <TableRow key={f.ciudad}>
                  <TableHead scope="row" className="font-medium">
                    {f.ciudad}
                  </TableHead>
                  <TableCell className="text-right tabular-nums">{formatearNumero(f.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearNumero(f.validos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatearNumero(f.rechazados)}</TableCell>
                  <TableCell>
                    {/* La cifra va en texto: la barra solo la refuerza. */}
                    <div className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-right text-sm tabular-nums">
                        {porcentaje.format(proporcion)}
                      </span>
                      <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-primary" style={{ width: `${proporcion * 100}%` }} />
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {sinCiudad > 0 && (
        <p className="text-xs text-muted-foreground">
          {formatearNumero(sinCiudad)} rechazados no tienen ciudad y no se asignan a ninguna fila.
        </p>
      )}
    </figure>
  )
}
