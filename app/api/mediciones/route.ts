import type { NextRequest } from "next/server"

import { NOMBRES_CIUDADES } from "@/lib/etl/ciudades"
import { errorJson } from "@/lib/supabase/respuestas"
import { clienteServidor, describirError, ErrorConfiguracion, TABLA } from "@/lib/supabase/servidor"

const CAMPOS_ORDEN = new Set([
  "ciudad",
  "fecha_hora",
  "temperatura_c",
  "humedad_pct",
  "precipitacion_mm",
  "importado_en",
])
/** La interfaz pagina como mucho de 250 en 250; la exportación pide páginas de 1000. */
const MAX_TAMANO = 1000

/** Lectura paginada de lo que está realmente persistido en Supabase. */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams
  const ciudad = p.get("ciudad") ?? ""
  const desde = p.get("desde") ?? ""
  const hasta = p.get("hasta") ?? ""
  const orden = p.get("orden") ?? "fecha_hora"
  const ascendente = p.get("dir") !== "desc"
  const pagina = Math.max(0, Math.trunc(Number(p.get("pagina") ?? 0)) || 0)
  const tamano = Math.min(MAX_TAMANO, Math.max(1, Math.trunc(Number(p.get("tam") ?? 25)) || 25))

  if (ciudad && !NOMBRES_CIUDADES.has(ciudad)) return errorJson("Ciudad desconocida.", 422)
  if (!CAMPOS_ORDEN.has(orden)) return errorJson("Campo de ordenación no permitido.", 422)
  for (const f of [desde, hasta]) {
    if (f && Number.isNaN(Date.parse(f))) return errorJson("Fecha no válida.", 422)
  }

  try {
    let consulta = clienteServidor()
      .from(TABLA)
      .select("id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en", {
        count: "exact",
      })
    if (ciudad) consulta = consulta.eq("ciudad", ciudad)
    if (desde) consulta = consulta.gte("fecha_hora", new Date(desde).toISOString())
    if (hasta) consulta = consulta.lte("fecha_hora", new Date(hasta).toISOString())
    // Sin ORDER BY la base de datos no garantiza ningún orden: siempre lo indicamos, con desempate.
    consulta = consulta.order(orden, { ascending: ascendente }).order("id", { ascending: true })

    const { data, count, error } = await consulta.range(pagina * tamano, pagina * tamano + tamano - 1)
    if (error) return errorJson(describirError(error), 502)
    return Response.json({ filas: data ?? [], total: count ?? 0, pagina, tamano })
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return errorJson(e.message, 503)
    console.error("[api/mediciones] error inesperado:", (e as Error).message)
    return errorJson("Error inesperado al leer Supabase.", 500)
  }
}
