// third-party
import { cn } from "cn"

// Adaptado de UIAble (@uiable/skeleton, MIT): usa bg-muted para que se vea sobre las tarjetas.

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
