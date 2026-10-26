import { describe, expect, it } from "vitest"

import { limpiarFilas, problemaNumerico } from "@/lib/etl/limpieza"
import { interpretarHoraUtc, transformarRespuesta } from "@/lib/etl/transformacion"
import barcelona from "./fixtures/barcelona-2026-09-01.json"
import conProblemas from "./fixtures/respuesta-con-problemas.json"

describe("transformación de arrays paralelos (respuesta real de Open-Meteo guardada)", () => {
  const { filas, avisos } = transformarRespuesta("Barcelona", barcelona)

  it("un día de una ciudad produce 24 registros horarios", () => {
    expect(filas).toHaveLength(24)
    expect(avisos).toEqual([])
  })

  it("interpreta las horas como UTC explícito", () => {
    expect(filas[0].fecha_hora).toBe("2026-09-01T00:00:00.000Z")
    expect(filas[23].fecha_hora).toBe("2026-09-01T23:00:00.000Z")
    const horas = filas.map((f) => new Date(f.fecha_hora!).getUTCHours())
    expect(horas).toEqual([...Array(24).keys()])
  })

  it("la posición i de cada array forma el registro i", () => {
    const h = barcelona.hourly
    filas.forEach((f, i) => {
      expect(f.hora_original).toBe(h.time[i])
      expect(f.temperatura_c).toBe(h.temperature_2m[i])
      expect(f.humedad_pct).toBe(h.relative_humidity_2m[i])
      expect(f.precipitacion_mm).toBe(h.precipitation[i])
    })
  })

  it("los 24 registros superan la limpieza", () => {
    const { validos, rechazados } = limpiarFilas(filas)
    expect(validos).toHaveLength(24)
    expect(rechazados).toHaveLength(0)
  })
})

describe("interpretarHoraUtc", () => {
  it("rechaza fechas imposibles y formatos ajenos", () => {
    expect(interpretarHoraUtc("2026-09-31T06:00")).toBeNull()
    expect(interpretarHoraUtc("2026-09-01 06:00")).toBeNull()
    expect(interpretarHoraUtc(null)).toBeNull()
    expect(interpretarHoraUtc("2026-02-28T23:00")).toBe("2026-02-28T23:00:00.000Z")
  })
})

describe("fixture controlado con problemas", () => {
  const { filas, avisos } = transformarRespuesta("Bilbao", conProblemas)
  const { validos, rechazados } = limpiarFilas(filas)
  const motivos = (i: number) => rechazados.find((r) => r.fila.indice === i)?.motivos.join(" | ")

  it("avisa de arrays con longitudes incoherentes sin perder filas", () => {
    expect(avisos.some((a) => a.includes('"hourly.precipitation" tiene 9 valores'))).toBe(true)
    expect(filas).toHaveLength(10)
    expect(filas[9].precipitacion_mm).toBeUndefined()
  })

  it("null, cadena vacía y ausente no se convierten en cero", () => {
    expect(filas[1].temperatura_c).toBeNull()
    expect(validos.some((v) => v.fecha_hora === "2026-09-01T01:00:00.000Z")).toBe(false)
    expect(motivos(1)).toContain("Temperatura: valor nulo")
    expect(motivos(2)).toContain("Humedad: valor nulo")
    expect(motivos(3)).toContain("Temperatura: cadena vacía")
    expect(motivos(8)).toContain("tipo no numérico")
    expect(motivos(9)).toContain("Precipitación: valor ausente")
    expect(problemaNumerico(0)).toBeNull()
  })

  it("valida rangos de humedad y precipitación, pero no temperaturas extremas", () => {
    expect(motivos(4)).toContain("Humedad fuera de [0, 100] %: 104")
    expect(motivos(4)).not.toContain("Temperatura")
    expect(motivos(8)).toContain("Precipitación negativa")
    // -12.4 °C y humedad 0 % son extremos pero válidos... salvo que falte su precipitación.
    expect(motivos(9)).not.toContain("Humedad")
  })

  it("rechaza fechas no válidas indicando el texto original", () => {
    expect(motivos(7)).toContain('Fecha y hora no válida: "2026-09-31T06:00"')
  })

  it("detecta duplicados y conserva la primera aparición", () => {
    const dup = rechazados.filter((r) => r.tipo === "duplicado")
    expect(dup).toHaveLength(1)
    expect(dup[0].fila.indice).toBe(6)
    expect(dup[0].motivos[0]).toContain("posición 5")
    const conservada = validos.find((v) => v.fecha_hora === "2026-09-01T05:00:00.000Z")
    expect(conservada?.temperatura_c).toBe(16)
  })

  it("cuadra el balance: total = válidos + rechazados", () => {
    expect(validos.map((v) => v.fecha_hora)).toEqual([
      "2026-09-01T00:00:00.000Z",
      "2026-09-01T05:00:00.000Z",
    ])
    expect(validos.length + rechazados.length).toBe(filas.length)
  })

  it("duplicados entre respuestas distintas de la misma ciudad", () => {
    const a = transformarRespuesta("Barcelona", barcelona).filas
    const { validos: v, rechazados: r } = limpiarFilas([...a, ...a])
    expect(v).toHaveLength(24)
    expect(r.every((x) => x.tipo === "duplicado")).toBe(true)
    expect(r).toHaveLength(24)
  })
})
