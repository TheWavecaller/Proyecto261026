// third-party
import { cn } from "cn"

// assets
import { Loader2Icon } from "lucide-react"

// Adaptado de UIAble (@uiable/spinner, MIT).

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <Loader2Icon
      role="status"
      aria-label="Cargando"
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  )
}

export { Spinner }
