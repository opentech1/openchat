import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glowVariants = cva(
  "absolute pointer-events-none",
  {
    variants: {
      variant: {
        // Glow positions - where to place the glow
        top: "-top-1/2 left-1/2 -translate-x-1/2",
        center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        bottom: "-bottom-1/4 left-1/2 -translate-x-1/2",
      },
      size: {
        sm: "w-[200px] h-[200px] sm:w-[300px] sm:h-[300px]",
        md: "w-[300px] h-[300px] sm:w-[500px] sm:h-[500px]",
        lg: "w-[400px] h-[400px] sm:w-[700px] sm:h-[700px]",
        xl: "w-[500px] h-[500px] sm:w-[900px] sm:h-[900px]",
      },
    },
    defaultVariants: {
      variant: "center",
      size: "md",
    },
  }
);

interface GlowProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof glowVariants> {
  // Optional custom color - defaults to primary
  color?: "primary" | "secondary" | "accent";
}

function Glow({ className, variant, size, color = "primary", ...props }: GlowProps) {
  // Generate gradient based on color
  const gradientClass = {
    primary: "from-primary/30 to-primary/5 dark:from-primary/20 dark:to-primary/5",
    secondary: "from-secondary/40 to-secondary/5",
    accent: "from-accent/40 to-accent/5",
  }[color];

  return (
    <div
      className={cn(
        glowVariants({ variant, size }),
        "rounded-full blur-3xl bg-radial",
        gradientClass,
        className
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Glow, glowVariants };
