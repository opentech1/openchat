"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  calculateUsagePercentage,
  getUsageColor,
} from "@/lib/token-counter";

interface ContextUsageIndicatorProps {
  /**
   * Current token count
   */
  currentTokens: number;
  /**
   * Maximum token limit from the model
   */
  maxTokens: number | null | undefined;
  /**
   * Optional className for the container
   */
  className?: string;
}

/**
 * ContextUsageIndicator - A circular progress indicator showing context usage
 *
 * Displays a visual representation of how much context is being used relative
 * to the model's maximum context window.
 *
 * @example
 * ```tsx
 * <ContextUsageIndicator
 *   currentTokens={12543}
 *   maxTokens={200000}
 * />
 * ```
 */
export function ContextUsageIndicator({
  currentTokens,
  maxTokens,
  className,
}: ContextUsageIndicatorProps) {
  // Don't render if no max tokens available
  if (!maxTokens || maxTokens <= 0) {
    return null;
  }

  const percentage = calculateUsagePercentage(currentTokens, maxTokens);
  const color = getUsageColor(percentage);

  // SVG circle properties
  const size = 24;
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Color classes
  const colorClasses = {
    green: "text-green-500",
    yellow: "text-yellow-500",
    red: "text-red-500",
  };

  const bgColorClasses = {
    green: "text-green-500/30",
    yellow: "text-yellow-500/30",
    red: "text-red-500/30",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex items-center justify-center",
            "cursor-help",
            "rounded-full p-0.5",
            "hover:bg-muted/50 transition-colors",
            className
          )}
          aria-label={`Context usage: ${currentTokens} of ${maxTokens} tokens`}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90"
          >
            {/* Background circle - always visible */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              className={bgColorClasses[color]}
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              strokeLinecap="round"
              className={cn(
                colorClasses[color],
                "transition-all duration-200 ease-in-out"
              )}
            />
          </svg>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={8}>
        <div className="flex flex-col gap-1">
          <div className="font-medium">Context Usage</div>
          <div className="text-xs opacity-90">
            <div className="font-mono">
              {currentTokens.toLocaleString()} / {maxTokens.toLocaleString()} tokens
            </div>
            <div className="mt-0.5">
              {percentage.toFixed(1)}% used
            </div>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
