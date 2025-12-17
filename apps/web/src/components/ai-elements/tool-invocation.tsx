"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { WebSearchIcon, ChevronDownIcon, Check } from "@/lib/icons";
import type { ComponentProps } from "react";
import { createContext, memo, useContext, useEffect, useState } from "react";
import { Shimmer } from "./shimmer";

type ToolInvocationState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

type ToolInvocationContextValue = {
  toolName: string;
  state: ToolInvocationState;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  query?: string;
  resultCount?: number;
  errorText?: string;
};

const ToolInvocationContext = createContext<ToolInvocationContextValue | null>(null);

const useToolInvocation = () => {
  const context = useContext(ToolInvocationContext);
  if (!context) {
    throw new Error("ToolInvocation components must be used within ToolInvocation");
  }
  return context;
};

export type ToolInvocationProps = ComponentProps<typeof Collapsible> & {
  toolName: string;
  state: ToolInvocationState;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  query?: string;
  resultCount?: number;
  errorText?: string;
};

const AUTO_CLOSE_DELAY = 1500;

export const ToolInvocation = memo(
  ({
    className,
    toolName,
    state,
    open,
    defaultOpen = true,
    onOpenChange,
    query,
    resultCount,
    errorText,
    children,
    ...props
  }: ToolInvocationProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });

    const [hasAutoClosed, setHasAutoClosed] = useState(false);

    // Auto-close when tool finishes (once only)
    useEffect(() => {
      if (
        defaultOpen &&
        (state === "output-available" || state === "output-error") &&
        isOpen &&
        !hasAutoClosed
      ) {
        const timer = setTimeout(() => {
          setIsOpen(false);
          setHasAutoClosed(true);
        }, AUTO_CLOSE_DELAY);

        return () => clearTimeout(timer);
      }
    }, [state, isOpen, defaultOpen, setIsOpen, hasAutoClosed]);

    const handleOpenChange = (newOpen: boolean) => {
      setIsOpen(newOpen);
    };

    return (
      <ToolInvocationContext.Provider
        value={{ toolName, state, isOpen, setIsOpen, query, resultCount, errorText }}
      >
        <Collapsible
          className={cn("not-prose mb-4", className)}
          onOpenChange={handleOpenChange}
          open={isOpen}
          {...props}
        >
          {children}
        </Collapsible>
      </ToolInvocationContext.Provider>
    );
  }
);

export type ToolInvocationTriggerProps = ComponentProps<typeof CollapsibleTrigger>;

const getToolIcon = (toolName: string) => {
  switch (toolName) {
    case "search":
      return WebSearchIcon;
    default:
      return WebSearchIcon;
  }
};

const getToolDisplayName = (toolName: string) => {
  switch (toolName) {
    case "search":
      return "Web Search";
    default:
      return toolName.charAt(0).toUpperCase() + toolName.slice(1);
  }
};

const getStatusMessage = (
  toolName: string,
  state: ToolInvocationState,
  query?: string,
  resultCount?: number,
  errorText?: string
) => {
  const displayName = getToolDisplayName(toolName);

  if (state === "input-streaming" || state === "input-available") {
    if (toolName === "search" && query) {
      return (
        <Shimmer duration={1.5}>
          {`Searching for "${query.length > 40 ? query.slice(0, 40) + "..." : query}"...`}
        </Shimmer>
      );
    }
    return <Shimmer duration={1.5}>{`Using ${displayName}...`}</Shimmer>;
  }

  if (state === "output-error") {
    return <span className="text-destructive">{errorText || `${displayName} failed`}</span>;
  }

  // output-available
  if (toolName === "search") {
    if (resultCount !== undefined) {
      return (
        <span className="flex items-center gap-1.5">
          <Check className="size-3.5 text-green-500" />
          Found {resultCount} {resultCount === 1 ? "result" : "results"}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5">
        <Check className="size-3.5 text-green-500" />
        Search complete
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <Check className="size-3.5 text-green-500" />
      {displayName} complete
    </span>
  );
};

export const ToolInvocationTrigger = memo(
  ({ className, children, ...props }: ToolInvocationTriggerProps) => {
    const { toolName, state, isOpen, query, resultCount, errorText } = useToolInvocation();
    const Icon = getToolIcon(toolName);

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
            <Icon className="size-4" />
            {getStatusMessage(toolName, state, query, resultCount, errorText)}
            <ChevronDownIcon
              className={cn(
                "size-4 transition-transform",
                isOpen ? "rotate-180" : "rotate-0"
              )}
            />
          </>
        )}
      </CollapsibleTrigger>
    );
  }
);

export type ToolInvocationContentProps = ComponentProps<typeof CollapsibleContent> & {
  children?: React.ReactNode;
};

export const ToolInvocationContent = memo(
  ({ className, children, ...props }: ToolInvocationContentProps) => {
    const { toolName, query, resultCount } = useToolInvocation();

    return (
      <CollapsibleContent
        className={cn(
          "mt-3 text-sm",
          "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-muted-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
          className
        )}
        {...props}
      >
        {children ?? (
          <div className="flex flex-col gap-1 text-xs text-muted-foreground/80">
            {toolName === "search" && query && (
              <p>Query: &ldquo;{query}&rdquo;</p>
            )}
            {resultCount !== undefined && (
              <p>{resultCount} {resultCount === 1 ? "source" : "sources"} found</p>
            )}
          </div>
        )}
      </CollapsibleContent>
    );
  }
);

ToolInvocation.displayName = "ToolInvocation";
ToolInvocationTrigger.displayName = "ToolInvocationTrigger";
ToolInvocationContent.displayName = "ToolInvocationContent";
