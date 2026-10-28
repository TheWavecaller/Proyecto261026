import { describe, expect, it } from "vitest"

import { contarMotivos, resumirPorCiudad, serieTemporal } from "@/lib/etl/resumen"
import type { Medicion, Rechazo } from "@/lib/etl/tipos"

const medicion = (ciudad: string, temperatura_c: number, precipitacion_mm = 0): Medicion => ({
  ciudad,
  fecha_hora: "2026-09-01T00:00:00.000Z",
  temperatura_c,
  humedad_pct: 50,
  precipitacion_mm,
})

const rechazo = (ciudad: string): Rechazo => ({
  tipo: "calidad",
  motivos: ["temperatura_c es null"],
  fila: {
    indice: 0,
    ciudad,
    hora_original: "2026-09-01T00:00",
    fecha_hora: "2026-09-01T00:00:00.000Z",
    temperatura_c: null,
    humedad_pct: 50,
    precipitacion_mm: 0,
  },
})

describe("resumen por ciudad", () => {
  it("calcula media, mínimo, máximo y precipitación total por ciudad", () => {
    const r = resumirPorCiudad(
      [medicion("Madrid", 10, 0.5), medicion("Madrid", 20, 1.5), medicion("Bilbao", 15)],
      [rechazo("Madrid")]
    )
    expect(r.Madrid).toEqual({
      validos: 2,
      rechazados: 1,
      medidas: {
        temperaturaMedia: 15,
        temperaturaMin: 10,
        temperaturaMax: 20,
        humedadMedia: 50,
        precipitacionTotal: 2,
      },
    })
    expect(r.Bilbao.validos).toBe(1)
  })

  it("no inventa medidas si la ciudad solo tiene rechazados", () => {
    expect(resumirPorCiudad([], [rechazo("Sevilla")]).Sevilla).toEqual({
      validos: 0,
      rechazados: 1,
      medidas: null,
    })
  })
})

const horaria = (ciudad: string, fecha_hora: string, valor: number): Medicion => ({
  ciudad,
  fecha_hora,
  temperatura_c: valor,
  humedad_pct: 50,
  precipitacion_mm: valor,
})

describe("serie temporal para la gráfica", () => {
  it("usa resolución horaria si el periodo cabe en 7 días y no rellena huecos", () => {
    const s = serieTemporal(
      [horaria("Madrid", "2026-09-01T00:00:00.000Z", 10), horaria("Bilbao", "2026-09-01T01:00:00.000Z", 12)],
      "temperatura_c"
    )
    expect(s.resolucion).toBe("hora")
    expect(s.puntos).toEqual([
      { t: Date.parse("2026-09-01T00:00:00Z"), Madrid: 10 },
      { t: Date.parse("2026-09-01T01:00:00Z"), Bilbao: 12 },
    ])
  })

  it("agrega por día UTC: media de temperatura y suma de precipitación", () => {
    const filas = [
      horaria("Madrid", "2026-09-01T00:00:00.000Z", 10),
      horaria("Madrid", "2026-09-01T23:00:00.000Z", 20),
      horaria("Madrid", "2026-09-10T00:00:00.000Z", 5),
    ]
    const dia = Date.parse("2026-09-01T00:00:00Z")
    expect(serieTemporal(filas, "temperatura_c").puntos[0]).toEqual({ t: dia, Madrid: 15 })
    expect(serieTemporal(filas, "precipitacion_mm").puntos[0]).toEqual({ t: dia, Madrid: 30 })
    expect(serieTemporal(filas, "temperatura_c").resolucion).toBe("dia")
  })
})

describe("recuento de motivos de rechazo", () => {
  it("agrupa sin el valor concreto, cuenta cada fila una vez por motivo y separa duplicados", () => {
    const base = rechazo("Madrid")
    const r = contarMotivos([
      { ...base, motivos: ["Humedad fuera de [0, 100] %: 104"] },
      { ...base, motivos: ["Humedad fuera de [0, 100] %: 120", "Temperatura: valor nulo"] },
      { ...base, tipo: "duplicado", motivos: ["Duplicado de Madrid · 2026-09-01 00:00 UTC: …"] },
    ])
    expect(r).toEqual([
      { motivo: "Humedad fuera de [0, 100] %", total: 2 },
      { motivo: "Duplicado (ciudad, fecha_hora)", total: 1 },
      { motivo: "Temperatura: valor nulo", total: 1 },
    ])
  })
})
