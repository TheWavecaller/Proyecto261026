-- Destino del pipeline ETL Open-Meteo → Supabase.
create table if not exists public.mediciones_meteorologicas (
  id bigint generated always as identity primary key,
  ciudad text not null,
  fecha_hora timestamptz not null,
  temperatura_c double precision not null,
  humedad_pct double precision not null,
  precipitacion_mm double precision not null,
  importado_en timestamptz not null default now(),

  constraint mediciones_meteorologicas_ciudad_fecha_hora_key unique (ciudad, fecha_hora),
  constraint mediciones_meteorologicas_ciudad_no_vacia check (btrim(ciudad) <> ''),
  -- En Postgres NaN es mayor que cualquier número: estos rangos también excluyen NaN e Infinity.
  constraint mediciones_meteorologicas_humedad_rango check (humedad_pct between 0 and 100),
  constraint mediciones_meteorologicas_precipitacion_no_negativa
    check (precipitacion_mm >= 0 and precipitacion_mm < 'Infinity'::double precision),
  constraint mediciones_meteorologicas_temperatura_finita
    check (temperatura_c > '-Infinity'::double precision and temperatura_c < 'Infinity'::double precision)
);

comment on table public.mediciones_meteorologicas is
  'Mediciones horarias (UTC) de Open-Meteo cargadas por el pipeline ETL. importado_en refleja la primera importación.';

create index if not exists mediciones_meteorologicas_fecha_hora_idx
  on public.mediciones_meteorologicas (fecha_hora);

-- RLS activado y sin políticas: anon y authenticated no pueden leer ni escribir.
-- La aplicación escribe y lee solo desde el servidor con la clave secreta, que omite RLS.
alter table public.mediciones_meteorologicas enable row level security;

revoke all on table public.mediciones_meteorologicas from anon, authenticated;
