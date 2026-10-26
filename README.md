# Pipeline ETL: Open-Meteo → Supabase

Primera práctica de Big Data. Es una aplicación web para ejecutar y observar un pipeline ETL
completo: **extraer** datos horarios de la API histórica de Open-Meteo, **transformarlos**,
**limpiarlos**, **filtrarlos y seleccionarlos**, y **cargarlos** en Supabase. Cada fase muestra
su estado, los registros de entrada y salida y su duración real.

Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui (Base UI) y `@supabase/supabase-js`.

## Instalación

```bash
npm install
cp .env.example .env.local   # y rellena los valores
```

| Variable | Dónde se usa | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | servidor | URL del proyecto (Project Settings → API) |
| `SUPABASE_SECRET_KEY` | **solo servidor** | Clave secreta `sb_secret_…` (o la antigua `service_role`). Nunca con el prefijo `NEXT_PUBLIC_` |
| `ETL_PERMITIR_ESCRITURA` | servidor | En producción la escritura está desactivada salvo que valga `true` (ver Seguridad) |

### Crear la tabla

Aplica la migración [`supabase/migrations/20261026120000_crear_mediciones_meteorologicas.sql`](supabase/migrations/20261026120000_crear_mediciones_meteorologicas.sql):

- **Desde el panel**: SQL Editor → pega el contenido del archivo → Run.
- **Con la CLI**: `npx supabase link --project-ref <ref>` y después `npx supabase db push`.

La tabla `mediciones_meteorologicas` tiene la restricción única `(ciudad, fecha_hora)` y comprueba
que la humedad está en [0, 100], que la precipitación es ≥ 0 y que ningún valor es NaN ni infinito.
Tiene RLS activado y no tiene políticas.

## Ejecución

```bash
npm run dev               # http://localhost:3000
npm test                  # pruebas unitarias con fixtures controlados
npm run test:integracion  # API real de Open-Meteo y endpoints (requiere npm run dev)
npm run typecheck && npm run lint && npm run build
```

## Cómo funciona el pipeline

1. **Extracción**: se hace una petición por ciudad, en serie, a
   `https://archive-api.open-meteo.com/v1/archive` con `timezone=GMT`, °C y mm. Cada extracción
   cubre como máximo 31 días. El JSON original se guarda durante la sesión y se puede descargar.
   Si una ciudad falla, se puede reintentar solo esa ciudad; su respuesta sustituye a la anterior,
   así que no se acumulan duplicados.
2. **Transformación** ([`lib/etl/transformacion.ts`](lib/etl/transformacion.ts)): convierte los
   arrays paralelos de `hourly` en un registro por ciudad y hora. Las horas llegan sin zona
   (`2026-09-01T00:00`) y se interpretan **explícitamente como UTC**. Si los arrays tienen
   longitudes distintas, se avisa y se recorre la longitud máxima, de modo que ningún valor se
   pierde sin que se note. Esta fase no corrige ningún valor.
3. **Limpieza** ([`lib/etl/limpieza.ts`](lib/etl/limpieza.ts)): una fila se rechaza si le falta la
   ciudad, si la fecha no es válida o si alguna medición es null, está vacía, es texto o no es
   finita. **Nunca se convierte nada en 0.** También se rechaza la humedad fuera de [0, 100] y la
   precipitación negativa. No hay umbrales para temperaturas extremas. Ante un **duplicado**
   (ciudad, fecha_hora) se conserva la **primera aparición** en el orden de extracción. Cada
   rechazo indica su motivo y su tipo (calidad o duplicado).
4. **Filtrado y selección** ([`lib/etl/filtros.ts`](lib/etl/filtros.ts)): el orden es
   `válidos → filtros → ordenación → selección → carga`. La paginación solo afecta a la vista. Solo
   se suben las filas seleccionadas que **siguen cumpliendo los filtros actuales**. Las que no los
   cumplen se cuentan aparte y no se seleccionan automáticamente filas nuevas.
5. **Carga** ([`lib/etl/carga.ts`](lib/etl/carga.ts), [`app/api/carga`](app/api/carga/route.ts)):
   al pulsar el botón se congela una copia del conjunto y de su orden. Se envía en lotes de hasta
   500 registros, siempre en serie y sin envíos simultáneos. Cada lote hace un *upsert* por
   `(ciudad, fecha_hora)`. El servidor vuelve a validar los datos y el tamaño de la petición, y
   devuelve una huella de lo que recibió, que se compara con la de la vista previa. Si un lote
   falla, los anteriores conservan su estado y se pueden reintentar solo los fallidos. Después, la
   aplicación consulta el destino para comprobar que todas las claves enviadas existen.
   Supabase no indica en un upsert qué filas se insertaron y cuáles se actualizaron, así que solo
   se informa de las filas «procesadas».

La pestaña **Datos en Supabase** lee la tabla real a través de `/api/mediciones`, con paginación,
filtros y `ORDER BY` explícito. Una base de datos no garantiza el orden de inserción: el orden de
lectura hay que pedirlo siempre.

## Seguridad

- Todas las lecturas y escrituras en Supabase se hacen en el servidor
  ([`lib/supabase/servidor.ts`](lib/supabase/servidor.ts) importa `server-only`). La clave secreta
  no llega al navegador; se ha comprobado que no aparece en `.next/static`.
- RLS está activado sin políticas, y se han revocado los permisos de `anon` y `authenticated`.
- **La aplicación no tiene autenticación.** En desarrollo, `/api/carga` está abierta. En producción
  (Vercel) devuelve 403 salvo que `ETL_PERMITIR_ESCRITURA=true`. Antes de activarla, protege la ruta,
  por ejemplo con Supabase Auth, Vercel Deployment Protection o un middleware.
- Los logs del servidor solo registran el código y el mensaje de error, nunca credenciales.

## Pruebas

- `tests/fixtures/barcelona-2026-09-01.json`: respuesta **real** guardada (1 ciudad, 1 día).
- `tests/fixtures/respuesta-con-problemas.json`: fixture **controlado** con nulls, cadena vacía,
  texto, humedad 104, precipitación negativa, fecha imposible, hora duplicada y un array más corto.
  Solo se usa en los tests; nunca se mezcla con las extracciones reales.
