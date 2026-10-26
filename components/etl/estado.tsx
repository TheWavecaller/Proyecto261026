import { CircleAlertIcon, CircleCheckIcon, CircleDashedIcon, LoaderCircleIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import type { EstadoFase } from "@/lib/etl/tipos"

const ESTADOS: Record<
  EstadoFase,
  { texto: string; icono: typeof CircleCheckIcon; clase: string }
> = {
  pendiente: {
    texto: "Pendiente",
    icono: CircleDashedIcon,
    clase: "border-border text-muted-foreground",
  },
  en_curso: {
    texto: "En curso",
    icono: LoaderCircleIcon,
    clase: "border-sky-600/40 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  },
  completada: {
    texto: "Completada",
    icono: CircleCheckIcon,
    clase:
      "border-emerald-600/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  },
  error: {
    texto: "Con errores",
    icono: CircleAlertIcon,
    clase: "border-destructive/40 bg-destructive/10 text-destructive",
  },
}

/** Estado con icono y texto: no depende solo del color. */
export function EstadoEtiqueta({
  estado,
  texto,
  className,
}: {
  estado: EstadoFase
  texto?: string
  className?: string
}) {
  const { texto: base, icono: Icono, clase } = ESTADOS[estado]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        clase,
        className
      )}
    >
      <Icono aria-hidden className={cn("size-3.5", estado === "en_curso" && "animate-spin")} />
      {texto ?? base}
    </span>
  )
}
