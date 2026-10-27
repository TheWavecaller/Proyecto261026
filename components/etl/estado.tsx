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
    clase: "border-aviso/30 bg-aviso-suave text-aviso",
  },
  completada: {
    texto: "Completada",
    icono: CircleCheckIcon,
    clase:
      "border-exito/30 bg-exito-suave text-exito",
  },
  error: {
    texto: "Con errores",
    icono: CircleAlertIcon,
    clase: "border-destructive/30 bg-destructive/10 text-destructive",
  },
}

/** Estado con icono y texto: no depende solo del color. */
export function EstadoEtiqueta({
  estado,
  texto,
  soloIcono = false,
  className,
}: {
  estado: EstadoFase
  texto?: string
  /** Muestra solo el icono; el texto queda en el tooltip y para lectores de pantalla. */
  soloIcono?: boolean
  className?: string
}) {
  const { texto: base, icono: Icono, clase } = ESTADOS[estado]
  return (
    <span
      title={soloIcono ? (texto ?? base) : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        soloIcono && "size-6 justify-center p-0",
        clase,
        className
      )}
    >
      <Icono aria-hidden className={cn("size-3.5", estado === "en_curso" && "animate-spin")} />
      <span className={soloIcono ? "sr-only" : undefined}>{texto ?? base}</span>
    </span>
  )
}
