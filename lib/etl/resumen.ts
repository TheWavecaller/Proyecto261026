import type { Medicion, Rechazo } from "./tipos"

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
