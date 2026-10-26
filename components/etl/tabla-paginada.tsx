"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatearNumero } from "@/lib/etl/formato"
import { Selector } from "./campos"

export interface Columna<T> {
  id: string
  titulo: React.ReactNode
  celda: (fila: T) => React.ReactNode
  numerica?: boolean
  className?: string
}

export interface SeleccionTabla {
  seleccionadas: ReadonlySet<string>
  alternar: (claves: string[], seleccionar: boolean) => void
}

const TAMANOS = [25, 50, 100]

export function Paginacion({
  pagina,
  totalPaginas,
  total,
  tamano,
  alCambiarPagina,
  alCambiarTamano,
}: {
  pagina: number
  totalPaginas: number
  total: number
  tamano: number
  alCambiarPagina: (p: number) => void
  alCambiarTamano: (t: number) => void
}) {
  const desde = total === 0 ? 0 : pagina * tamano + 1
  const hasta = Math.min(total, (pagina + 1) * tamano)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        Filas {formatearNumero(desde)}–{formatearNumero(hasta)} de {formatearNumero(total)}
      </span>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1">
          <span className="sr-only sm:not-sr-only">Por página</span>
          <Selector value={tamano} onChange={(e) => alCambiarTamano(Number(e.target.value))}>
            {TAMANOS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Selector>
        </label>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={pagina === 0}
          onClick={() => alCambiarPagina(pagina - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="tabular-nums">
          Página {pagina + 1} de {Math.max(1, totalPaginas)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página siguiente"
          disabled={pagina >= totalPaginas - 1}
          onClick={() => alCambiarPagina(pagina + 1)}
        >
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  )
}

/**
 * Tabla que recibe TODAS las filas ya filtradas y ordenadas y solo pagina la visualización.
 * Con `seleccion`, añade casillas por fila y para la página visible.
 */
export function TablaPaginada<T>({
  filas,
  columnas,
  claveFila,
  seleccion,
  vacio,
  numerar = false,
  etiquetaNumero = "#",
}: {
  filas: readonly T[]
  columnas: Columna<T>[]
  claveFila: (fila: T) => string
  seleccion?: SeleccionTabla
  vacio: React.ReactNode
  numerar?: boolean
  etiquetaNumero?: string
}) {
  const [pagina, setPagina] = React.useState(0)
  const [tamano, setTamano] = React.useState(25)
  const [filasPrevias, setFilasPrevias] = React.useState(filas)
  if (filas !== filasPrevias) {
    // Si cambia el conjunto (filtros, orden…), volvemos a la primera página.
    setFilasPrevias(filas)
    setPagina(0)
  }

  const totalPaginas = Math.ceil(filas.length / tamano)
  const paginaActual = Math.min(pagina, Math.max(0, totalPaginas - 1))
  const visibles = filas.slice(paginaActual * tamano, (paginaActual + 1) * tamano)
  const clavesVisibles = visibles.map(claveFila)
  const marcadasEnPagina = seleccion
    ? clavesVisibles.filter((c) => seleccion.seleccionadas.has(c)).length
    : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {seleccion && (
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Seleccionar las filas de esta página"
                    disabled={visibles.length === 0}
                    checked={visibles.length > 0 && marcadasEnPagina === visibles.length}
                    indeterminate={marcadasEnPagina > 0 && marcadasEnPagina < visibles.length}
                    onCheckedChange={(v) => seleccion.alternar(clavesVisibles, v)}
                  />
                </TableHead>
              )}
              {numerar && <TableHead className="w-14 text-right">{etiquetaNumero}</TableHead>}
              {columnas.map((c) => (
                <TableHead
                  key={c.id}
                  className={cn(c.numerica && "text-right", c.className)}
                  scope="col"
                >
                  {c.titulo}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columnas.length + (seleccion ? 1 : 0) + (numerar ? 1 : 0)}
                  className="h-20 text-center whitespace-normal text-muted-foreground"
                >
                  {vacio}
                </TableCell>
              </TableRow>
            ) : (
              visibles.map((fila, i) => {
                const clave = clavesVisibles[i]
                const marcada = seleccion?.seleccionadas.has(clave) ?? false
                return (
                  <TableRow key={clave} data-state={marcada ? "selected" : undefined}>
                    {seleccion && (
                      <TableCell>
                        <Checkbox
                          aria-label={`Seleccionar ${clave.replace("|", " ")}`}
                          checked={marcada}
                          onCheckedChange={(v) => seleccion.alternar([clave], v)}
                        />
                      </TableCell>
                    )}
                    {numerar && (
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {paginaActual * tamano + i + 1}
                      </TableCell>
                    )}
                    {columnas.map((c) => (
                      <TableCell
                        key={c.id}
                        className={cn(c.numerica && "text-right tabular-nums", c.className)}
                      >
                        {c.celda(fila)}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <Paginacion
        pagina={paginaActual}
        totalPaginas={totalPaginas}
        total={filas.length}
        tamano={tamano}
        alCambiarPagina={setPagina}
        alCambiarTamano={(t) => {
          setTamano(t)
          setPagina(0)
        }}
      />
    </div>
  )
}
