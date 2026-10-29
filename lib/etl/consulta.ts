/** Traduce la lectura de Destino (/api/mediciones) a código que se puede copiar y ejecutar. */

const COLUMNAS = "id, ciudad, fecha_hora, temperatura_c, humedad_pct, precipitacion_mm, importado_en"

export interface ParametrosConsulta {
  ciudad: string
  /** ISO en UTC o vacío. */
  desde: string
  hasta: string
  orden: string
  dir: "asc" | "desc"
  pagina: number
  tamano: number
}

const literal = (texto: string) => `'${texto.replaceAll("'", "''")}'`

/** La misma lectura que hace /api/mediciones, escrita en SQL. */
export function consultaSql(p: ParametrosConsulta): string {
  const condiciones = [
    p.ciudad && `ciudad = ${literal(p.ciudad)}`,
    p.desde && `fecha_hora >= ${literal(p.desde)}`,
    p.hasta && `fecha_hora <= ${literal(p.hasta)}`,
  ].filter(Boolean)
  return [
    `select ${COLUMNAS}`,
    "from public.mediciones_meteorologicas",
    condiciones.length > 0 && `where ${condiciones.join("\n  and ")}`,
    `order by ${p.orden} ${p.dir}, id asc`,
    `limit ${p.tamano} offset ${p.pagina * p.tamano};`,
  ]
    .filter(Boolean)
    .join("\n")
}

/** La misma lectura con el cliente oficial, tal como la hace el servidor. */
export function consultaSupabaseJs(p: ParametrosConsulta): string {
  const desde = p.pagina * p.tamano
  return [
    "const { data, count, error } = await supabase",
    '  .from("mediciones_meteorologicas")',
    `  .select("${COLUMNAS}", { count: "exact" })`,
    p.ciudad && `  .eq("ciudad", ${JSON.stringify(p.ciudad)})`,
    p.desde && `  .gte("fecha_hora", ${JSON.stringify(p.desde)})`,
    p.hasta && `  .lte("fecha_hora", ${JSON.stringify(p.hasta)})`,
    `  .order(${JSON.stringify(p.orden)}, { ascending: ${p.dir === "asc"} })`,
    '  .order("id", { ascending: true })',
    `  .range(${desde}, ${desde + p.tamano - 1})`,
  ]
    .filter(Boolean)
    .join("\n")
}

/** Cómo leer en pandas el CSV que descarga «Exportar tabla» en Destino. */
export function lecturaPandas(): string {
  return [
    "import pandas as pd",
    "",
    'df = pd.read_csv("supabase-mediciones.csv", parse_dates=["fecha_hora", "importado_en"])',
    "df.describe()",
  ].join("\n")
}
