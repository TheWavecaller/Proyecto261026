import { describe, expect, it } from "vitest"

import { resumirPorCiudad } from "@/lib/etl/resumen"
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
