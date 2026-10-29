"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { useTheme } from "next-themes"
import { CheckIcon, LoaderCircleIcon, MousePointerClickIcon } from "lucide-react"
import type { Map as MapaMapLibre, Popup } from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"

import { cn } from "@/lib/utils"
import { CIUDADES, type Ciudad } from "@/lib/etl/ciudades"
import { formatearDecimal, formatearNumero } from "@/lib/etl/formato"
import type { MedidasCiudad, ResumenCiudad } from "@/lib/etl/resumen"
import type { EstadoFase } from "@/lib/etl/tipos"

const CLAVE_MAPTILER = process.env.NEXT_PUBLIC_MAPTILER_KEY

const urlEstilo = (oscuro: boolean) =>
  `https://api.maptiler.com/maps/${oscuro ? "dataviz-dark" : "dataviz"}/style.json?key=${CLAVE_MAPTILER}`

/** Colores del mapa base a juego con la paleta «Ocean Breeze»: tierra en porcelana y agua en azul hielo. */
const PALETA_MAPA = {
  claro: {
    fondo: "#f9f7f3",
    residencial: "#f1eee7",
    vegetacion: "#eef0e2",
    agua: "#b5e2fa",
    aguaSombra: "#9fd3ee",
    frontera: "#0fa3b1",
    fronteraSuave: "#a9dbe0",
    texto: "#5d747a",
  },
  oscuro: {
    fondo: "#0f1e22",
    residencial: "#15282c",
    vegetacion: "#16261f",
    agua: "#14394a",
    aguaSombra: "#10303e",
    frontera: "#2b8f99",
    fronteraSuave: "#24474d",
    texto: "#9fb8bd",
  },
}

function recolorear(m: MapaMapLibre, oscuro: boolean) {
  const p = PALETA_MAPA[oscuro ? "oscuro" : "claro"]
  const poner = (capa: string, propiedad: Parameters<MapaMapLibre["setPaintProperty"]>[1], valor: string) => {
    if (m.getLayer(capa)) m.setPaintProperty(capa, propiedad, valor)
  }
  poner("Background", "background-color", p.fondo)
  poner("Residential", "fill-color", p.residencial)
  poner("Landcover", "fill-color", p.vegetacion)
  poner("Stadium", "fill-color", p.vegetacion)
  poner("Water", "fill-color", p.agua)
  poner("Water shadow", "fill-color", p.aguaSombra)
  poner("River", "line-color", p.agua)
  poner("Country border", "line-color", p.frontera)
  for (const capa of ["Other border", "Other border dash", "Disputed border"]) poner(capa, "line-color", p.fronteraSuave)
  for (const capa of m.getStyle().layers) {
    if (capa.type !== "symbol") continue
    poner(capa.id, "text-color", p.texto)
    poner(capa.id, "text-halo-color", p.fondo)
  }
}

type Metrica = "temperatura" | "precipitacion"

const METRICAS: Record<
  Metrica,
  { texto: string; unidad: string; valor: (m: MedidasCiudad) => number; colores: [string, string, string] }
> = {
  temperatura: {
    texto: "Temperatura",
    unidad: "°C",
    valor: (m) => m.temperaturaMedia,
    // frío (hielo) → templado (vainilla) → cálido (mandarina)
    colores: ["#b5e2fa", "#eddea4", "#f7a072"],
  },
  precipitacion: {
    texto: "Lluvia",
    unidad: "mm",
    valor: (m) => m.precipitacionTotal,
    colores: ["#f9f7f3", "#b5e2fa", "#0fa3b1"],
  },
}

/** Interpola entre tres colores; t ∈ [0, 1]. */
function colorEscala([a, b, c]: [string, string, string], t: number) {
  const p = Math.round(Math.min(Math.max(t, 0), 1) * 200)
  return p <= 100 ? `color-mix(in oklch, ${b} ${p}%, ${a})` : `color-mix(in oklch, ${c} ${p - 100}%, ${b})`
}

interface Props {
  /** Ids de las ciudades marcadas para la próxima extracción. */
  seleccionadas: readonly string[]
  alAlternar: (id: string, marcar: boolean) => void
  deshabilitado: boolean
  /** Resumen de la última extracción, por nombre de ciudad. */
  resumen: Record<string, ResumenCiudad> | null
  estados?: Record<string, EstadoFase>
  className?: string
}

export function MapaCiudades(props: Props) {
  if (!CLAVE_MAPTILER) {
    return (
      <div className={cn("flex items-center justify-center bg-muted p-6", props.className)}>
        <p className="text-sm text-muted-foreground">
          Falta la variable <code>NEXT_PUBLIC_MAPTILER_KEY</code>: el mapa no se puede mostrar.
        </p>
      </div>
    )
  }
  return <Mapa {...props} />
}

function Mapa({ seleccionadas, alAlternar, deshabilitado, resumen, estados, className }: Props) {
  const contenedor = React.useRef<HTMLDivElement>(null)
  const mapa = React.useRef<MapaMapLibre | null>(null)
  const estiloAplicado = React.useRef<string | null>(null)
  const oscuroRef = React.useRef(false)
  const [marcadores, setMarcadores] = React.useState<Record<string, HTMLElement> | null>(null)
  const [popup, setPopup] = React.useState<{ instancia: Popup; elemento: HTMLElement } | null>(null)
  const [activa, setActiva] = React.useState<Ciudad | null>(null)
  const [metrica, setMetrica] = React.useState<Metrica>("temperatura")
  const [error, setError] = React.useState<string | null>(null)
  const { resolvedTheme } = useTheme()
  const oscuro = resolvedTheme === "dark"
  React.useEffect(() => {
    oscuroRef.current = oscuro
  }, [oscuro])

  // MapLibre necesita el DOM y WebGL: se importa solo en el navegador.
  React.useEffect(() => {
    let cancelado = false
    void import("maplibre-gl").then(({ Map, Marker, Popup, NavigationControl, LngLatBounds, setWorkerUrl }) => {
      if (cancelado || !contenedor.current) return
      // Copiado a public/ por scripts/copiar-worker-maplibre.mjs (postinstall).
      setWorkerUrl(`${window.location.origin}/maplibre-gl-worker.mjs`)
      const limites = new LngLatBounds()
      for (const c of CIUDADES) limites.extend([c.longitud, c.latitud])

      const estilo = urlEstilo(document.documentElement.classList.contains("dark"))
      estiloAplicado.current = estilo
      const m = new Map({
        container: contenedor.current,
        style: estilo,
        bounds: limites,
        fitBoundsOptions: { padding: { top: 80, bottom: 90, left: 60, right: 60 } },
        cooperativeGestures: true,
        attributionControl: { compact: true },
      })
      m.addControl(new NavigationControl({ showCompass: false }), "top-right")
      // Se dispara con cada estilo nuevo, también al cambiar de tema.
      m.on("style.load", () => recolorear(m, oscuroRef.current))
      m.on("error", (e) => {
        if (!m.isStyleLoaded()) setError(e.error?.message ?? "error desconocido")
      })
      mapa.current = m

      const elementos: Record<string, HTMLElement> = {}
      for (const c of CIUDADES) {
        const el = document.createElement("div")
        el.className = "hover:z-10 focus-within:z-10"
        new Marker({ element: el, anchor: "bottom" }).setLngLat([c.longitud, c.latitud]).addTo(m)
        elementos[c.id] = el
      }
      setMarcadores(elementos)

      const elementoPopup = document.createElement("div")
      setPopup({
        elemento: elementoPopup,
        instancia: new Popup({
          closeButton: false,
          closeOnClick: false,
          offset: 44,
          maxWidth: "240px",
          className: "mapa-popup",
        }).setDOMContent(elementoPopup),
      })
    })
    return () => {
      cancelado = true
      mapa.current?.remove()
      mapa.current = null
    }
  }, [])

  React.useEffect(() => {
    const estilo = urlEstilo(oscuro)
    if (!mapa.current || resolvedTheme === undefined || estiloAplicado.current === estilo) return
    estiloAplicado.current = estilo
    mapa.current.setStyle(estilo)
  }, [oscuro, resolvedTheme, marcadores])

  React.useEffect(() => {
    if (!popup || !mapa.current) return
    if (activa) popup.instancia.setLngLat([activa.longitud, activa.latitud]).addTo(mapa.current)
    else popup.instancia.remove()
  }, [activa, popup])

  const config = METRICAS[metrica]
  const valores = CIUDADES.flatMap((c) => {
    const m = resumen?.[c.nombre]?.medidas
    return m ? [config.valor(m)] : []
  })
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const colorDe = (v: number) => colorEscala(config.colores, max > min ? (v - min) / (max - min) : 0.5)
  const hayDatos = valores.length > 0

  return (
    <div className={cn("relative isolate overflow-hidden bg-muted", className)}>
      {/* MapLibre fuerza position: relative en el contenedor: el tamaño va con h-full, no con inset-0. */}
      <div ref={contenedor} className="h-full w-full" />

      {error ? (
        <p className="absolute inset-x-3 top-3 rounded-xl border bg-card/95 p-2.5 text-xs text-destructive shadow-sm">
          No se pudo cargar el mapa de MapTiler: {error}
        </p>
      ) : (
        !hayDatos && (
          <p className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full border bg-card/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
            <MousePointerClickIcon className="size-3.5" />
            Pulsa una ciudad para incluirla o quitarla
          </p>
        )
      )}

      {hayDatos && (
        <div className="absolute bottom-3 left-3 flex flex-col gap-2 rounded-2xl border bg-card/90 p-2.5 text-xs shadow-sm backdrop-blur">
          <div className="flex gap-1 rounded-full bg-muted p-0.5" role="group" aria-label="Valor mostrado en el mapa">
            {(Object.keys(METRICAS) as Metrica[]).map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={k === metrica}
                onClick={() => setMetrica(k)}
                className="rounded-full px-2.5 py-1 font-medium text-muted-foreground transition outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
              >
                {METRICAS[k].texto}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 px-1 text-muted-foreground tabular-nums">
            {formatearDecimal(min)}
            <span
              className="h-2 flex-1 rounded-full"
              style={{ background: `linear-gradient(to right, ${config.colores.join(", ")})` }}
              aria-hidden
            />
            {formatearDecimal(max)} {config.unidad}
          </div>
        </div>
      )}

      {marcadores &&
        CIUDADES.map((c) => {
          const seleccionada = seleccionadas.includes(c.id)
          const medidas = resumen?.[c.nombre]?.medidas
          const valor = medidas ? config.valor(medidas) : undefined
          return createPortal(
            <button
              type="button"
              aria-pressed={seleccionada}
              aria-disabled={deshabilitado}
              aria-label={`${c.nombre}: ${seleccionada ? "incluida" : "excluida"} en la extracción`}
              onClick={() => !deshabilitado && alAlternar(c.id, !seleccionada)}
              onMouseEnter={() => setActiva(c)}
              onMouseLeave={() => setActiva((a) => (a?.id === c.id ? null : a))}
              onFocus={() => setActiva(c)}
              onBlur={() => setActiva((a) => (a?.id === c.id ? null : a))}
              className={cn(
                "group flex flex-col items-center outline-none",
                deshabilitado ? "cursor-not-allowed" : "cursor-pointer"
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-1.5 rounded-full border-2 bg-card py-1 pr-3 pl-1 text-xs font-semibold whitespace-nowrap text-card-foreground shadow-md transition group-hover:-translate-y-0.5 group-focus-visible:ring-3 group-focus-visible:ring-ring/50",
                  seleccionada ? "border-pacifico" : "border-dashed border-border opacity-75"
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-foreground",
                    seleccionada ? "bg-hielo" : "bg-muted"
                  )}
                  style={valor !== undefined ? { background: colorDe(valor) } : undefined}
                >
                  {estados?.[c.id] === "en_curso" ? (
                    <LoaderCircleIcon className="size-3 animate-spin" />
                  ) : (
                    seleccionada && <CheckIcon className="size-3 text-[#1d3439]" strokeWidth={3} />
                  )}
                </span>
                {c.nombre}
                {valor !== undefined && (
                  <span className="font-medium text-muted-foreground tabular-nums">
                    {formatearDecimal(valor)} {config.unidad}
                  </span>
                )}
              </span>
              <span className={cn("h-2.5 w-0.5", seleccionada ? "bg-pacifico" : "bg-border")} />
              <span
                className={cn(
                  "size-2.5 rounded-full border-2 border-card shadow",
                  seleccionada ? "bg-mandarina" : "bg-muted-foreground/50"
                )}
              />
            </button>,
            marcadores[c.id],
            c.id
          )
        })}

      {popup &&
        createPortal(
          activa && <DetalleCiudad ciudad={activa} resumen={resumen?.[activa.nombre]} />,
          popup.elemento
        )}
    </div>
  )
}

function DetalleCiudad({ ciudad, resumen }: { ciudad: Ciudad; resumen?: ResumenCiudad }) {
  const m = resumen?.medidas
  return (
    <div className="flex flex-col gap-1.5 text-xs">
      <p className="text-sm font-semibold">{ciudad.nombre}</p>
      {!resumen ? (
        <p className="text-muted-foreground">
          {ciudad.latitud}, {ciudad.longitud} · aún sin datos extraídos.
        </p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 tabular-nums">
          <dt className="text-muted-foreground">Válidos</dt>
          <dd>{formatearNumero(resumen.validos)}</dd>
          <dt className="text-muted-foreground">Rechazados</dt>
          <dd>{formatearNumero(resumen.rechazados)}</dd>
          {m && (
            <>
              <dt className="text-muted-foreground">Temperatura</dt>
              <dd>
                {formatearDecimal(m.temperaturaMedia)} °C
                <span className="text-muted-foreground">
                  {" "}
                  ({formatearDecimal(m.temperaturaMin)} a {formatearDecimal(m.temperaturaMax)})
                </span>
              </dd>
              <dt className="text-muted-foreground">Humedad media</dt>
              <dd>{formatearDecimal(m.humedadMedia)} %</dd>
              <dt className="text-muted-foreground">Precipitación</dt>
              <dd>{formatearDecimal(m.precipitacionTotal)} mm</dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
