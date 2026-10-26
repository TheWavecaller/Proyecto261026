import { BancoTrabajo } from "@/components/etl/banco-trabajo"

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Big Data · Práctica 1
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Pipeline ETL: Open-Meteo → Supabase</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Extrae datos meteorológicos horarios, observa cómo se transforman y limpian, decide qué
          registros subir y comprueba qué ha quedado realmente almacenado en la base de datos.
        </p>
      </header>
      <BancoTrabajo />
    </main>
  )
}
