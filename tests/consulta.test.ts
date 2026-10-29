import { describe, expect, it } from "vitest"

import { consultaSql, consultaSupabaseJs, type ParametrosConsulta } from "@/lib/etl/consulta"

const base: ParametrosConsulta = {
  ciudad: "",
  desde: "",
  hasta: "",
  orden: "fecha_hora",
  dir: "asc",
  pagina: 0,
  tamano: 25,
}

describe("consulta equivalente de Destino", () => {
  it("sin filtros: sin WHERE, con ORDER BY explícito y desempate por id", () => {
    expect(consultaSql(base)).toBe(
      [
        "select id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en",
        "from public.mediciones_meteorologicas",
        "order by fecha_hora asc, id asc",
        "limit 25 offset 0;",
      ].join("\n")
    )
  })

  it("traduce filtros, orden y página igual que /api/mediciones", () => {
    const p = {
      ...base,
      ciudad: "A Coruña",
      desde: "2026-09-01T00:00:00.000Z",
      hasta: "2026-09-02T23:00:00.000Z",
      orden: "temperatura_c",
      dir: "desc" as const,
      pagina: 2,
      tamano: 50,
    }
    const sql = consultaSql(p)
    expect(sql).toContain("where ciudad = 'A Coruña'\n  and fecha_hora >= '2026-09-01T00:00:00.000Z'")
    expect(sql).toContain("fecha_hora <= '2026-09-02T23:00:00.000Z'")
    expect(sql).toContain("order by temperatura_c desc, id asc\nlimit 50 offset 100;")

    const js = consultaSupabaseJs(p)
    expect(js).toContain('.eq("ciudad", "A Coruña")')
    expect(js).toContain('.order("temperatura_c", { ascending: false })')
    expect(js).toContain(".range(100, 149)")
  })

  it("escapa las comillas simples del literal SQL", () => {
    expect(consultaSql({ ...base, ciudad: "L'Hospitalet" })).toContain("ciudad = 'L''Hospitalet'")
  })
})
