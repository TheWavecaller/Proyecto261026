"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { es } from "react-day-picker/locale"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { FECHA_MINIMA, MAX_DIAS } from "@/lib/etl/extraccion"

// El calendario trabaja con fechas locales; las convertimos a "AAAA-MM-DD" sin pasar por UTC
// para que el día elegido sea exactamente el que se envía a la API.
function aTexto(d: Date): string {
  const dos = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`
}

function aFecha(texto: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texto)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : undefined
}

const corta = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" })

function desplazar(d: Date, dias: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + dias)
  return r
}

/** Atajos que terminan 5 días antes de hoy: el archivo histórico llega con ese retraso. */
function atajos(hoy: Date): { texto: string; inicio: Date; fin: Date }[] {
  const fin = desplazar(hoy, -5)
  const mesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
  const anoPasado = hoy.getFullYear() - 1
  return [
    { texto: "Última semana", inicio: desplazar(fin, -6), fin },
    { texto: "Últimos 30 días", inicio: desplazar(fin, -29), fin },
    { texto: "Últimos 90 días", inicio: desplazar(fin, -89), fin },
    {
      texto: "Mes pasado",
      inicio: mesPasado,
      fin: new Date(hoy.getFullYear(), hoy.getMonth(), 0),
    },
    { texto: `Año ${anoPasado}`, inicio: new Date(anoPasado, 0, 1), fin: new Date(anoPasado, 11, 31) },
  ]
}

export function SelectorFechas({
  inicio,
  fin,
  alCambiar,
  deshabilitado,
  invalido,
}: {
  inicio: string
  fin: string
  alCambiar: (inicio: string, fin: string) => void
  deshabilitado?: boolean
  invalido?: boolean
}) {
  const [abierto, setAbierto] = React.useState(false)
  const hoy = React.useMemo(() => new Date(), [])
  const desde = aFecha(inicio)
  const hasta = aFecha(fin)
  const opciones = React.useMemo(() => atajos(hoy), [hoy])

  return (
    <div className="flex flex-col gap-2">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger
          disabled={deshabilitado}
          aria-invalid={invalido}
          render={
            <Button
              variant="outline"
              className={cn("h-10 w-full justify-start rounded-xl text-left font-normal", !desde && "text-muted-foreground")}
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {desde && hasta ? (
            <span className="truncate">
              {corta.format(desde)} → {corta.format(hasta)}
            </span>
          ) : (
            "Elige el periodo"
          )}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            locale={es}
            numberOfMonths={2}
            captionLayout="dropdown"
            defaultMonth={desde}
            startMonth={aFecha(FECHA_MINIMA)}
            endMonth={hoy}
            disabled={{ after: hoy }}
            selected={{ from: desde, to: hasta }}
            onSelect={(r) => {
              if (!r?.from) return
              alCambiar(aTexto(r.from), aTexto(r.to ?? r.from))
            }}
            className="rounded-lg"
          />
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            Pulsa el primer y el último día. Máximo {MAX_DIAS} días · fechas en UTC.
          </p>
        </PopoverContent>
      </Popover>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Periodos rápidos">
        {opciones.map((o) => {
          const activo = aTexto(o.inicio) === inicio && aTexto(o.fin) === fin
          return (
            <Button
              key={o.texto}
              type="button"
              size="xs"
              variant={activo ? "secondary" : "ghost"}
              aria-pressed={activo}
              disabled={deshabilitado}
              onClick={() => alCambiar(aTexto(o.inicio), aTexto(o.fin))}
              className="rounded-full"
            >
              {o.texto}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
