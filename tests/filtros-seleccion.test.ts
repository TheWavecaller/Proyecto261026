import { describe, expect, it } from "vitest"

import {
  aplicarFiltros,
  filtrarYOrdenar,
  FILTROS_INICIALES,
  paginar,
  resumirSeleccion,
} from "@/lib/etl/filtros"
import { claveMedicion } from "@/lib/etl/limpieza"
import type { Medicion } from "@/lib/etl/tipos"

// 3 ciudades × 40 horas con valores deterministas: 120 registros.
const datos: Medicion[] = ["Madrid", "Bilbao", "Sevilla"].flatMap((ciudad, c) =>
  Array.from({ length: 40 }, (_, h) => ({
    ciudad,
    fecha_hora: new Date(Date.UTC(2026, 8, 1, h)).toISOString(),
    temperatura_c: 10 + ((h * 7 + c * 13) % 30),
    humedad_pct: (h * 11 + c) % 101,
    precipitacion_mm: h % 5 === 0 ? (h + c) / 10 : 0,
  }))
)

describe("filtros y ordenación antes de paginar", () => {
  it("la primera página de un orden descendente contiene el máximo global", () => {
    const ordenadas = filtrarYOrdenar(datos, FILTROS_INICIALES, { campo: "temperatura_c", direccion: "desc" })
    const maximo = Math.max(...datos.map((d) => d.temperatura_c))
    expect(paginar(ordenadas, 0, 25)[0].temperatura_c).toBe(maximo)
    // Si se paginara antes de ordenar, la primera página de los datos originales no lo garantiza.
    expect(Math.max(...paginar(datos, 0, 25).map((d) => d.temperatura_c))).toBeLessThanOrEqual(maximo)
  })

  it("filtra sobre todo el conjunto, no sobre la página", () => {
    const f = { ...FILTROS_INICIALES, ciudadesExcluidas: ["Madrid"], soloLluvia: true }
    const r = aplicarFiltros(datos, f)
    expect(r.every((m) => m.ciudad !== "Madrid" && m.precipitacion_mm > 0)).toBe(true)
    expect(r.length).toBe(datos.filter((m) => m.ciudad !== "Madrid" && m.precipitacion_mm > 0).length)
  })

  it("rangos inclusivos y fechas en UTC", () => {
    const f = {
      ...FILTROS_INICIALES,
      desde: "2026-09-01T10:00",
      hasta: "2026-09-01T12:00",
      temperaturaMin: "15",
      temperaturaMax: "30,5",
    }
    const r = aplicarFiltros(datos, f)
    expect(r.length).toBeGreaterThan(0)
    for (const m of r) {
      const h = new Date(m.fecha_hora).getUTCHours()
      expect(h).toBeGreaterThanOrEqual(10)
      expect(h).toBeLessThanOrEqual(12)
      expect(m.temperatura_c).toBeGreaterThanOrEqual(15)
      expect(m.temperatura_c).toBeLessThanOrEqual(30.5)
    }
  })

  it("orden estable con desempate por ciudad y fecha", () => {
    const r = filtrarYOrdenar(datos, FILTROS_INICIALES, { campo: "precipitacion_mm", direccion: "asc" })
    const ceros = r.filter((m) => m.precipitacion_mm === 0)
    expect(ceros[0].ciudad).toBe("Bilbao")
    expect(ceros[0].fecha_hora).toBe("2026-09-01T01:00:00.000Z")
  })
})

describe("selección entre páginas", () => {
  const ordenadas = filtrarYOrdenar(datos, FILTROS_INICIALES, { campo: "fecha_hora", direccion: "desc" })

  it("seleccionar todas las filtradas incluye filas de otras páginas", () => {
    const seleccion = new Set(ordenadas.map(claveMedicion))
    const { paraSubir } = resumirSeleccion(ordenadas, seleccion)
    expect(paraSubir).toHaveLength(120)
    expect(paginar(ordenadas, 0, 25)).toHaveLength(25)
  })

  it("solo se suben las seleccionadas que siguen cumpliendo los filtros, en el orden elegido", () => {
    const pagina1 = paginar(ordenadas, 0, 25).map(claveMedicion)
    const pagina4 = paginar(ordenadas, 3, 25).map(claveMedicion)
    const seleccion = new Set([...pagina1, ...pagina4])

    const soloSevilla = filtrarYOrdenar(
      datos,
      { ...FILTROS_INICIALES, ciudadesExcluidas: ["Madrid", "Bilbao"] },
      { campo: "fecha_hora", direccion: "desc" }
    )
    const { paraSubir, fueraDeFiltros } = resumirSeleccion(soloSevilla, seleccion)
    expect(paraSubir.every((m) => m.ciudad === "Sevilla")).toBe(true)
    expect(paraSubir.length + fueraDeFiltros).toBe(50)
    // El orden es el de la vista filtrada, no el de selección.
    const t = paraSubir.map((m) => Date.parse(m.fecha_hora))
    expect([...t].sort((a, b) => b - a)).toEqual(t)
  })

  it("cambiar filtros no añade registros nuevos a la selección", () => {
    const seleccion = new Set([claveMedicion(datos[0])])
    const { paraSubir } = resumirSeleccion(filtrarYOrdenar(datos, FILTROS_INICIALES, { campo: "ciudad", direccion: "asc" }), seleccion)
    expect(paraSubir).toEqual([datos[0]])
  })
})
