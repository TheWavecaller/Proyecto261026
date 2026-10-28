"use client"

import * as React from "react"
import { CircleHelpIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export const GLOSARIO = {
  etl: {
    termino: "ETL",
    definicion: "Extract, Transform, Load: extraer datos de una fuente, transformarlos y limpiarlos, y cargarlos en un destino.",
  },
  utc: {
    termino: "UTC",
    definicion: "Tiempo universal coordinado. Todas las horas se guardan en UTC para no depender de la zona horaria ni del cambio de hora.",
  },
  paralelos: {
    termino: "Arrays paralelos",
    definicion: "Open-Meteo devuelve una lista por variable (time, temperature_2m…). La posición i de cada lista corresponde a la misma hora.",
  },
  duplicado: {
    termino: "Duplicado",
    definicion: "Dos filas con la misma ciudad y fecha_hora. Se conserva la primera aparición y el resto se rechaza.",
  },
  upsert: {
    termino: "Upsert",
    definicion: "Insertar o, si la clave (ciudad, fecha_hora) ya existe, actualizar. Repetir la carga no crea duplicados.",
  },
  lote: {
    termino: "Lote",
    definicion: "Grupo de hasta 500 registros que se envía en una sola petición. Si un lote falla, solo se reintenta ese.",
  },
  huella: {
    termino: "Huella",
    definicion: "Resumen corto (hash FNV-1a) del contenido. Si la huella enviada y la recibida coinciden, el servidor recibió exactamente lo mismo.",
  },
  orderby: {
    termino: "ORDER BY",
    definicion: "Una base de datos no garantiza ningún orden al leer: hay que pedirlo siempre de forma explícita.",
  },
} as const

export type ClaveGlosario = keyof typeof GLOSARIO

/** Término subrayado con su definición al pasar el ratón o enfocarlo con el teclado. */
export function Termino({ id, children }: { id: ClaveGlosario; children?: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        className="cursor-help rounded-sm underline decoration-muted-foreground/60 decoration-dotted underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {children ?? GLOSARIO[id].termino}
      </TooltipTrigger>
      <TooltipContent className="max-w-72 text-left leading-snug">{GLOSARIO[id].definicion}</TooltipContent>
    </Tooltip>
  )
}

const PASOS = [
  ["Elige ciudades y periodo", "Pulsa las ciudades en el mapa o en los chips, y elige las fechas en el calendario o con un atajo."],
  ["Extrae", "Se hace una petición a Open-Meteo por ciudad. Puedes reintentar solo las que fallen."],
  ["Revisa la transformación y la limpieza", "Mira qué filas se rechazaron y por qué. La gráfica resume los motivos."],
  ["Filtra y selecciona", "Ajusta los rangos con los sliders, mira la gráfica y marca las filas que quieres subir."],
  ["Sube y comprueba", "Sube a Supabase por lotes y comprueba en «Destino» lo que de verdad quedó guardado."],
] as const

export function BotonAyuda() {
  return (
    <Sheet>
      <SheetTrigger
        render={<Button variant="outline" size="icon" className="rounded-full" aria-label="¿Cómo funciona?" />}
      >
        <CircleHelpIcon />
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>¿Cómo funciona?</SheetTitle>
          <SheetDescription>
            Un pipeline ETL completo con datos meteorológicos reales: de la API de Open-Meteo a una tabla
            de Supabase.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 px-4 pb-6">
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">En cinco pasos</h3>
            <ol className="flex flex-col gap-3">
              {PASOS.map(([titulo, texto], i) => (
                <li key={titulo} className="flex gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{titulo}</span>
                    <span className="text-sm text-muted-foreground">{texto}</span>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Llevarte los datos</h3>
            <p className="text-sm text-muted-foreground">
              Cada tabla tiene un botón <strong>Exportar</strong> a CSV o JSON. El CSV usa comas, UTF-8 y
              fechas ISO en UTC. Para leerlo con pandas:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">
              {`import pandas as pd
df = pd.read_csv("validos-filtrados.csv",
                 parse_dates=["fecha_hora"])`}
            </pre>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Glosario</h3>
            <dl className="flex flex-col gap-2.5">
              {Object.values(GLOSARIO).map((g) => (
                <div key={g.termino}>
                  <dt className="text-sm font-medium">{g.termino}</dt>
                  <dd className="text-sm text-muted-foreground">{g.definicion}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">Atajos y detalles</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
              <li>
                Tecla <kbd className="rounded border bg-muted px-1 font-mono text-xs">D</kbd>: modo claro u
                oscuro.
              </li>
              <li>Pulsa la cabecera de una columna para ordenar la tabla.</li>
              <li>Las ciudades y las fechas se recuerdan en este navegador.</li>
              <li>Los datos extraídos solo viven en esta pestaña hasta que los subes a Supabase.</li>
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
