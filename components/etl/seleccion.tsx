"use client"

import * as React from "react"
import { CheckSquareIcon, FilterXIcon, ListFilterIcon, SquareIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { interpretarFiltros, type Filtros } from "@/lib/etl/filtros"
import { formatearNumero } from "@/lib/etl/formato"
import { claveMedicion } from "@/lib/etl/limpieza"
import type { CampoOrden, Medicion } from "@/lib/etl/tipos"
import type { PipelineEtl } from "@/hooks/use-pipeline-etl"
import { PerfilDatos } from "./analisis"
import { Campo, ListaMensajes } from "./campos"
import { BotonExportar } from "./exportar"
import { GraficaMediciones } from "./graficas"
import { COLUMNAS_MEDICION, SinDatos } from "./inspeccion"
import { siguienteOrden, TablaPaginada } from "./tabla-paginada"

type Limites = Record<"temperatura_c" | "humedad_pct" | "precipitacion_mm", { min: number; max: number }>

/** Mínimo y máximo de cada medida en los registros válidos, redondeados hacia fuera al paso. */
function calcularLimites(validos: readonly Medicion[]): Limites {
  const l: Limites = {
    temperatura_c: { min: Infinity, max: -Infinity },
    humedad_pct: { min: Infinity, max: -Infinity },
    precipitacion_mm: { min: Infinity, max: -Infinity },
  }
  for (const m of validos) {
    for (const k of Object.keys(l) as (keyof Limites)[]) {
      l[k].min = Math.min(l[k].min, m[k])
      l[k].max = Math.max(l[k].max, m[k])
    }
  }
  for (const k of Object.keys(l) as (keyof Limites)[]) {
    if (!Number.isFinite(l[k].min)) l[k] = { min: 0, max: 0 }
    else l[k] = { min: Math.floor(l[k].min), max: Math.ceil(l[k].max) }
  }
  return l
}

/** Rango con slider de doble mano e inputs numéricos. En un extremo, el filtro queda vacío. */
function Rango({
  etiqueta,
  unidad,
  min,
  max,
  limites,
  paso,
  alCambiar,
  id,
}: {
  etiqueta: string
  unidad: string
  min: string
  max: string
  limites: { min: number; max: number }
  paso: number
  alCambiar: (min: string, max: string) => void
  id: string
}) {
  const numero = (texto: string, defecto: number) => {
    const n = Number(texto.replace(",", "."))
    return texto.trim() === "" || !Number.isFinite(n) ? defecto : Math.min(limites.max, Math.max(limites.min, n))
  }
  const valor = [numero(min, limites.min), numero(max, limites.max)]
  const decimales = paso < 1 ? 1 : 0
  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-xs font-medium text-muted-foreground">
        {etiqueta} ({unidad})
      </legend>
      <Slider
        aria-label={`${etiqueta} (${unidad})`}
        min={limites.min}
        max={limites.max}
        step={paso}
        minStepsBetweenValues={0}
        value={valor}
        disabled={limites.min === limites.max}
        onValueChange={(v) => {
          const [a, b] = v as number[]
          alCambiar(
            a <= limites.min ? "" : a.toFixed(decimales),
            b >= limites.max ? "" : b.toFixed(decimales)
          )
        }}
        className="px-1.5"
      />
      <div className="flex items-center gap-1">
        <Input
          id={`${id}-min`}
          inputMode="decimal"
          placeholder={String(limites.min)}
          aria-label={`${etiqueta} mínima (${unidad})`}
          value={min}
          onChange={(e) => alCambiar(e.target.value, max)}
        />
        <span aria-hidden className="text-muted-foreground">–</span>
        <Input
          id={`${id}-max`}
          inputMode="decimal"
          placeholder={String(limites.max)}
          aria-label={`${etiqueta} máxima (${unidad})`}
          value={max}
          onChange={(e) => alCambiar(min, e.target.value)}
        />
      </div>
    </fieldset>
  )
}

export function PestanaValidos({ etl }: { etl: PipelineEtl }) {
  const p = etl.procesado
  const { filtros, setFiltros } = etl
  const cambiar = (cambio: Partial<Filtros>) => setFiltros({ ...filtros, ...cambio })
  const { errores } = interpretarFiltros(filtros)
  const ciudades = React.useMemo(
    () => [...new Set((p?.validos ?? []).map((m) => m.ciudad))],
    [p]
  )
  const limites = React.useMemo(() => calcularLimites(p?.validos ?? []), [p])
  const seleccion = React.useMemo(
    () => ({ seleccionadas: etl.seleccion, alternar: etl.alternarSeleccion }),
    [etl.seleccion, etl.alternarSeleccion]
  )

  if (!p)
    return (
      <SinDatos icono={ListFilterIcon} titulo="Esperando a la extracción" cargando={etl.extraccion?.estado === "en_curso"}>
        Los registros válidos aparecerán tras la limpieza.
      </SinDatos>
    )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Orden de operaciones: <strong>válidos → filtros → ordenación → selección → carga</strong>. La
        paginación solo cambia lo que ves; los filtros y el orden se aplican sobre todos los registros.
        Pulsa la cabecera de una columna para ordenar.
      </p>

      <section aria-label="Filtros" className="flex flex-col gap-3 rounded-xl border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Filtros</h3>
          <Button variant="ghost" size="sm" onClick={etl.restablecerFiltros}>
            <FilterXIcon data-icon="inline-start" />
            Restablecer filtros
          </Button>
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Ciudades</legend>
          {ciudades.map((c) => (
            <label key={c} className="flex items-center gap-1.5 rounded-lg border px-2 py-1 text-sm">
              <Checkbox
                checked={!filtros.ciudadesExcluidas.includes(c)}
                onCheckedChange={(v) =>
                  cambiar({
                    ciudadesExcluidas: v
                      ? filtros.ciudadesExcluidas.filter((x) => x !== c)
                      : [...filtros.ciudadesExcluidas, c],
                  })
                }
              />
              {c}
            </label>
          ))}
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Campo etiqueta="Desde (UTC)" htmlFor="filtro-desde">
            <Input id="filtro-desde" type="datetime-local" value={filtros.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
          </Campo>
          <Campo etiqueta="Hasta (UTC, incluido)" htmlFor="filtro-hasta">
            <Input id="filtro-hasta" type="datetime-local" value={filtros.hasta} onChange={(e) => cambiar({ hasta: e.target.value })} />
          </Campo>
          <Rango
            id="filtro-t"
            etiqueta="Temperatura"
            unidad="°C"
            min={filtros.temperaturaMin}
            max={filtros.temperaturaMax}
            limites={limites.temperatura_c}
            paso={0.5}
            alCambiar={(a, b) => cambiar({ temperaturaMin: a, temperaturaMax: b })}
          />
          <Rango
            id="filtro-h"
            etiqueta="Humedad"
            unidad="%"
            min={filtros.humedadMin}
            max={filtros.humedadMax}
            limites={limites.humedad_pct}
            paso={1}
            alCambiar={(a, b) => cambiar({ humedadMin: a, humedadMax: b })}
          />
          <Rango
            id="filtro-p"
            etiqueta="Precipitación"
            unidad="mm"
            min={filtros.precipitacionMin}
            max={filtros.precipitacionMax}
            limites={limites.precipitacion_mm}
            paso={0.1}
            alCambiar={(a, b) => cambiar({ precipitacionMin: a, precipitacionMax: b })}
          />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={filtros.soloLluvia} onCheckedChange={(v) => cambiar({ soloLluvia: v })} />
            Solo registros con lluvia (precipitación &gt; 0 mm)
          </label>
        </div>
        <ListaMensajes mensajes={errores} tono="aviso" />
      </section>

      <GraficaMediciones filas={etl.filtradas} />
      <PerfilDatos filas={etl.filtradas} />

      <section aria-label="Selección" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <span>
            <strong className="tabular-nums">{formatearNumero(etl.filtradas.length)}</strong> coinciden con
            los filtros · <strong className="tabular-nums">{formatearNumero(etl.paraSubir.length)}</strong>{" "}
            seleccionados para cargar
          </span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={etl.seleccionarFiltradas} disabled={etl.filtradas.length === 0}>
              <CheckSquareIcon data-icon="inline-start" />
              Seleccionar las {formatearNumero(etl.filtradas.length)} filtradas
            </Button>
            <Button size="sm" variant="outline" onClick={etl.vaciarSeleccion} disabled={etl.seleccion.size === 0}>
              <SquareIcon data-icon="inline-start" />
              Vaciar selección
            </Button>
          </div>
        </div>
        {etl.fueraDeFiltros > 0 && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-aviso/30 bg-aviso-suave px-3 py-2 text-sm text-aviso"
          >
            <span>
              <strong>Aviso:</strong> {formatearNumero(etl.fueraDeFiltros)} filas seleccionadas ya no
              cumplen los filtros actuales y <strong>no se subirán</strong>.
            </span>
            <Button size="xs" variant="outline" className="ml-auto" onClick={etl.descartarFueraDeFiltros}>
              <XIcon data-icon="inline-start" />
              Quitarlas de la selección
            </Button>
          </div>
        )}
        <TablaPaginada
          filas={etl.filtradas}
          columnas={COLUMNAS_MEDICION}
          claveFila={claveMedicion}
          seleccion={seleccion}
          numerar
          orden={{
            columna: etl.orden.campo,
            direccion: etl.orden.direccion,
            alCambiar: (c) => {
              const o = siguienteOrden({ columna: etl.orden.campo, direccion: etl.orden.direccion }, c)
              etl.setOrden({ campo: o.columna as CampoOrden, direccion: o.direccion })
            },
          }}
          acciones={
            <BotonExportar
              nombre="validos-filtrados"
              etiqueta="Exportar filtrados"
              total={etl.filtradas.length}
              obtener={() => etl.filtradas as unknown as Record<string, unknown>[]}
            />
          }
          vacio="Ningún registro válido cumple los filtros actuales."
        />
      </section>
    </div>
  )
}
