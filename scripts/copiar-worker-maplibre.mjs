// MapLibre 6 carga su worker desde un archivo aparte que el bundler no sirve:
// se copia a public/ en cada instalación para que coincida siempre con la versión instalada.
import { copyFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"

const require = createRequire(import.meta.url)
const origen = join(dirname(require.resolve("maplibre-gl/package.json")), "dist", "maplibre-gl-worker.mjs")
mkdirSync("public", { recursive: true })
copyFileSync(origen, join("public", "maplibre-gl-worker.mjs"))
