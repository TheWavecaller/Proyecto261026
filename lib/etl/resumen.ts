import type { Medicion, Rechazo } from "./tipos"

const HORA_MS = 60 * 60 * 1000
const DIA_MS = 24 * HORA_MS

export type MedidaGrafica = "temperatura_c" | "humedad_pct" | "precipitacion_mm"

export interface SerieTemporal {
  /** "hora" si el periodo cabe en 7 días; si no, una media (o suma de lluvia) por día UTC. */
  resolucion: "hora" | "dia"
  /** Un punto por instante; cada ciudad es una clave con su valor o ausente si no tiene dato. */
  puntos: ({ t: number } & Record<string, number>)[]
}

/**
 * Prepara una serie por ciudad para la gráfica. La precipitación diaria se suma (mm/día); la
 * temperatura y la humedad diarias se promedian. Las horas sin dato no se rellenan.
 */
export function serieTemporal(filas: readonly Medicion[], medida: MedidaGrafica): SerieTemporal {
  let min = Infinity
  let max = -Infinity
  for (const m of filas) {
    const t = Date.parse(m.fecha_hora)
    min = Math.min(min, t)
    max = Math.max(max, t)
  }
  const resolucion = filas.length > 0 && max - min > 7 * DIA_MS ? "dia" : "hora"
  const paso = resolucion === "dia" ? DIA_MS : HORA_MS

  const cubos = new Map<number, Map<string, { suma: number; n: number }>>()
  for (const m of filas) {
    const t = Math.floor(Date.parse(m.fecha_hora) / paso) * paso
    const porCiudad = cubos.get(t) ?? cubos.set(t, new Map()).get(t)!
    const a = porCiudad.get(m.ciudad) ?? { suma: 0, n: 0 }
    a.suma += m[medida]
    a.n++
    porCiudad.set(m.ciudad, a)
  }

  const sumar = medida === "precipitacion_mm"
  const puntos = [...cubos.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, porCiudad]) => {
      const punto: { t: number } & Record<string, number> = { t }
      for (const [ciudad, a] of porCiudad) punto[ciudad] = sumar ? a.suma : a.suma / a.n
      return punto
    })
  return { resolucion, puntos }
}

/** Agrupa los motivos quitando el valor concreto: «Humedad fuera de [0, 100] %: 104» → sin «: 104». */
export function categoriaMotivo(rechazo: Rechazo, motivo: string): string {
  if (rechazo.tipo === "duplicado") return "Duplicado (ciudad, fecha_hora)"
  const m = /^(Humedad fuera de \[0, 100\] %|Precipitación negativa|Fecha y hora no válida): /.exec(motivo)
  return m ? m[1] : motivo
}

/** Cuántas veces aparece cada motivo. Una fila con dos problemas cuenta en ambos. */
export function contarMotivos(rechazados: readonly Rechazo[]): { motivo: string; total: number }[] {
  const cuenta = new Map<string, number>()
  for (const r of rechazados) {
    for (const motivo of new Set(r.motivos.map((m) => categoriaMotivo(r, m)))) {
      cuenta.set(motivo, (cuenta.get(motivo) ?? 0) + 1)
    }
  }
  return [...cuenta.entries()]
    .map(([motivo, total]) => ({ motivo, total }))
    .sort((a, b) => b.total - a.total || a.motivo.localeCompare(b.motivo, "es"))
}

export interface PerfilMedida {
  medida: MedidaGrafica
  n: number
  media: number
  /** Desviación típica muestral (n − 1), como pandas; 0 con un solo valor. */
  desviacion: number
  min: number
  p25: number
  p50: number
  p75: number
  max: number
}

/** Percentil con interpolación lineal entre posiciones (el método por defecto de pandas). */
function percentil(ordenados: readonly number[], q: number): number {
  const pos = (ordenados.length - 1) * q
  const i = Math.floor(pos)
  const resto = pos - i
  return i + 1 < ordenados.length ? ordenados[i] + resto * (ordenados[i + 1] - ordenados[i]) : ordenados[i]
}

/**
 * Estadística descriptiva de cada medida, equivalente a `df.describe()`. Devuelve null si no
 * hay filas: no se inventan valores.
 */
export function perfilMedidas(filas: readonly Medicion[]): PerfilMedida[] | null {
  if (filas.length === 0) return null
  const medidas: MedidaGrafica[] = ["temperatura_c", "humedad_pct", "precipitacion_mm"]
  return medidas.map((medida) => {
    const valores = filas.map((m) => m[medida]).sort((a, b) => a - b)
    const n = valores.length
    const media = valores.reduce((t, v) => t + v, 0) / n
    const varianza = n > 1 ? valores.reduce((t, v) => t + (v - media) ** 2, 0) / (n - 1) : 0
    return {
      medida,
      n,
      media,
      desviacion: Math.sqrt(varianza),
      min: valores[0],
      p25: percentil(valores, 0.25),
      p50: percentil(valores, 0.5),
      p75: percentil(valores, 0.75),
      max: valores[n - 1],
    }
  })
}

export interface MedidasCiudad {
  temperaturaMedia: number
  temperaturaMin: number
  temperaturaMax: number
  humedadMedia: number
  precipitacionTotal: number
}

export interface ResumenCiudad {
  validos: number
  rechazados: number
  /** null si la ciudad no tiene ningún registro válido: no se inventan medias. */
  medidas: MedidasCiudad | null
}

/** Agrega por nombre de ciudad los registros válidos y cuenta los rechazados. */
export function resumirPorCiudad(
  validos: readonly Medicion[],
  rechazados: readonly Rechazo[]
): Record<string, ResumenCiudad> {
  const acumulado: Record<
    string,
    { validos: number; rechazados: number; temp: number; min: number; max: number; hum: number; prec: number }
  > = {}
  const de = (ciudad: string) =>
    (acumulado[ciudad] ??= { validos: 0, rechazados: 0, temp: 0, min: Infinity, max: -Infinity, hum: 0, prec: 0 })

  for (const m of validos) {
    const a = de(m.ciudad)
    a.validos++
    a.temp += m.temperatura_c
    a.min = Math.min(a.min, m.temperatura_c)
    a.max = Math.max(a.max, m.temperatura_c)
    a.hum += m.humedad_pct
    a.prec += m.precipitacion_mm
  }
  for (const r of rechazados) {
    if (r.fila.ciudad) de(r.fila.ciudad).rechazados++
  }

  return Object.fromEntries(
    Object.entries(acumulado).map(([ciudad, a]) => [
      ciudad,
      {
        validos: a.validos,
        rechazados: a.rechazados,
        medidas:
          a.validos === 0
            ? null
            : {
                temperaturaMedia: a.temp / a.validos,
                temperaturaMin: a.min,
                temperaturaMax: a.max,
                humedadMedia: a.hum / a.validos,
                precipitacionTotal: a.prec,
              },
      },
    ])
  )
}
