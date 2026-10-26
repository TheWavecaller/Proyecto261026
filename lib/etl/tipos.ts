/** Fila resultante de convertir los arrays paralelos de Open-Meteo. Conserva los valores tal cual llegaron. */
export interface FilaTransformada {
  /** Posición de la hora dentro de los arrays de la respuesta original. */
  indice: number
  ciudad: string
  /** Hora tal cual llegó en `hourly.time`. */
  hora_original: unknown
  /** Hora interpretada explícitamente como UTC (ISO 8601) o null si no es válida. */
  fecha_hora: string | null
  temperatura_c: unknown
  humedad_pct: unknown
  precipitacion_mm: unknown
}

/** Registro limpio con la estructura normalizada de destino. */
export interface Medicion {
  ciudad: string
  fecha_hora: string
  temperatura_c: number
  humedad_pct: number
  precipitacion_mm: number
}

export type TipoRechazo = "calidad" | "duplicado"

export interface Rechazo {
  fila: FilaTransformada
  tipo: TipoRechazo
  motivos: string[]
}

export type EstadoFase = "pendiente" | "en_curso" | "completada" | "error"

export type CampoOrden =
  | "ciudad"
  | "fecha_hora"
  | "temperatura_c"
  | "humedad_pct"
  | "precipitacion_mm"

export type DireccionOrden = "asc" | "desc"

export interface Orden {
  campo: CampoOrden
  direccion: DireccionOrden
}
