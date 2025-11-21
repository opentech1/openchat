'use client';
import { cn } from "@/lib/utils";
import type { HTMLMotionProps } from "motion/react";
import { motion } from "motion/react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

export const GRADIENT_ANGLES = {
  top: 0,
  right: 90,
  bottom: 180,
  left: 270,
};

export type ProgressiveBlurProps = {
  direction?: keyof typeof GRADIENT_ANGLES;
  blurLayers?: number;
  className?: string;
  blurIntensity?: number;
} & HTMLMotionProps<'div'>;

export function ProgressiveBlur({
  direction = 'bottom',
  blurLayers = 8,
  className,
  blurIntensity = 0.25,
  ...props
}: ProgressiveBlurProps) {
  const prefersReducedMotion = useReducedMotion();
  const layers = Math.max(blurLayers, 2);
  const segmentSize = 1 / (blurLayers + 1);
  const effectiveBlurIntensity = prefersReducedMotion ? 0 : blurIntensity;

  return (
    <div className={cn('relative', className)}>
      {Array.from({ length: layers }).map((_, index) => {
        const angle = GRADIENT_ANGLES[direction];
        // Note: White is used for mask gradient (white = visible, black = hidden in CSS masks)
        // This is theme-independent as it only controls the mask, not visible colors
        const gradientStops = [
          index * segmentSize,
          (index + 1) * segmentSize,
          (index + 2) * segmentSize,
          (index + 3) * segmentSize,
        ].map(
          (pos, posIndex) =>
            `rgba(255, 255, 255, ${posIndex === 1 || posIndex === 2 ? 1 : 0}) ${pos * 100}%`
        );

        const gradient = `linear-gradient(${angle}deg, ${gradientStops.join(
          ', '
        )})`;

        return (
          <motion.div
            key={index}
            className='pointer-events-none absolute inset-0 rounded-[inherit]'
            style={{
              maskImage: gradient,
              WebkitMaskImage: gradient,
              backdropFilter: `blur(${index * effectiveBlurIntensity}px)`,
              WebkitBackdropFilter: `blur(${index * effectiveBlurIntensity}px)`,
            }}
            {...props}
          />
        );
      })}
    </div>
  );
}
