import { TAMANO_LOTE, trocear } from "@/lib/etl/carga"
import { claveMedicion } from "@/lib/etl/limpieza"
import { errorJson, leerJsonLimitado } from "@/lib/supabase/respuestas"
import { clienteServidor, describirError, ErrorConfiguracion, TABLA } from "@/lib/supabase/servidor"

/** Fechas por consulta: mantiene la URL de PostgREST corta. */
const FECHAS_POR_CONSULTA = 100

interface Clave {
  ciudad: string
  fecha_hora: string
}

function esClave(v: unknown): v is Clave {
  const o = v as Clave
  return (
    typeof o?.ciudad === "string" &&
    typeof o?.fecha_hora === "string" &&
    !Number.isNaN(Date.parse(o.fecha_hora))
  )
}

/** Comprueba qué claves (ciudad, fecha_hora) existen realmente en la tabla de destino. */
export async function POST(request: Request) {
  const leido = await leerJsonLimitado(request)
  if ("respuesta" in leido) return leido.respuesta

  const claves = (leido.cuerpo as { claves?: unknown })?.claves
  if (!Array.isArray(claves) || claves.length === 0 || claves.length > TAMANO_LOTE) {
    return errorJson(`Envía entre 1 y ${TAMANO_LOTE} claves.`, 422)
  }
  if (!claves.every(esClave)) return errorJson("Alguna clave no es válida.", 422)

  const porCiudad = new Map<string, string[]>()
  for (const c of claves) {
    porCiudad.set(c.ciudad, [...(porCiudad.get(c.ciudad) ?? []), c.fecha_hora])
  }

  try {
    const encontradas = new Set<string>()
    for (const [ciudad, fechas] of porCiudad) {
      for (const grupo of trocear(fechas, FECHAS_POR_CONSULTA)) {
        const { data, error } = await clienteServidor()
          .from(TABLA)
          .select("ciudad, fecha_hora")
          .eq("ciudad", ciudad)
          .in("fecha_hora", grupo)
        if (error) return errorJson(describirError(error), 502)
        for (const fila of data ?? []) {
          // Postgres devuelve "+00:00"; normalizamos para comparar con lo enviado.
          encontradas.add(
            claveMedicion({ ciudad: fila.ciudad, fecha_hora: new Date(fila.fecha_hora).toISOString() })
          )
        }
      }
    }
    const ausentes = claves.filter(
      (c) =>
        !encontradas.has(
          claveMedicion({ ciudad: c.ciudad, fecha_hora: new Date(c.fecha_hora).toISOString() })
        )
    )
    return Response.json({ presentes: claves.length - ausentes.length, ausentes: ausentes.length })
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return errorJson(e.message, 503)
    console.error("[api/verificacion] error inesperado:", (e as Error).message)
    return errorJson("Error inesperado al verificar.", 500)
  }
}
