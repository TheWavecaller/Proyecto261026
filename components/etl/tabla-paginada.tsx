"use client"

import * as React from "react"
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Columns3Icon,
  SearchIcon,
  XIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
  /** Nombre en texto para el menú de columnas, si el título no es texto. */
  nombre?: string
  celda: (fila: T) => React.ReactNode
  /** Valor para ordenar y buscar. Sin él, la columna no se puede ordenar. */
  valor?: (fila: T) => string | number | null | undefined
  numerica?: boolean
  className?: string
}

export interface SeleccionTabla {
  seleccionadas: ReadonlySet<string>
  alternar: (claves: string[], seleccionar: boolean) => void
}

export type Direccion = "asc" | "desc"

export interface OrdenTabla {
  columna: string
  direccion: Direccion
}

const TAMANOS = [25, 50, 100, 250]

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
  const ultima = Math.max(0, totalPaginas - 1)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        Filas {formatearNumero(desde)}–{formatearNumero(hasta)} de {formatearNumero(total)}
      </span>
      <div className="flex items-center gap-1.5">
        <label className="mr-1 flex items-center gap-1">
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
          aria-label="Primera página"
          disabled={pagina === 0}
          onClick={() => alCambiarPagina(0)}
        >
          <ChevronsLeftIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página anterior"
          disabled={pagina === 0}
          onClick={() => alCambiarPagina(pagina - 1)}
        >
          <ChevronLeftIcon />
        </Button>
        <span className="px-1 tabular-nums">
          {pagina + 1} / {Math.max(1, totalPaginas)}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Página siguiente"
          disabled={pagina >= ultima}
          onClick={() => alCambiarPagina(pagina + 1)}
        >
          <ChevronRightIcon />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Última página"
          disabled={pagina >= ultima}
          onClick={() => alCambiarPagina(ultima)}
        >
          <ChevronsRightIcon />
        </Button>
      </div>
    </div>
  )
}

/** Cabecera que ordena al pulsarla: primero ascendente y, si ya lo está, descendente. */
export function CabeceraOrdenable({
  titulo,
  direccion,
  alPulsar,
  numerica,
  className,
}: {
  titulo: React.ReactNode
  direccion: Direccion | null
  alPulsar?: () => void
  numerica?: boolean
  className?: string
}) {
  const Icono = direccion === "asc" ? ArrowUpIcon : direccion === "desc" ? ArrowDownIcon : ArrowUpDownIcon
  return (
    <TableHead
      scope="col"
      aria-sort={direccion === "asc" ? "ascending" : direccion === "desc" ? "descending" : undefined}
      className={cn(numerica && "text-right", className)}
    >
      {alPulsar ? (
        <button
          type="button"
          onClick={alPulsar}
          title="Ordenar por esta columna"
          className={cn(
            "-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            numerica && "flex-row-reverse",
            direccion && "text-foreground"
          )}
        >
          {titulo}
          <Icono className={cn("size-3.5", !direccion && "opacity-40")} />
        </button>
      ) : (
        titulo
      )}
    </TableHead>
  )
}

/** Alterna el orden de una columna: si ya es la activa invierte la dirección; si no, empieza asc. */
export function siguienteOrden(actual: OrdenTabla | null, columna: string): OrdenTabla {
  return actual?.columna === columna
    ? { columna, direccion: actual.direccion === "asc" ? "desc" : "asc" }
    : { columna, direccion: "asc" }
}

function comparar(a: string | number | null | undefined, b: string | number | null | undefined) {
  // Los vacíos van siempre al final, sea cual sea la dirección.
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1
  if (b === null || b === undefined) return -1
  if (typeof a === "number" && typeof b === "number") return a - b
  return String(a).localeCompare(String(b), "es", { numeric: true })
}

/**
 * Tabla que recibe TODAS las filas y solo pagina la visualización.
 * - Con `orden`, la ordenación la controla quien la usa (las filas ya llegan ordenadas).
 * - Sin `orden`, pulsar una cabecera ordena localmente la vista.
 * - Con `seleccion`, añade casillas por fila y para la página visible.
 * - Con `buscar`, filtra la vista por texto en las columnas visibles.
 * - Con `ordenable={false}`, las cabeceras no ordenan: se respeta el orden recibido.
 */
export function TablaPaginada<T>({
  filas,
  columnas,
  claveFila,
  seleccion,
  orden,
  buscar = false,
  ordenable = true,
  acciones,
  vacio,
  numerar = false,
  etiquetaNumero = "#",
}: {
  filas: readonly T[]
  columnas: Columna<T>[]
  claveFila: (fila: T) => string
  seleccion?: SeleccionTabla
  orden?: OrdenTabla & { alCambiar: (columna: string) => void }
  buscar?: boolean
  /** false cuando el orden de las filas tiene significado propio (p. ej. el orden de envío). */
  ordenable?: boolean
  acciones?: React.ReactNode
  vacio: React.ReactNode
  numerar?: boolean
  etiquetaNumero?: string
}) {
  const [pagina, setPagina] = React.useState(0)
  const [tamano, setTamano] = React.useState(25)
  const [busqueda, setBusqueda] = React.useState("")
  const [ordenLocal, setOrdenLocal] = React.useState<OrdenTabla | null>(null)
  const [ocultas, setOcultas] = React.useState<ReadonlySet<string>>(new Set())

  const visiblesCol = columnas.filter((c) => !ocultas.has(c.id))
  const ordenActivo = orden ?? ordenLocal

  const vista = React.useMemo(() => {
    let resultado: readonly T[] = filas
    const texto = busqueda.trim().toLocaleLowerCase("es")
    if (texto) {
      const buscables = columnas.filter((c) => c.valor && !ocultas.has(c.id))
      resultado = resultado.filter((f) =>
        buscables.some((c) => String(c.valor!(f) ?? "").toLocaleLowerCase("es").includes(texto))
      )
    }
    const col = !orden && ordenLocal ? columnas.find((c) => c.id === ordenLocal.columna) : undefined
    if (col?.valor) {
      const signo = ordenLocal!.direccion === "asc" ? 1 : -1
      resultado = [...resultado].sort((a, b) => {
        const va = col.valor!(a)
        const vb = col.valor!(b)
        // Los vacíos quedan al final también en descendente.
        if (va === null || va === undefined || vb === null || vb === undefined) return comparar(va, vb)
        return signo * comparar(va, vb)
      })
    }
    return resultado
  }, [filas, columnas, busqueda, orden, ordenLocal, ocultas])

  const [vistaPrevia, setVistaPrevia] = React.useState(vista)
  if (vista !== vistaPrevia) {
    // Si cambia el conjunto (filtros, orden, búsqueda…), volvemos a la primera página.
    setVistaPrevia(vista)
    setPagina(0)
  }

  const totalPaginas = Math.ceil(vista.length / tamano)
  const paginaActual = Math.min(pagina, Math.max(0, totalPaginas - 1))
  const visibles = vista.slice(paginaActual * tamano, (paginaActual + 1) * tamano)
  const clavesVisibles = visibles.map(claveFila)
  const marcadasEnPagina = seleccion
    ? clavesVisibles.filter((c) => seleccion.seleccionadas.has(c)).length
    : 0

  const alOrdenar = (id: string) =>
    orden ? orden.alCambiar(id) : setOrdenLocal((o) => siguienteOrden(o, id))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {buscar && (
          <div className="relative w-full sm:w-64">
            <SearchIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar en la tabla…"
              aria-label="Buscar en la tabla"
              className="pr-8 pl-8"
            />
            {busqueda && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Borrar búsqueda"
                className="absolute top-1/2 right-1.5 -translate-y-1/2"
                onClick={() => setBusqueda("")}
              >
                <XIcon />
              </Button>
            )}
          </div>
        )}
        {busqueda.trim() && (
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {formatearNumero(vista.length)} de {formatearNumero(filas.length)} filas coinciden
          </span>
        )}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {acciones}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
              <Columns3Icon data-icon="inline-start" />
              Columnas
              {ocultas.size > 0 && <span className="text-muted-foreground">({visiblesCol.length})</span>}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Columnas visibles</DropdownMenuLabel>
                {columnas.map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={!ocultas.has(c.id)}
                    // Siempre queda al menos una columna visible.
                    disabled={!ocultas.has(c.id) && visiblesCol.length === 1}
                    onCheckedChange={(v) =>
                      setOcultas((prev) => {
                        const s = new Set(prev)
                        if (v) s.delete(c.id)
                        else s.add(c.id)
                        return s
                      })
                    }
                  >
                    {c.nombre ?? c.titulo}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

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
              {visiblesCol.map((c) => (
                <CabeceraOrdenable
                  key={c.id}
                  titulo={c.titulo}
                  numerica={c.numerica}
                  className={c.className}
                  direccion={ordenActivo?.columna === c.id ? ordenActivo.direccion : null}
                  alPulsar={ordenable && (c.valor || orden) ? () => alOrdenar(c.id) : undefined}
                />
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={visiblesCol.length + (seleccion ? 1 : 0) + (numerar ? 1 : 0)}
                  className="h-20 text-center whitespace-normal text-muted-foreground"
                >
                  {busqueda.trim() && filas.length > 0 ? "Ninguna fila coincide con la búsqueda." : vacio}
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
                    {visiblesCol.map((c) => (
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
        total={vista.length}
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
