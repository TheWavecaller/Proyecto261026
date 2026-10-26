/**
 * Pruebas de integración: usan la API real de Open-Meteo y la app en marcha (npm run dev).
 * Las que necesitan Supabase se omiten, indicando el motivo, si /api/estado no está listo.
 */
import { beforeAll, describe, expect, it } from "vitest"

import { CIUDADES } from "@/lib/etl/ciudades"
import { huellaMediciones } from "@/lib/etl/carga"
import { descargarCiudad } from "@/lib/etl/extraccion"
import { limpiarFilas } from "@/lib/etl/limpieza"
import type { Medicion } from "@/lib/etl/tipos"
import { transformarRespuesta } from "@/lib/etl/transformacion"

const BASE = process.env.ETL_BASE_URL ?? "http://localhost:3000"
const barcelona = CIUDADES[0]
let validos: Medicion[] = []
let estado: { listo: boolean; mensaje: string } = { listo: false, mensaje: "sin comprobar" }

const post = (ruta: string, cuerpo: unknown) =>
  fetch(`${BASE}${ruta}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo),
  })

async function contarDestino() {
  const q = new URLSearchParams({
    ciudad: "Barcelona",
    desde: "2026-09-01T00:00:00Z",
    hasta: "2026-09-01T23:00:00Z",
    tam: "100",
  })
  const res = await fetch(`${BASE}/api/mediciones?${q}`)
  expect(res.status).toBe(200)
  return (await res.json()) as { total: number; filas: { fecha_hora: string }[] }
}

beforeAll(async () => {
  const json = await descargarCiudad(barcelona, "2026-09-01", "2026-09-01")
  validos = limpiarFilas(transformarRespuesta(barcelona.nombre, json).filas).validos
  estado = await (await fetch(`${BASE}/api/estado`)).json()
  if (!estado.listo) console.warn(`[integración] Supabase no disponible: ${estado.mensaje}`)
})

describe("Open-Meteo real", () => {
  it("una ciudad durante un día devuelve 24 registros horarios en UTC", () => {
    expect(validos).toHaveLength(24)
    expect(validos[0].fecha_hora).toBe("2026-09-01T00:00:00.000Z")
    expect(validos[23].fecha_hora).toBe("2026-09-01T23:00:00.000Z")
  })
})

describe("validación del servidor (no requiere Supabase)", () => {
  it("rechaza registros no válidos con 422", async () => {
    const res = await post("/api/carga", { registros: [{ ...validos[0], humedad_pct: 101 }] })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain("Humedad")
  })
  it("rechaza peticiones de más de 256 KB con 413", async () => {
    const res = await post("/api/carga", JSON.stringify({ relleno: "x".repeat(300 * 1024) }))
    expect(res.status).toBe(413)
  })
})

describe.runIf(process.env.ETL_SUPABASE !== "0")("carga real en Supabase", () => {
  it("upsert, verificación en destino y huella coincidente", async (ctx) => {
    if (!estado.listo) ctx.skip(`Supabase no disponible: ${estado.mensaje}`)
    const res = await post("/api/carga", { registros: validos })
    const cuerpo = await res.json()
    expect(res.status, cuerpo.error).toBe(200)
    expect(cuerpo.recibidos).toBe(24)
    expect(cuerpo.huella).toBe(huellaMediciones(validos))

    const ver = await (await post("/api/verificacion", { claves: validos })).json()
    expect(ver).toEqual({ presentes: 24, ausentes: 0 })
    expect((await contarDestino()).total).toBe(24)
  })

  it("una segunda carga no duplica filas", async (ctx) => {
    if (!estado.listo) ctx.skip(`Supabase no disponible: ${estado.mensaje}`)
    expect((await post("/api/carga", { registros: validos })).status).toBe(200)
    const destino = await contarDestino()
    expect(destino.total).toBe(24)
    expect(new Set(destino.filas.map((f) => f.fecha_hora)).size).toBe(24)
  })

  it("fallo parcial: un lote erróneo no afecta al lote correcto", async (ctx) => {
    if (!estado.listo) ctx.skip(`Supabase no disponible: ${estado.mensaje}`)
    const [a, b] = [validos.slice(0, 12), validos.slice(12)]
    const r1 = await post("/api/carga", { registros: a })
    const r2 = await post("/api/carga", { registros: [...b.slice(1), { ...b[0], precipitacion_mm: -1 }] })
    expect(r1.status).toBe(200)
    expect(r2.status).toBe(422)
    const ver = await (await post("/api/verificacion", { claves: a })).json()
    expect(ver.presentes).toBe(12)
  })
})
