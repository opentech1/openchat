"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronRight } from "@/lib/icons";
import type { ComponentProps } from "react";
import { createContext, memo, useContext, useEffect, useState } from "react";
import { Streamdown } from "streamdown";

type ReasoningContextValue = {
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  duration: number | undefined;
  redacted: boolean;
};

const ReasoningContext = createContext<ReasoningContextValue | null>(null);

const useReasoning = () => {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error("Reasoning components must be used within Reasoning");
  }
  return context;
};

export type ReasoningProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
  /**
   * When true, shows a message indicating the model reasoned but the provider
   * did not return reasoning data (e.g., some OpenRouter providers redact it)
   */
  redacted?: boolean;
};

// Disabled auto-close - let users manually control the reasoning panel
const AUTO_CLOSE_DELAY = 0;
const MS_IN_S = 1000;

export const Reasoning = memo(
  ({
    className,
    isStreaming = false,
    open,
    defaultOpen = true,
    onOpenChange,
    duration: durationProp,
    redacted = false,
    children,
    ...props
  }: ReasoningProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });
    const [duration, setDuration] = useControllableState({
      prop: durationProp,
      defaultProp: undefined,
    });

    const [hasAutoClosed, setHasAutoClosed] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Track duration when streaming (only if no server-provided duration exists)
    useEffect(() => {
      // If we have a duration from the server, don't override it with client calculation
      if (durationProp !== undefined) return;

      if (isStreaming) {
        if (startTime === null) {
          setStartTime(Date.now());
        }
      } else if (startTime !== null) {
        setDuration(Math.ceil((Date.now() - startTime) / MS_IN_S));
        setStartTime(null);
      }
    }, [isStreaming, startTime, setDuration, durationProp]);

    // Auto-close disabled - let users manually control the reasoning panel
    // The reasoning panel now stays open until the user clicks to close it
    useEffect(() => {
      // Skip auto-close when disabled (AUTO_CLOSE_DELAY <= 0)
      if (AUTO_CLOSE_DELAY <= 0) return;

      if (defaultOpen && !isStreaming && isOpen && !hasAutoClosed) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [isStreaming, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen);
    };

    return (
      <ReasoningContext.Provider
        value={{ isStreaming, isOpen, setIsOpen, duration, redacted }}
      >
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ReasoningContext.Provider>
    );
  }
);

export type ReasoningTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

const ThinkingDots = () => (
  <span className="inline-flex gap-0.5 ml-0.5">
    <span className="size-1 rounded-full bg-current animate-pulse" />
    <span className="size-1 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
    <span className="size-1 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
  </span>
);

const getThinkingText = (isStreaming: boolean, duration?: number, redacted?: boolean) => {
  if (isStreaming) return "Thinking";
  if (redacted) return "Reasoned";
  if (duration === undefined) return "Thought for a few seconds";
  if (duration === 0) return "Thought for <1s";
  if (duration === 1) return "Thought for 1s";
  return `Thought for ${duration}s`;
};

export const ReasoningTrigger = memo(
  ({ className, children, ...props }: ReasoningTriggerProps) => {
    const { isStreaming, isOpen, duration, redacted } = useReasoning();

    return (
      <CollapsibleTrigger
        className={cn(
          "group inline-flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform duration-200",
                isOpen && "rotate-90"
              )}
            />
            <span>{getThinkingText(isStreaming, duration, redacted)}</span>
            {isStreaming && <ThinkingDots />}
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type ReasoningContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  children: string;
};

const REDACTED_MESSAGE = "Reasoning data not available from provider.";

export const ReasoningContent = memo(
  ({ className, children, ...props }: ReasoningContentProps) => {
    const { redacted } = useReasoning();

    return (
      <CollapsibleContent
        className={cn(
          "mt-2 pl-4 border-l-2 border-muted text-sm text-muted-foreground",
          "data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
          className
        )}
        {...props}
      >
        {redacted ? (
          <p className="italic text-muted-foreground/60">{REDACTED_MESSAGE}</p>
        ) : (
          <Streamdown {...props}>{children}</Streamdown>
        )}
      </CollapsibleContent>
    );
  }
);

Reasoning.displayName = "Reasoning";
ReasoningTrigger.displayName = "ReasoningTrigger";
ReasoningContent.displayName = "ReasoningContent";
