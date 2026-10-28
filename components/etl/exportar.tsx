"use client"

import * as React from "react"
import { DownloadIcon, FileJsonIcon, FileSpreadsheetIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { descargarArchivo, type FormatoExportacion } from "@/lib/etl/exportar"
import { formatearNumero } from "@/lib/etl/formato"

type Filas = readonly Record<string, unknown>[]

/**
 * Menú para descargar unas filas en CSV (Excel, pandas…) o JSON. `obtener` puede ser asíncrono
 * (p. ej. leer toda la tabla de Supabase); mientras tanto se muestra un aviso de progreso.
 */
export function BotonExportar({
  nombre,
  obtener,
  total,
  etiqueta = "Exportar",
}: {
  /** Nombre del archivo sin extensión. */
  nombre: string
  obtener: () => Filas | Promise<Filas>
  /** Filas que se van a exportar, para el menú. Si es 0 el botón se desactiva. */
  total: number
  etiqueta?: string
}) {
  const [ocupado, setOcupado] = React.useState(false)

  const exportar = async (formato: FormatoExportacion) => {
    const resultado = obtener()
    if (!(resultado instanceof Promise)) {
      descargarArchivo(nombre, resultado, formato)
      return
    }
    setOcupado(true)
    const id = toast.loading(`Preparando ${formatearNumero(total)} filas…`)
    try {
      const filas = await resultado
      descargarArchivo(nombre, filas, formato)
      toast.success(`Descargado ${nombre}.${formato}`, { id, description: `${formatearNumero(filas.length)} filas` })
    } catch (e) {
      toast.error("No se pudo exportar", { id, description: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={total === 0 || ocupado} />}>
        <DownloadIcon data-icon="inline-start" />
        {etiqueta}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{formatearNumero(total)} filas</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => void exportar("csv")}>
            <FileSpreadsheetIcon />
            CSV
            <span className="ml-auto text-xs text-muted-foreground">Excel, pandas</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => void exportar("json")}>
            <FileJsonIcon />
            JSON
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
