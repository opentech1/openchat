import * as React from "react"

import { cn } from "@/lib/utils"
import { borderRadius } from "@/styles/design-tokens"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        `file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-9 w-full min-w-0 ${borderRadius.sm} border border-input bg-transparent px-4 py-2 text-base outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`,
        "transition-[border-color,box-shadow] duration-100 ease-out",
        "focus:border-ring focus:ring-1 focus:ring-ring/20",
        "aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
