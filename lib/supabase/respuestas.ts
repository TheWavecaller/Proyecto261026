import "server-only"

import { MAX_BYTES_PETICION } from "@/lib/etl/carga"

export function errorJson(mensaje: string | string[], status: number) {
  const errores = Array.isArray(mensaje) ? mensaje : [mensaje]
  return Response.json({ error: errores[0], errores }, { status })
}

/** Lee el cuerpo JSON comprobando el tamaño antes y después de recibirlo. */
export async function leerJsonLimitado(
  request: Request
): Promise<{ cuerpo: unknown } | { respuesta: Response }> {
  const declarado = Number(request.headers.get("content-length") ?? 0)
  if (declarado > MAX_BYTES_PETICION) {
    return { respuesta: errorJson(`La petición supera ${MAX_BYTES_PETICION} bytes.`, 413) }
  }
  const texto = await request.text()
  if (new TextEncoder().encode(texto).length > MAX_BYTES_PETICION) {
    return { respuesta: errorJson(`La petición supera ${MAX_BYTES_PETICION} bytes.`, 413) }
  }
  try {
    return { cuerpo: JSON.parse(texto) }
  } catch {
    return { respuesta: errorJson("El cuerpo no es JSON válido.", 400) }
  }
}
