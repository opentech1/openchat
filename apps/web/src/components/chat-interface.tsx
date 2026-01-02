/**
 * Chat Interface - Main conversational UI component
 *
 * Uses AI Elements components for a polished, modern UI:
 * - Conversation for auto-scrolling message container
 * - Message for user/assistant message rendering
 * - PromptInput for message composition with file attachments
 * - ModelSelector for choosing AI models
 * - Streaming response support via AI SDK 5
 * - Convex persistence for chat history
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { UIMessagePart, UIDataTypes, UITools } from "ai";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  useConversationScroll,
} from "./ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageFile } from "./ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputProvider,
  usePromptInputController,
  type PromptInputMessage,
} from "./ai-elements/prompt-input";
import {
  ModelSelector,
  ModelSelectorTrigger,
  ModelSelectorContent,
  ModelSelectorInput,
  ModelSelectorList,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorItem,
  ModelSelectorLogo,
  ModelSelectorName,
} from "./ai-elements/model-selector";
import { useModelStore, useModels, type Model, type ReasoningEffort } from "@/stores/model";
import { useWebSearch } from "@/stores/provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
// Note: Using details/summary instead of Collapsible for now
import { SlidersHorizontalIcon, BrainIcon, SearchIcon, Loader2Icon } from "lucide-react";
import { Streamdown } from "streamdown";
import { StartScreen } from "./start-screen";
import { usePersistentChat } from "@/hooks/use-persistent-chat";
import { toast } from "sonner";
import {
  ChevronDownIcon,
  CheckIcon,
  PaperclipIcon,
  ArrowUpIcon,
  SquareIcon,
  GlobeIcon,
  LinkIcon,
  MinusIcon,
  PlusIcon,
} from "lucide-react";

// Shimmer text effect for streaming content
function ShimmerText({ children }: { children: React.ReactNode }) {
  return (
    <span className="relative inline-block">
      <span className="animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent">
        {children}
      </span>
    </span>
  );
}

// Reasoning part component for AI messages
interface ReasoningPartProps {
  text: string;
  // State from AI SDK: 'streaming' while thinking, 'done' when complete
  state?: "streaming" | "done";
}

function ReasoningPart({ text, state }: ReasoningPartProps) {
  // If state is 'streaming', show animated shimmer. Otherwise (done or undefined with text), show "Thought process"
  const isStreaming = state === "streaming";
  const [isOpen, setIsOpen] = useState(isStreaming); // Auto-open when streaming

  // Auto-open when streaming starts, auto-close when done
  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    } else if (state === "done") {
      // Auto-collapse after streaming completes
      setIsOpen(false);
    }
  }, [isStreaming, state]);

  return (
    <details
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
      className="group overflow-hidden rounded-xl border border-border/50 bg-muted/30"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50 list-none [&::-webkit-details-marker]:hidden">
        {/* Brain icon with pulse animation when streaming */}
        <BrainIcon
          className={cn("size-4 transition-all", isStreaming && "text-primary animate-pulse")}
        />

        <span className="text-sm font-medium">
          {isStreaming ? <ShimmerText>Thinking...</ShimmerText> : "Thought process"}
        </span>

        {/* Streaming indicator */}
        {isStreaming && (
          <span className="flex items-center gap-1 ml-2">
            <span className="size-1.5 rounded-full bg-primary animate-pulse" />
          </span>
        )}

        <span className="ml-auto text-xs opacity-70">
          {isOpen ? "Click to collapse" : "Click to expand"}
        </span>
      </summary>
      <div className="border-t border-border/30 px-4 py-3 max-h-[300px] overflow-y-auto">
        {/* Use Streamdown for markdown rendering in reasoning text */}
        <div
          className={cn(
            "prose prose-sm dark:prose-invert max-w-none",
            "prose-p:text-xs prose-p:leading-relaxed prose-p:text-muted-foreground prose-p:my-1",
            "prose-strong:text-foreground/80 prose-strong:font-semibold",
            "prose-em:text-muted-foreground",
            "prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:rounded",
            "prose-ul:my-1 prose-ol:my-1 prose-li:text-xs prose-li:text-muted-foreground",
            isStreaming && "animate-pulse",
          )}
        >
          <Streamdown>{text || ""}</Streamdown>
        </div>
      </div>
    </details>
  );
}

// Auto-scroll component - scrolls to bottom when messages change
function AutoScroll({ messageCount }: { messageCount: number }) {
  const { scrollToBottom, isAtBottom } = useConversationScroll();
  const prevCountRef = useRef(messageCount);
  const initialScrollDone = useRef(false);

  useEffect(() => {
    // Scroll to bottom on initial load (when we have messages)
    if (messageCount > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      // Multiple scroll attempts to handle layout shifts
      // First: immediate scroll after paint
      requestAnimationFrame(() => {
        scrollToBottom();
        // Second: delayed scroll for async content (images, markdown)
        setTimeout(() => {
          scrollToBottom();
        }, 100);
      });
    }
    // Also scroll when new messages are added and user was at bottom
    else if (messageCount > prevCountRef.current && isAtBottom) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
    prevCountRef.current = messageCount;
  }, [messageCount, scrollToBottom, isAtBottom]);

  return null;
}

// Loading indicator for streaming (no avatar)
function LoadingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-2">
      <span className="size-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:0ms]" />
      <span className="size-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
      <span className="size-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:300ms]" />
    </div>
  );
}

// Realistic skeleton for loading messages (matches actual message styling exactly)
function MessagesLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* User message skeleton - matches MessageResponse user: rounded-2xl bg-primary px-4 py-3 */}
      <div className="flex w-full justify-end">
        <div className="max-w-[85%] flex flex-col items-end">
          <div className="space-y-2">
            <div className="rounded-2xl bg-primary px-4 py-3 animate-pulse">
              <div className="h-[21px] w-40 rounded bg-primary-foreground/20" />
            </div>
          </div>
        </div>
      </div>

      {/* Assistant message skeleton - matches prose text: text-[15px] leading-relaxed text-foreground/90 */}
      <div className="w-full">
        <div className="space-y-2">
          <div className="h-[21px] w-[92%] rounded bg-foreground/10 animate-pulse" />
          <div className="h-[21px] w-[78%] rounded bg-foreground/10 animate-pulse [animation-delay:100ms]" />
          <div className="h-[21px] w-[85%] rounded bg-foreground/10 animate-pulse [animation-delay:200ms]" />
        </div>
      </div>
    </div>
  );
}

// Note: ErrorDisplay removed - errors are now shown inline as messages via InlineErrorMessage

// Inline error message component (like T3.chat) - displayed in message thread
interface InlineErrorMessageProps {
  error: {
    code: string;
    message: string;
    details?: string;
    provider?: string;
    retryable?: boolean;
  };
  onRetry?: () => void;
}

function InlineErrorMessage({ error, onRetry }: InlineErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Get human-readable error title based on code
  const getErrorTitle = (code: string) => {
    switch (code) {
      case "rate_limit":
        return "Rate Limit Exceeded";
      case "auth_error":
        return "Authentication Error";
      case "context_length":
        return "Context Too Long";
      case "content_filter":
        return "Content Filtered";
      case "model_error":
        return "Model Error";
      case "network_error":
        return "Network Error";
      default:
        return "Error";
    }
  };

  return (
    <div className="w-full rounded-xl border border-red-500/30 bg-red-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className="size-5 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-red-400">{getErrorTitle(error.code)}</h4>
          <p className="mt-1 text-sm text-red-300/80">{error.message}</p>
          {error.provider && (
            <p className="mt-1 text-xs text-red-300/60">Provider: {error.provider}</p>
          )}
          {error.details && (
            <div className="mt-2">
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-xs text-red-300/60 hover:text-red-300 transition-colors"
              >
                {showDetails ? "Hide details" : "Show details"}
              </button>
              {showDetails && (
                <pre className="mt-2 p-2 rounded bg-red-950/50 text-xs text-red-300/70 overflow-x-auto max-h-32 overflow-y-auto">
                  {error.details}
                </pre>
              )}
            </div>
          )}
          {error.retryable && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="mt-3 text-red-400 hover:text-red-300 hover:bg-red-500/20"
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Chain of Thought Step type - represents a single reasoning/tool step
interface ChainOfThoughtStep {
  id: string;
  type: "reasoning" | "tool";
  label: string;
  content?: string; // For reasoning text (can be merged from multiple parts)
  toolName?: string; // For tool calls
  toolInput?: unknown; // Tool input/arguments
  toolOutput?: unknown; // Tool output/result
  toolState?: "input-streaming" | "input-available" | "output-available" | "output-error";
  errorText?: string; // For tool errors
  status: "complete" | "active" | "pending" | "error";
}

// Helper to build chain of thought steps from message parts IN ORDER
// This preserves the exact stream order
// Each reasoning part is its own step (not merged) so they can collapse independently
function buildChainOfThoughtSteps(parts: Array<any>): {
  steps: ChainOfThoughtStep[];
  isAnyStreaming: boolean;
  hasTextContent: boolean;
} {
  const steps: ChainOfThoughtStep[] = [];
  let isAnyStreaming = false;
  let hasTextContent = false;
  let reasoningCount = 0;

  // Process parts in their original order (as they came from the stream)
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part.type === "text") {
      hasTextContent = true;
      // Text parts are rendered separately, not in chain of thought
      continue;
    }

    if (part.type === "reasoning") {
      const isStreaming = part.state === "streaming";
      if (isStreaming) isAnyStreaming = true;
      reasoningCount++;

      // Each reasoning part is its own step (so they can collapse independently)
      steps.push({
        id: `reasoning-${i}`,
        type: "reasoning",
        label: isStreaming ? "Thinking..." : "Thought process",
        content: part.text || "",
        status: isStreaming ? "active" : "complete",
      });
    } else if (
      typeof part.type === "string" &&
      part.type.startsWith("tool-") &&
      part.type !== "tool-call" &&
      part.type !== "tool-result"
    ) {
      const toolName = part.type.replace("tool-", "");
      const isStreaming = part.state === "input-streaming";
      const isComplete = part.state === "output-available";
      const isError = part.state === "output-error";

      if (isStreaming) isAnyStreaming = true;

      steps.push({
        id: `tool-${part.toolCallId || i}`,
        type: "tool",
        label: toolName,
        toolName: toolName,
        toolInput: part.input,
        toolOutput: part.output,
        toolState: part.state,
        errorText: part.errorText,
        status: isError ? "error" : isComplete ? "complete" : "active",
      });
    }
  }

  return { steps, isAnyStreaming, hasTextContent };
}

// Chain of Thought Component - Multi-step reasoning visualization
interface ChainOfThoughtProps {
  steps: ChainOfThoughtStep[];
  isStreaming?: boolean;
  hasTextContent?: boolean; // Whether the message has text content (for auto-collapse)
}

function ChainOfThought({
  steps,
  isStreaming = false,
  hasTextContent = false,
}: ChainOfThoughtProps) {
  const [isOpen, setIsOpen] = useState(true); // Start open
  const wasStreamingRef = useRef(isStreaming);
  const hasAutoCollapsedRef = useRef(false);

  // Auto-collapse ONLY when:
  // 1. Streaming transitions from true -> false (message is complete)
  // 2. There is text content (the actual response)
  // 3. We haven't already auto-collapsed this message
  useEffect(() => {
    if (isStreaming) {
      // Currently streaming - keep open and reset flags
      setIsOpen(true);
      wasStreamingRef.current = true;
      hasAutoCollapsedRef.current = false;
    } else if (
      wasStreamingRef.current &&
      !isStreaming &&
      hasTextContent &&
      !hasAutoCollapsedRef.current
    ) {
      // Streaming just finished AND we have text content - auto-collapse after a delay
      hasAutoCollapsedRef.current = true;
      const timer = setTimeout(() => {
        setIsOpen(false);
      }, 500); // Small delay for UX
      return () => clearTimeout(timer);
    }
  }, [isStreaming, hasTextContent]);

  const completedSteps = steps.filter((s) => s.status === "complete").length;
  const errorSteps = steps.filter((s) => s.status === "error").length;
  const hasActiveStep = steps.some((s) => s.status === "active");

  return (
    <details
      className="group overflow-hidden rounded-xl border border-border/50 bg-muted/30 mb-3"
      open={isOpen}
      onToggle={(e) => setIsOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/50 transition-colors list-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-2 flex-1">
          {/* Status indicator */}
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              hasActiveStep
                ? "bg-primary animate-pulse"
                : errorSteps > 0
                  ? "bg-red-500"
                  : "bg-green-500",
            )}
          />
          <span className="font-medium">Thinking</span>
          <span className="text-xs opacity-60">
            {completedSteps}/{steps.length} steps
          </span>
        </div>
        <ChevronDownIcon className="w-4 h-4 transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="border-t border-border/30">
        <div className="divide-y divide-border/30">
          {steps.map((step) => (
            <ChainOfThoughtStepItem key={step.id} step={step} />
          ))}
        </div>
      </div>
    </details>
  );
}

// Individual step item component
function ChainOfThoughtStepItem({ step }: { step: ChainOfThoughtStep }) {
  // Tool steps with output start expanded, reasoning steps follow streaming state
  const [isExpanded, setIsExpanded] = useState(
    step.type === "tool" ? step.toolState === "output-available" : step.status === "active",
  );
  const prevStatusRef = useRef(step.status);

  // Auto-expand when step becomes active
  // Auto-collapse reasoning steps when complete, but keep tool results expanded
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    prevStatusRef.current = step.status;

    if (step.status === "active") {
      // Step became active - expand it
      setIsExpanded(true);
    } else if (prevStatus === "active" && step.status === "complete") {
      // Step just finished - only auto-collapse REASONING steps, not tool results
      if (step.type === "reasoning") {
        const timer = setTimeout(() => {
          setIsExpanded(false);
        }, 300);
        return () => clearTimeout(timer);
      }
      // Tool steps stay expanded when they complete (so user can see results)
    }
  }, [step.status, step.type]);

  // Get icon based on step type
  const getStepIcon = () => {
    if (step.type === "tool") {
      if (step.toolName === "webSearch") {
        return <SearchIcon className="size-3" />;
      }
      return <GlobeIcon className="size-3" />;
    }
    return <BrainIcon className="size-3" />;
  };

  // Get step label
  const getStepLabel = () => {
    if (step.type === "tool") {
      const input = step.toolInput as Record<string, unknown> | undefined;
      const query = input?.query as string | undefined;
      if (step.toolState === "output-available") {
        return `Search: ${query || step.toolName}`;
      }
      if (step.toolState === "output-error") {
        return `Search failed: ${query || step.toolName}`;
      }
      return `Searching: ${query || step.toolName}...`;
    }
    return step.label;
  };

  return (
    <div className="px-4 py-3">
      {/* Step header - clickable to expand/collapse */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-3 w-full text-left"
      >
        {/* Step number/icon indicator */}
        <div
          className={cn(
            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs",
            step.status === "complete" && "bg-green-500/20 text-green-500",
            step.status === "active" && "bg-primary/20 text-primary animate-pulse",
            step.status === "pending" && "bg-muted text-muted-foreground",
          )}
        >
          {getStepIcon()}
        </div>

        {/* Step label */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium truncate",
                step.status === "active" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {getStepLabel()}
            </span>
            {step.status === "active" && (
              <Loader2Icon className="size-3 animate-spin text-primary" />
            )}
          </div>
        </div>

        {/* Expand indicator - show for reasoning with content OR tool with output */}
        {(step.content || (step.type === "tool" && step.toolOutput)) && (
          <ChevronDownIcon
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              isExpanded && "rotate-180",
            )}
          />
        )}
      </button>

      {/* Expandable reasoning content */}
      {isExpanded && step.type === "reasoning" && step.content && (
        <div className="mt-2 ml-9">
          <div
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "prose-p:text-xs prose-p:leading-relaxed prose-p:text-muted-foreground prose-p:my-1",
              "prose-strong:text-foreground/80 prose-strong:font-semibold",
              "prose-em:text-muted-foreground",
              "prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:rounded",
              "prose-ul:my-1 prose-ol:my-1 prose-li:text-xs prose-li:text-muted-foreground",
              "max-h-[200px] overflow-y-auto",
              step.status === "active" && "animate-pulse",
            )}
          >
            <Streamdown>{step.content}</Streamdown>
          </div>
        </div>
      )}

      {/* Tool output display */}
      {step.type === "tool" && step.toolState === "output-available" && step.toolOutput && (
        <div className="mt-2 ml-9">
          <SearchResultsDisplay results={step.toolOutput} isExpanded={isExpanded} />
        </div>
      )}

      {/* Tool error display */}
      {step.type === "tool" && step.toolState === "output-error" && step.errorText && (
        <div className="mt-2 ml-9 text-xs text-red-400">Error: {step.errorText}</div>
      )}
    </div>
  );
}

// Helper to replace UTM source in URLs with osschat.dev
function replaceUtmSource(url: string): string {
  try {
    const urlObj = new URL(url);
    // Replace any existing utm_source with osschat.dev
    if (urlObj.searchParams.has("utm_source")) {
      urlObj.searchParams.set("utm_source", "osschat.dev");
    }
    // Replace utm_medium if it exists
    if (urlObj.searchParams.has("utm_medium")) {
      urlObj.searchParams.set("utm_medium", "referral");
    }
    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

// Search results display component - shows summary collapsed, details when expanded
function SearchResultsDisplay({ results, isExpanded }: { results: unknown; isExpanded: boolean }) {
  // Parse the results - handle different structures from various search tools
  // Could be: array directly, { results: [...] }, { data: [...] }, etc.
  let searchResults: any[] = [];

  if (Array.isArray(results)) {
    searchResults = results;
  } else if (results && typeof results === "object") {
    const obj = results as Record<string, unknown>;
    // Try common patterns for search result structures
    if (Array.isArray(obj.results)) {
      searchResults = obj.results;
    } else if (Array.isArray(obj.data)) {
      searchResults = obj.data;
    } else if (Array.isArray(obj.items)) {
      searchResults = obj.items;
    } else if (Array.isArray(obj.hits)) {
      searchResults = obj.hits;
    } else if (Array.isArray(obj.organic)) {
      // Some search APIs use 'organic' for organic results
      searchResults = obj.organic;
    }
  }

  if (searchResults.length === 0) {
    return <p className="text-xs text-muted-foreground">No results found</p>;
  }

  // When collapsed, just show summary
  if (!isExpanded) {
    return (
      <p className="text-xs text-muted-foreground">
        {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} found
      </p>
    );
  }

  // When expanded, show full results
  return (
    <div className="space-y-2">
      {searchResults.slice(0, 5).map((result: any, i: number) => (
        <div key={i} className="p-2 rounded-md bg-muted/30 border border-border/50">
          <div className="flex items-start gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {result.url || result.link ? (
                <a
                  href={replaceUtmSource(result.url || result.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-primary hover:underline line-clamp-1"
                >
                  {result.title || result.name || result.url || result.link}
                </a>
              ) : (
                <span className="text-xs font-medium text-foreground line-clamp-1">
                  {result.title || result.name || "Result"}
                </span>
              )}
              {(result.description || result.snippet || result.content) && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {result.description || result.snippet || result.content}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
      {searchResults.length > 5 && (
        <p className="text-xs text-muted-foreground">
          +{String(searchResults.length - 5)} more results
        </p>
      )}
    </div>
  );
}

// Reasoning Slider Component - Continuous slider with labels
interface ReasoningSliderProps {
  value: ReasoningEffort;
  onChange: (value: ReasoningEffort) => void;
}

const EFFORT_OPTIONS: ReasoningEffort[] = ["none", "low", "medium", "high"];
const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
};

function ReasoningSlider({ value, onChange }: ReasoningSliderProps) {
  const currentIndex = EFFORT_OPTIONS.indexOf(value);
  const percentage = (currentIndex / (EFFORT_OPTIONS.length - 1)) * 100;

  const handleClick = (index: number) => {
    onChange(EFFORT_OPTIONS[index]);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const index = Math.round(percentage * (EFFORT_OPTIONS.length - 1));
    onChange(EFFORT_OPTIONS[Math.max(0, Math.min(index, EFFORT_OPTIONS.length - 1))]);
  };

  return (
    <div className="space-y-2">
      {/* Slider Track */}
      <div className="relative h-2 cursor-pointer" onClick={handleTrackClick}>
        {/* Background track */}
        <div className="absolute inset-0 bg-muted rounded-full" />

        {/* Filled track */}
        <div
          className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all duration-150"
          style={{ width: `${percentage}%` }}
        />

        {/* Thumb/handle */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full shadow-md border-2 border-background transition-all duration-150"
          style={{ left: `calc(${percentage}% - 8px)` }}
        />

        {/* Click targets at each position */}
        <div className="absolute inset-0 flex justify-between">
          {EFFORT_OPTIONS.map((_, index) => (
            <button
              key={index}
              type="button"
              className="w-4 h-full z-10"
              onClick={(e) => {
                e.stopPropagation();
                handleClick(index);
              }}
            />
          ))}
        </div>
      </div>

      {/* Labels */}
      <div className="flex justify-between text-xs text-muted-foreground">
        {EFFORT_OPTIONS.map((effort, index) => (
          <button
            key={effort}
            type="button"
            onClick={() => handleClick(index)}
            className={cn(
              "transition-colors hover:text-foreground",
              value === effort && "text-foreground font-medium",
            )}
          >
            {EFFORT_LABELS[effort]}
          </button>
        ))}
      </div>
    </div>
  );
}

// Model Config Popover - Reasoning effort slider + Web search toggle
interface ModelConfigPopoverProps {
  disabled?: boolean;
}

function ModelConfigPopover({ disabled }: ModelConfigPopoverProps) {
  const { selectedModelId, reasoningEffort, setReasoningEffort, maxSteps, setMaxSteps } =
    useModelStore();
  const {
    enabled: webSearchEnabled,
    toggle: toggleWebSearch,
    remainingSearches,
    isLimitReached,
  } = useWebSearch();
  const [open, setOpen] = useState(false);

  // Badge text for the button
  const getBadgeText = () => {
    const parts: string[] = [];
    if (reasoningEffort !== "none") {
      parts.push(reasoningEffort.toUpperCase());
    }
    if (webSearchEnabled) {
      parts.push("Search");
    }
    return parts.length > 0 ? parts.join(" + ") : null;
  };

  const badgeText = getBadgeText();

  const handleReasoningChange = (effort: ReasoningEffort) => {
    setReasoningEffort(effort);
  };

  const handleSearchToggle = () => {
    if (isLimitReached && !webSearchEnabled) {
      toast.error("Search limit reached", {
        description: "You've used your 20 daily web searches. Limit resets tomorrow.",
      });
      return;
    }
    toggleWebSearch();
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        disabled={disabled}
        className={cn(
          "flex items-center gap-1.5",
          "h-8 px-3 rounded-full",
          "text-sm",
          "border transition-all duration-150",
          badgeText
            ? "bg-primary/10 text-primary border-primary/50 hover:bg-primary/20"
            : "text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground border-border/50",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <SlidersHorizontalIcon className="size-4" />
        {badgeText && <span className="text-xs font-medium">{badgeText}</span>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 p-3">
        {/* Reasoning Effort Section - Only for OpenAI models */}
        {selectedModelId.startsWith("openai/") && (
          <>
            <div className="flex items-center gap-2 px-0 py-1 text-xs text-muted-foreground">
              <BrainIcon className="size-4" />
              <span className="font-medium">Reasoning effort</span>
            </div>
            <div className="py-2">
              {/* Slider bar with labels */}
              <ReasoningSlider value={reasoningEffort} onChange={handleReasoningChange} />
            </div>
            <DropdownMenuSeparator />
          </>
        )}

        {/* Web Search Section */}
        <div className="flex items-center gap-2 px-0 py-1 text-xs text-muted-foreground">
          <GlobeIcon className="size-4" />
          <span className="font-medium">Web search</span>
          <span className="ml-auto">{remainingSearches} left</span>
        </div>
        <div className="py-2">
          <button
            type="button"
            onClick={handleSearchToggle}
            disabled={isLimitReached && !webSearchEnabled}
            className={cn(
              "w-full flex items-center justify-between py-2 px-3 rounded-lg transition-all",
              webSearchEnabled
                ? "bg-primary/10 border border-primary/30"
                : "bg-muted/50 border border-transparent hover:bg-muted",
              isLimitReached && !webSearchEnabled && "opacity-50 cursor-not-allowed",
            )}
          >
            <span className="text-sm">{webSearchEnabled ? "Enabled" : "Disabled"}</span>
            <div
              className={cn(
                "w-10 h-6 rounded-full transition-all relative",
                webSearchEnabled ? "bg-primary" : "bg-muted-foreground/30",
              )}
            >
              <div
                className={cn(
                  "absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm",
                  webSearchEnabled ? "left-5" : "left-1",
                )}
              />
            </div>
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            Allow the AI to search the web for current information
          </p>
        </div>

        {/* Max iterations control - only show when web search is enabled */}
        {webSearchEnabled && (
          <>
            <DropdownMenuSeparator />
            <div className="flex items-center gap-2 px-0 py-1 text-xs text-muted-foreground">
              <LinkIcon className="size-4" />
              <span className="font-medium">Max iterations</span>
            </div>
            <div className="py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Search/tool steps</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMaxSteps(maxSteps - 1)}
                    disabled={maxSteps <= 1}
                    className={cn(
                      "w-6 h-6 rounded flex items-center justify-center",
                      "bg-muted hover:bg-muted/80 transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <MinusIcon className="size-3" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{maxSteps}</span>
                  <button
                    type="button"
                    onClick={() => setMaxSteps(maxSteps + 1)}
                    disabled={maxSteps >= 10}
                    className={cn(
                      "w-6 h-6 rounded flex items-center justify-center",
                      "bg-muted hover:bg-muted/80 transition-colors",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                    )}
                  >
                    <PlusIcon className="size-3" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Maximum search/tool iterations per response
              </p>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Connected Model Selector - Uses AI Elements pattern with SVG logos
interface ConnectedModelSelectorProps {
  disabled?: boolean;
}

function ConnectedModelSelector({ disabled }: ConnectedModelSelectorProps) {
  const { selectedModelId, setSelectedModel } = useModelStore();
  const { models, modelsByFamily, families, isLoading } = useModels();
  const [open, setOpen] = useState(false);

  const selectedModel = models.find((m: Model) => m.id === selectedModelId);

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger
        disabled={disabled || isLoading}
        className={cn(
          "flex items-center gap-2",
          "h-8 px-3 rounded-full",
          "text-sm text-muted-foreground",
          "bg-muted/50 hover:bg-muted hover:text-foreground",
          "border border-border/50",
          "transition-all duration-150",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {selectedModel && <ModelSelectorLogo provider={selectedModel.providerId || "openrouter"} />}
        <span className="truncate max-w-[140px]">
          {isLoading ? "Loading..." : selectedModel?.name || "Select model"}
        </span>
        <ChevronDownIcon className="size-3.5 opacity-50" />
      </ModelSelectorTrigger>
      <ModelSelectorContent className="w-[420px]">
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {families.map((family: string) => (
            <ModelSelectorGroup key={family} heading={family}>
              {(modelsByFamily[family] || []).map((model: Model) => (
                <ModelSelectorItem
                  key={model.id}
                  value={model.id}
                  onSelect={() => {
                    setSelectedModel(model.id);
                    setOpen(false);
                  }}
                >
                  <ModelSelectorLogo provider={model.providerId || "openrouter"} />
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                  {model.id === selectedModelId ? (
                    <CheckIcon className="ml-auto size-4" />
                  ) : (
                    <div className="ml-auto size-4" />
                  )}
                </ModelSelectorItem>
              ))}
            </ModelSelectorGroup>
          ))}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

// Pill Button Component for Search/Attach
interface PillButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

function PillButton({ icon, label, onClick, active, className }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5",
        "h-8 px-3 rounded-full",
        "text-sm",
        "border transition-all duration-150",
        active
          ? "bg-primary/10 text-primary border-primary/50 hover:bg-primary/20"
          : "text-muted-foreground bg-muted/50 hover:bg-muted hover:text-foreground border-border/50",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Premium Send Button Component
interface SendButtonProps {
  isLoading: boolean;
  hasContent: boolean;
  onStop: () => void;
}

function SendButton({ isLoading, hasContent, onStop }: SendButtonProps) {
  if (isLoading) {
    return (
      <button
        type="button"
        onClick={onStop}
        className={cn(
          "flex items-center justify-center",
          "size-9 rounded-full",
          "bg-foreground text-background",
          "transition-all duration-150",
          "hover:scale-105 active:scale-95",
        )}
        aria-label="Stop generating"
      >
        <SquareIcon className="size-4" />
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={!hasContent}
      className={cn(
        "flex items-center justify-center",
        "size-9 rounded-full",
        "transition-all duration-150",
        hasContent
          ? "bg-primary text-primary-foreground hover:scale-105 active:scale-95"
          : "bg-muted text-muted-foreground cursor-not-allowed",
      )}
      aria-label="Send message"
    >
      <ArrowUpIcon className="size-4" />
    </button>
  );
}

// Premium Prompt Input Component (wrapped)
interface PremiumPromptInputProps {
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  isLoading: boolean;
  onStop: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function PremiumPromptInputInner({
  onSubmit,
  isLoading,
  onStop,
  textareaRef,
}: PremiumPromptInputProps) {
  const controller = usePromptInputController();
  const hasContent = controller.textInput.value.trim().length > 0;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      controller.attachments.add(Array.from(files));
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  return (
    <div
      className={cn(
        // Glass morphism container
        "relative rounded-2xl",
        "bg-background/90 backdrop-blur-xl",
        "border border-border/40",
        "shadow-lg shadow-black/5",
      )}
    >
      <PromptInput
        onSubmit={onSubmit}
        accept="image/*,application/pdf"
        multiple
        className="gap-0 border-0 bg-transparent shadow-none"
      >
        {/* Attachments preview */}
        <PromptInputAttachments>
          {(attachment) => <PromptInputAttachment data={attachment} />}
        </PromptInputAttachments>

        {/* Textarea - taller for better UX */}
        <PromptInputTextarea
          ref={textareaRef}
          placeholder="Type your message here..."
          disabled={isLoading}
          className={cn(
            "min-h-[100px] py-4 px-4",
            "text-[15px] leading-relaxed",
            "placeholder:text-muted-foreground/50",
            "resize-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0",
          )}
        />

        {/* Hidden file input for Attach button */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.json"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Footer - T3.chat inspired layout */}
        <PromptInputFooter className="px-3 pb-3 pt-1">
          {/* Left side: Model selector + Config + Attach pills */}
          <PromptInputTools className="gap-2">
            {/* Model selector dropdown */}
            <ConnectedModelSelector disabled={isLoading} />

            {/* Model config popover (reasoning effort + web search) */}
            <ModelConfigPopover disabled={isLoading} />

            {/* Attach pill */}
            <PillButton
              icon={<PaperclipIcon className="size-4" />}
              label="Attach"
              onClick={handleAttachClick}
            />
          </PromptInputTools>

          {/* Right side: Send button */}
          <PromptInputTools>
            <SendButton isLoading={isLoading} hasContent={hasContent} onStop={onStop} />
          </PromptInputTools>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

// Chat Interface Props
interface ChatInterfaceProps {
  chatId?: string;
}

// Main Chat Interface
export function ChatInterface({ chatId }: ChatInterfaceProps) {
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Use persistent chat hook with Convex integration
  const { messages, sendMessage, status, error, stop, isLoadingMessages } = usePersistentChat({
    chatId,
    onChatCreated: (newChatId) => {
      // Navigate to the new chat page
      navigate({
        to: "/c/$chatId",
        params: { chatId: newChatId },
        replace: true,
      });
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Note: use-stick-to-bottom handles auto-scroll, no manual scroll needed

  // Handle submit from PromptInput
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim() && message.files.length === 0) return;

      await sendMessage({
        text: message.text,
        files: message.files,
      });
    },
    [sendMessage],
  );

  // Note: handlePromptSelect is handled in ChatInterfaceContent
  // because it needs access to the PromptInputProvider context

  // Render immediately - messages will appear as they load from Convex
  // This provides instant navigation feel instead of showing a loading skeleton
  return (
    <PromptInputProvider>
      <ChatInterfaceContent
        messages={messages}
        isLoading={isLoading}
        isLoadingMessages={isLoadingMessages}
        chatId={chatId}
        error={error ?? null}
        stop={stop}
        handleSubmit={handleSubmit}
        textareaRef={textareaRef}
      />
    </PromptInputProvider>
  );
}

// Inner content component that has access to PromptInputProvider context
interface ChatInterfaceContentProps {
  messages: Array<{
    id: string;
    role: string;
    parts?: Array<UIMessagePart<UIDataTypes, UITools>>;
  }>;
  isLoading: boolean;
  isLoadingMessages: boolean;
  chatId?: string;
  error: Error | null;
  stop: () => void;
  handleSubmit: (message: PromptInputMessage) => Promise<void>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function ChatInterfaceContent({
  messages,
  isLoading,
  isLoadingMessages,
  chatId,
  error: _error, // Errors are now shown inline as messages
  stop,
  handleSubmit,
  textareaRef,
}: ChatInterfaceContentProps) {
  const controller = usePromptInputController();

  // Cmd+L / Ctrl+L keybind to toggle focus on prompt input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+L (Mac) or Ctrl+L (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();

        const textarea = textareaRef.current;
        if (!textarea) return;

        // Toggle: if textarea is focused (or contains focus), blur; otherwise focus
        const isTextareaFocused =
          document.activeElement === textarea || textarea.contains(document.activeElement as Node);

        if (isTextareaFocused) {
          textarea.blur();
          // Also blur the document to ensure we're not stuck in the input
          (document.activeElement as HTMLElement)?.blur?.();
        } else {
          textarea.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [textareaRef]);

  // Handler for StartScreen prompt selection - populates input and focuses
  const onPromptSelect = useCallback(
    (prompt: string) => {
      controller.textInput.setInput(prompt);
      // Focus the textarea after setting the value
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    },
    [controller.textInput, textareaRef],
  );

  return (
    <div className="flex h-full flex-col">
      {/* Messages area - using AI Elements Conversation */}
      <Conversation className="flex-1 px-4">
        <AutoScroll messageCount={messages.length} />
        <ConversationContent className="mx-auto max-w-3xl pt-6 pb-16 px-4">
          {/* Smart loading: skeleton for existing chats, StartScreen for new */}
          {messages.length === 0 ? (
            chatId && isLoadingMessages ? (
              <MessagesLoadingSkeleton />
            ) : (
              <StartScreen onPromptSelect={onPromptSelect} />
            )
          ) : (
            <>
              {messages.map((message) => {
                // Cast to include our custom error fields
                const msg = message as typeof message & {
                  error?: {
                    code: string;
                    message: string;
                    details?: string;
                    provider?: string;
                    retryable?: boolean;
                  };
                  messageType?: "text" | "error" | "system";
                };

                // Render error messages with special styling (like T3.chat)
                if (msg.messageType === "error" && msg.error) {
                  return (
                    <Message key={message.id} from={message.role as "user" | "assistant"}>
                      <MessageContent>
                        <InlineErrorMessage error={msg.error} />
                      </MessageContent>
                    </Message>
                  );
                }

                // Skip rendering assistant messages with no meaningful content
                // This handles cases where AI SDK creates empty messages on error
                const allParts = message.parts || [];
                const textContent = allParts
                  .filter((p): p is { type: "text"; text: string } => p.type === "text")
                  .map((p) => p.text)
                  .join("")
                  .trim();
                const hasReasoning = allParts.some((p) => p.type === "reasoning");
                const hasFiles = allParts.some((p) => p.type === "file");

                // Skip empty assistant messages (no text, reasoning, or files)
                // But don't skip during streaming (messages are being built)
                const isCurrentlyStreaming =
                  isLoading && messages[messages.length - 1]?.id === message.id;
                if (
                  message.role === "assistant" &&
                  !textContent &&
                  !hasReasoning &&
                  !hasFiles &&
                  !isCurrentlyStreaming
                ) {
                  return null;
                }

                // Regular message rendering
                // Use buildChainOfThoughtSteps to process parts IN ORDER
                // This preserves the exact stream order and merges consecutive reasoning

                const textParts = allParts.filter((p) => p.type === "text") as unknown as Array<{
                  type: "text";
                  text: string;
                }>;
                const fileParts = allParts.filter((p) => p.type === "file") as unknown as Array<{
                  type: "file";
                  filename?: string;
                  url?: string;
                  mediaType?: string;
                }>;

                // Build thinking steps from reasoning and tool parts
                const {
                  steps: thinkingSteps,
                  isAnyStreaming: isAnyStepStreaming,
                  hasTextContent,
                } = buildChainOfThoughtSteps(allParts);

                return (
                  <Message key={message.id} from={message.role as "user" | "assistant"}>
                    <MessageContent>
                      {/* Thinking UI - shown for any reasoning or tool calls */}
                      {thinkingSteps.length > 0 && (
                        <ChainOfThought
                          steps={thinkingSteps}
                          isStreaming={isAnyStepStreaming}
                          hasTextContent={hasTextContent || textParts.length > 0}
                        />
                      )}

                      {/* Text content */}
                      {textParts.map((part, index) => (
                        <MessageResponse key={`text-${index}`}>{part.text || ""}</MessageResponse>
                      ))}

                      {/* File attachments */}
                      {fileParts.map((part, index) => (
                        <MessageFile
                          key={`file-${index}`}
                          filename={part.filename}
                          url={part.url}
                          mediaType={part.mediaType}
                        />
                      ))}
                    </MessageContent>
                  </Message>
                );
              })}
              {isLoading && messages[messages.length - 1]?.role === "user" && <LoadingIndicator />}
              {/* Note: Errors are now shown inline as messages via InlineErrorMessage */}
            </>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Premium Input area - fixed to bottom */}
      <div className="px-4 pb-4 pt-4">
        <div className="mx-auto max-w-3xl">
          <PremiumPromptInputInner
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onStop={stop}
            textareaRef={textareaRef}
          />
        </div>
      </div>
    </div>
  );
}
