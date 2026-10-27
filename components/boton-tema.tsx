"use client"

import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

/** Los dos iconos se pintan siempre y el CSS decide cuál se ve: no hay desajuste de hidratación. */
export function BotonTema() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <Button
      variant="outline"
      size="icon"
      className="rounded-full"
      aria-label="Cambiar entre modo claro y oscuro (tecla D)"
      title="Modo claro / oscuro (D)"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  )
}
