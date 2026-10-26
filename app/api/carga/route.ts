import { huellaMediciones, validarRegistrosRecibidos } from "@/lib/etl/carga"
import { errorJson, leerJsonLimitado } from "@/lib/supabase/respuestas"
import {
  clienteServidor,
  describirError,
  ErrorConfiguracion,
  escrituraPermitida,
  TABLA,
} from "@/lib/supabase/servidor"

/** Recibe un lote (≤ 500 registros), lo valida de nuevo y hace upsert por (ciudad, fecha_hora). */
export async function POST(request: Request) {
  if (!escrituraPermitida()) {
    return errorJson(
      "Escritura deshabilitada en producción: protege esta ruta y define ETL_PERMITIR_ESCRITURA=true.",
      403
    )
  }

  const leido = await leerJsonLimitado(request)
  if ("respuesta" in leido) return leido.respuesta

  const { registros, errores } = validarRegistrosRecibidos(leido.cuerpo)
  if (!registros) return errorJson(errores, 422)

  try {
    const { data, error } = await clienteServidor()
      .from(TABLA)
      .upsert(registros, { onConflict: "ciudad,fecha_hora", ignoreDuplicates: false })
      .select("id")
    if (error) {
      console.error("[api/carga] upsert fallido:", error.code, error.message)
      return errorJson(describirError(error), 502)
    }
    return Response.json({
      procesados: data?.length ?? 0,
      recibidos: registros.length,
      huella: huellaMediciones(registros),
    })
  } catch (e) {
    if (e instanceof ErrorConfiguracion) return errorJson(e.message, 503)
    console.error("[api/carga] error inesperado:", (e as Error).message)
    return errorJson("Error inesperado al cargar el lote.", 500)
  }
}
