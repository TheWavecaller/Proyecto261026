"use client"

import * as React from "react"
import { CheckIcon, CodeIcon, CopyIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { consultaSql, consultaSupabaseJs, lecturaPandas, type ParametrosConsulta } from "@/lib/etl/consulta"

function BloqueCodigo({ titulo, codigo }: { titulo: string; codigo: string }) {
  const [copiado, setCopiado] = React.useState(false)
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      toast.error("No se pudo copiar", { description: "El navegador no permite acceder al portapapeles." })
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
        <Button variant="ghost" size="xs" onClick={() => void copiar()} aria-label={`Copiar ${titulo}`}>
          {copiado ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
          {copiado ? "Copiado" : "Copiar"}
        </Button>
      </div>
      <pre className="max-w-full overflow-x-auto rounded-lg border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
        {codigo}
      </pre>
    </div>
  )
}

/** Consulta equivalente a lo que se ve, lista para copiar a un cuaderno o al SQL Editor. */
export function ConsultaEquivalente({ parametros, className }: { parametros: ParametrosConsulta; className?: string }) {
  return (
    <details className={cn("group rounded-lg border", className)}>
      <summary className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium outline-none select-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50">
        <CodeIcon aria-hidden className="size-4 text-muted-foreground" />
        Consulta equivalente
        <span className="font-normal text-muted-foreground">· SQL, supabase-js y pandas</span>
      </summary>
      <div className="grid gap-3 border-t p-3 lg:grid-cols-2">
        <BloqueCodigo titulo="SQL (Supabase SQL Editor)" codigo={consultaSql(parametros)} />
        <BloqueCodigo titulo="supabase-js" codigo={consultaSupabaseJs(parametros)} />
        <BloqueCodigo titulo="pandas (tras «Exportar tabla» en CSV)" codigo={lecturaPandas()} />
      </div>
    </details>
  )
}
