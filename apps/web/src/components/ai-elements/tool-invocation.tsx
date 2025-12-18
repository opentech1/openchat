"use client";

import { useControllableState } from "@radix-ui/react-use-controllable-state";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDownIcon, Check } from "@/lib/icons";
import type { ComponentProps } from "react";
import { createContext, memo, useContext, useEffect, useState } from "react";

type ToolInvocationState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

export type SearchResult = {
  title: string;
  url: string;
  content: string;
  description?: string;
};

type ToolInvocationContextValue = {
  toolName: string;
  state: ToolInvocationState;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  query?: string;
  resultCount?: number;
  errorText?: string;
  results?: SearchResult[];
};

const ToolInvocationContext = createContext<ToolInvocationContextValue | null>(null);

const useToolInvocation = () => {
  const context = useContext(ToolInvocationContext);
  if (!context) {
    throw new Error("ToolInvocation components must be used within ToolInvocation");
  }
  return context;
};

export type ToolInvocationProps = Omit<ComponentProps<typeof Collapsible>, "results"> & {
  toolName: string;
  state: ToolInvocationState;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  query?: string;
  resultCount?: number;
  errorText?: string;
  results?: SearchResult[];
};

// Disabled auto-close - let users manually control the panel
const AUTO_CLOSE_DELAY = 0;

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
    results,
    children,
    ...props
  }: ToolInvocationProps) => {
    const [isOpen, setIsOpen] = useControllableState({
      prop: open,
      defaultProp: defaultOpen,
      onChange: onOpenChange,
    });

    const [hasAutoClosed, setHasAutoClosed] = useState(false);

    // Auto-close disabled - let users manually control the panel
    useEffect(() => {
      // Skip auto-close when disabled (AUTO_CLOSE_DELAY <= 0)
      if (AUTO_CLOSE_DELAY <= 0) return;

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
        value={{ toolName, state, isOpen, setIsOpen, query, resultCount, errorText, results }}
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
        <span>
          Searching for "{query.length > 40 ? query.slice(0, 40) + "..." : query}"...
        </span>
      );
    }
    return <span>Using {displayName}...</span>;
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

    return (
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center gap-1.5 text-muted-foreground text-sm transition-colors hover:text-foreground",
          className
        )}
        {...props}
      >
        {children ?? (
          <>
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

const MAX_DISPLAYED_RESULTS = 5;

/**
 * Extract domain from URL for display
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

export const ToolInvocationContent = memo(
  ({ className, children, ...props }: ToolInvocationContentProps) => {
    const { toolName, query, resultCount, results, state } = useToolInvocation();

    const displayedResults = results?.slice(0, MAX_DISPLAYED_RESULTS) ?? [];
    const remainingCount = (results?.length ?? 0) - MAX_DISPLAYED_RESULTS;
    const hasResults = displayedResults.length > 0;
    const isComplete = state === "output-available";

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
          <div className="flex flex-col gap-2 text-xs">
            {/* Query and count header */}
            <div className="flex flex-col gap-0.5 text-muted-foreground/80">
              {toolName === "search" && query && (
                <p>Query: &ldquo;{query}&rdquo;</p>
              )}
              {resultCount !== undefined && (
                <p>{resultCount} {resultCount === 1 ? "source" : "sources"} found</p>
              )}
            </div>

            {/* Search results list */}
            {isComplete && hasResults && (
              <div className="flex flex-col gap-2 mt-1">
                {displayedResults.map((result, index) => (
                  <a
                    key={`${result.url}-${index}`}
                    href={result.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col gap-0.5 py-1.5 px-2 -mx-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <span className="text-foreground font-medium group-hover:text-primary transition-colors line-clamp-1">
                      {result.title || "Untitled"}
                    </span>
                    <span className="text-muted-foreground/70 text-[11px]">
                      {extractDomain(result.url)}
                    </span>
                  </a>
                ))}
                {remainingCount > 0 && (
                  <p className="text-muted-foreground/60 text-[11px] pl-2">
                    + {remainingCount} more {remainingCount === 1 ? "source" : "sources"}
                  </p>
                )}
              </div>
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
