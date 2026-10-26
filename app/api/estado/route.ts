import {
  clienteServidor,
  describirError,
  escrituraPermitida,
  TABLA,
  variablesFaltantes,
} from "@/lib/supabase/servidor"

export const dynamic = "force-dynamic"

/** Diagnóstico de la conexión con Supabase para mostrarlo en la interfaz. Nunca devuelve claves. */
export async function GET() {
  const faltan = variablesFaltantes()
  const base = { escrituraPermitida: escrituraPermitida(), faltan }
  if (faltan.length) {
    return Response.json({ ...base, listo: false, mensaje: `Faltan variables: ${faltan.join(", ")}` })
  }
  const { count, error, status } = await clienteServidor()
    .from(TABLA)
    .select("id", { count: "exact", head: true })
  if (error) {
    return Response.json({ ...base, listo: false, mensaje: describirError(error, status) })
  }
  return Response.json({ ...base, listo: true, total: count ?? 0, mensaje: "Conectado" })
}
