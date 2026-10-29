import { CloudSunIcon } from "lucide-react"

import { BotonAyuda } from "@/components/ayuda"
import { BotonTema } from "@/components/boton-tema"
import { BancoTrabajo } from "@/components/etl/banco-trabajo"

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pt-6 pb-32 sm:px-6 lg:pt-10">
      <header className="flex items-start gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-hielo to-pacifico text-foreground shadow-sm dark:text-primary-foreground"
        >
          <CloudSunIcon className="size-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Big Data · Práctica 1
          </p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Clima de Open-Meteo a Supabase
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Elige ciudades en el mapa, extrae sus datos horarios y sigue paso a paso cómo se
            transforman, limpian y cargan en la base de datos.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <BotonAyuda />
          <BotonTema />
        </div>
      </header>
      <BancoTrabajo />
    </main>
  )
}
