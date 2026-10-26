import "server-only"

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

export const TABLA = "mediciones_meteorologicas"

function leerConfiguracion() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  // Clave secreta nueva (sb_secret_…) o, en proyectos antiguos, la service_role.
  const clave = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  return { url, clave }
}

export function variablesFaltantes(): string[] {
  const { url, clave } = leerConfiguracion()
  const faltan: string[] = []
  if (!url) faltan.push("NEXT_PUBLIC_SUPABASE_URL")
  if (!clave) faltan.push("SUPABASE_SECRET_KEY")
  return faltan
}

let cliente: SupabaseClient | null = null

/** Cliente con privilegios de servidor. Nunca debe importarse desde un componente de cliente. */
export function clienteServidor(): SupabaseClient {
  const { url, clave } = leerConfiguracion()
  if (!url || !clave) {
    throw new ErrorConfiguracion(`Faltan variables de entorno: ${variablesFaltantes().join(", ")}`)
  }
  cliente ??= createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cliente
}

export class ErrorConfiguracion extends Error {}

/**
 * El proyecto no tiene autenticación: la escritura queda abierta en desarrollo y, en
 * producción, solo si se habilita explícitamente (tras proteger la ruta).
 */
export function escrituraPermitida(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ETL_PERMITIR_ESCRITURA === "true"
}

/** Traduce los errores habituales de Supabase/PostgREST sin exponer credenciales. */
export function describirError(
  error: { code?: string; message?: string },
  status?: number
): string {
  if (error.code === "PGRST205" || error.code === "42P01" || status === 404) {
    return `La tabla ${TABLA} no existe. Aplica la migración de supabase/migrations.`
  }
  if (error.message?.includes("Invalid API key") || status === 401) {
    return "Supabase rechaza la clave secreta (SUPABASE_SECRET_KEY). Revisa .env.local."
  }
  return error.message ?? "Error desconocido de Supabase."
}
