import { describe, expect, it } from "vitest"

import {
  crearLotes,
  ejecutarLotes,
  huellaMediciones,
  validarRegistrosRecibidos,
  type Lote,
} from "@/lib/etl/carga"
import { validarExtraccion } from "@/lib/etl/extraccion"
import type { Medicion } from "@/lib/etl/tipos"

const registros: Medicion[] = Array.from({ length: 1234 }, (_, i) => ({
  ciudad: "Madrid",
  fecha_hora: new Date(Date.UTC(2026, 0, 1, i)).toISOString(),
  temperatura_c: 10,
  humedad_pct: 50,
  precipitacion_mm: 0,
}))

describe("lotes", () => {
  it("trocea en lotes de 500 como máximo conservando el orden", () => {
    const lotes = crearLotes(registros)
    expect(lotes.map((l) => l.registros.length)).toEqual([500, 500, 234])
    expect(lotes.flatMap((l) => l.registros)).toEqual(registros)
  })

  it("un fallo parcial conserva los lotes correctos y el reintento solo reenvía los fallidos", async () => {
    const enviados: number[] = []
    let fallar = true
    const enviar = async (r: Medicion[]) => {
      const lote = registros.indexOf(r[0]) / 500 + 1
      enviados.push(lote)
      if (lote === 2 && fallar) throw new Error("HTTP 502: error simulado")
      return { procesados: r.length, huella: huellaMediciones(r) }
    }
    const verificar = async (r: Medicion[]) => ({ presentes: r.length, ausentes: 0 })
    const historial: Lote[][] = []

    const primera = await ejecutarLotes(crearLotes(registros), enviar, verificar, (l) => historial.push(l))
    expect(primera.map((l) => l.estado)).toEqual(["completado", "error", "completado"])
    expect(primera[1].error).toContain("502")
    expect(primera[0].verificacion).toEqual({ presentes: 500, ausentes: 0 })
    expect(primera[1].verificacion).toBeUndefined()
    // Estados reales y progresivos: el lote 1 se ve en curso antes de completarse.
    expect(historial[0][0].estado).toBe("en_curso")

    fallar = false
    enviados.length = 0
    const segunda = await ejecutarLotes(primera, enviar, verificar, () => {})
    expect(enviados).toEqual([2])
    expect(segunda.map((l) => l.estado)).toEqual(["completado", "completado", "completado"])
    expect(segunda[1].intentos).toBe(2)
    expect(segunda[0].intentos).toBe(1)
  })
})

describe("validación del servidor", () => {
  const ok = registros.slice(0, 3)

  it("acepta registros correctos", () => {
    expect(validarRegistrosRecibidos({ registros: ok }).registros).toHaveLength(3)
  })

  it("rechaza lotes vacíos o de más de 500", () => {
    expect(validarRegistrosRecibidos({ registros: [] }).registros).toBeNull()
    expect(validarRegistrosRecibidos({ registros: registros.slice(0, 501) }).errores[0]).toContain("501")
  })

  it("rechaza valores no válidos, campos extra, ciudades desconocidas y claves repetidas", () => {
    const malos = [
      { ...ok[0], humedad_pct: 120 },
      { ...ok[1], temperatura_c: null },
      { ...ok[2], id: 5 },
      { ...ok[0], ciudad: "Atlantis", fecha_hora: "2026-01-01T05:00:00.000Z" },
      { ...ok[0], fecha_hora: "2026-01-01 00:00" },
    ]
    const r = validarRegistrosRecibidos({ registros: malos })
    expect(r.registros).toBeNull()
    expect(r.errores).toHaveLength(5)
    expect(validarRegistrosRecibidos({ registros: [ok[0], ok[0]] }).errores[0]).toContain("repetida")
  })
})

describe("validación de la extracción", () => {
  const hoy = new Date("2026-10-26T12:00:00Z")
  it("acepta septiembre de 2026 y limita a 365 días", () => {
    expect(validarExtraccion(["madrid"], "2026-09-01", "2026-09-30", hoy).errores).toEqual([])
    expect(validarExtraccion(["madrid"], "2025-01-01", "2025-12-31", hoy).errores).toEqual([])
    expect(validarExtraccion(["madrid"], "2025-01-01", "2026-01-01", hoy).errores[0]).toContain("366 días")
  })
  it("exige ciudades, fechas ordenadas y no futuras", () => {
    expect(validarExtraccion([], "2026-09-01", "2026-09-30", hoy).errores).toHaveLength(1)
    expect(validarExtraccion(["madrid"], "2026-09-10", "2026-09-01", hoy).errores).toHaveLength(1)
    expect(validarExtraccion(["madrid"], "2026-10-20", "2026-10-27", hoy).errores).toHaveLength(1)
    expect(validarExtraccion(["madrid"], "2026-10-20", "2026-10-25", hoy).avisos).toHaveLength(1)
  })
})
