"use client"

import * as React from "react"

import { CIUDADES } from "@/lib/etl/ciudades"

export interface ConfiguracionExtraccion {
  ciudades: string[]
  inicio: string
  fin: string
}

const CLAVE = "etl:configuracion"

export const CONFIGURACION_INICIAL: ConfiguracionExtraccion = {
  ciudades: CIUDADES.map((c) => c.id),
  inicio: "2026-09-01",
  fin: "2026-09-30",
}

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

/** Acepta solo lo que tiene la forma esperada: un valor viejo o manipulado no rompe la página. */
function leer(): ConfiguracionExtraccion {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as Partial<ConfiguracionExtraccion> | null
    if (!c) return CONFIGURACION_INICIAL
    const ids = new Set(CIUDADES.map((x) => x.id))
    return {
      ciudades: Array.isArray(c.ciudades)
        ? CIUDADES.filter((x) => c.ciudades!.includes(x.id) && ids.has(x.id)).map((x) => x.id)
        : CONFIGURACION_INICIAL.ciudades,
      inicio: typeof c.inicio === "string" && FECHA_RE.test(c.inicio) ? c.inicio : CONFIGURACION_INICIAL.inicio,
      fin: typeof c.fin === "string" && FECHA_RE.test(c.fin) ? c.fin : CONFIGURACION_INICIAL.fin,
    }
  } catch {
    return CONFIGURACION_INICIAL
  }
}

// Almacén externo: el servidor y la hidratación usan la configuración inicial y, ya en el
// navegador, React pasa a la guardada sin desajustes de hidratación.
let actual: ConfiguracionExtraccion | null = null
const oyentes = new Set<() => void>()

function suscribir(oyente: () => void) {
  oyentes.add(oyente)
  return () => oyentes.delete(oyente)
}

function instantanea() {
  return (actual ??= leer())
}

function guardar(cambio: Partial<ConfiguracionExtraccion>) {
  actual = { ...instantanea(), ...cambio }
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual))
  } catch {
    // Sin almacenamiento (modo privado, cuota…): se mantiene en memoria durante la sesión.
  }
  for (const o of oyentes) o()
}

/** Ciudades y fechas de la extracción, recordadas entre recargas en este navegador. */
export function useConfiguracionGuardada() {
  const config = React.useSyncExternalStore(suscribir, instantanea, () => CONFIGURACION_INICIAL)
  return [config, guardar] as const
}
