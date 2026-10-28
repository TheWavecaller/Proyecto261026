import { describe, expect, it } from "vitest"

import { aCsv } from "@/lib/etl/exportar"

describe("exportación a CSV", () => {
  it("escribe cabecera, escapa comas, comillas y saltos, y deja vacíos null y ausentes", () => {
    const csv = aCsv([
      { ciudad: "Madrid", motivo: 'dice "hola", y\nsigue', valor: 1.5 },
      { ciudad: "Bilbao", motivo: null, valor: undefined },
    ])
    expect(csv).toBe(
      ['ciudad,motivo,valor', 'Madrid,"dice ""hola"", y\nsigue",1.5', "Bilbao,,"].join("\r\n")
    )
  })

  it("respeta el orden de columnas indicado", () => {
    expect(aCsv([{ a: 1, b: 2 }], ["b", "a"])).toBe("b,a\r\n2,1")
  })
})
