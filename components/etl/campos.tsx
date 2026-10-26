import * as React from "react"

import { cn } from "@/lib/utils"

export function Selector({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

export function Campo({
  etiqueta,
  htmlFor,
  children,
  className,
}: {
  etiqueta: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {etiqueta}
      </label>
      {children}
    </div>
  )
}

export function ListaMensajes({
  mensajes,
  tono,
}: {
  mensajes: string[]
  tono: "error" | "aviso"
}) {
  if (mensajes.length === 0) return null
  return (
    <ul
      role={tono === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm",
        tono === "error"
          ? "border-destructive/40 bg-destructive/5 text-destructive"
          : "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
      )}
    >
      {mensajes.map((m) => (
        <li key={m}>
          <span className="font-medium">{tono === "error" ? "Error: " : "Aviso: "}</span>
          {m}
        </li>
      ))}
    </ul>
  )
}
