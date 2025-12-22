/**
 * Chat Interface - Main conversational UI component
 *
 * Uses AI Elements components for a polished, modern UI:
 * - PromptInput for message composition with file attachments
 * - ModelSelector for choosing AI models
 * - Streaming response support via AI SDK 5
 * - Convex persistence for chat history
 */

"use client";

import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { UIMessagePart, UIDataTypes, UITools } from "ai";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputButton,
  PromptInputSubmit,
  PromptInputAttachments,
  PromptInputAttachment,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
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
  ModelSelectorLogoGroup,
  ModelSelectorName,
} from "./ai-elements/model-selector";
import { useModelStore, models, type Model } from "@/stores/model";
import { usePersistentChat } from "@/hooks/use-persistent-chat";
import {
  SparklesIcon,
  UserIcon,
  FileIcon,
  ChevronDownIcon,
  CheckIcon,
} from "lucide-react";
import { useState } from "react";

// Simple markdown renderer for basic formatting
function renderMarkdown(text: string): React.ReactNode {
  // Split into paragraphs
  const paragraphs = text.split(/\n\n+/);

  return paragraphs.map((paragraph, pIndex) => {
    // Check for code blocks
    if (paragraph.startsWith("```")) {
      const lines = paragraph.split("\n");
      const language = lines[0].slice(3).trim();
      const code = lines.slice(1, -1).join("\n");
      return (
        <pre
          key={pIndex}
          className="my-3 overflow-x-auto rounded-xl bg-muted p-4 text-sm"
        >
          {language && (
            <div className="mb-2 text-xs text-muted-foreground">{language}</div>
          )}
          <code className="font-mono">{code}</code>
        </pre>
      );
    }

    // Check for inline code and bold
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let match;

    while ((match = regex.exec(paragraph)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(paragraph.slice(lastIndex, match.index));
      }

      const matched = match[0];
      if (matched.startsWith("`")) {
        // Inline code
        parts.push(
          <code
            key={`${pIndex}-${match.index}`}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
          >
            {matched.slice(1, -1)}
          </code>
        );
      } else if (matched.startsWith("**")) {
        // Bold
        parts.push(
          <strong key={`${pIndex}-${match.index}`}>
            {matched.slice(2, -2)}
          </strong>
        );
      } else if (matched.startsWith("*")) {
        // Italic
        parts.push(
          <em key={`${pIndex}-${match.index}`}>{matched.slice(1, -1)}</em>
        );
      }

      lastIndex = match.index + matched.length;
    }

    // Add remaining text
    if (lastIndex < paragraph.length) {
      parts.push(paragraph.slice(lastIndex));
    }

    // Handle line breaks within paragraph
    const withLineBreaks: React.ReactNode[] = [];
    parts.forEach((part, index) => {
      if (typeof part === "string") {
        const lines = part.split("\n");
        lines.forEach((line, lineIndex) => {
          if (lineIndex > 0) {
            withLineBreaks.push(<br key={`br-${index}-${lineIndex}`} />);
          }
          if (line) {
            withLineBreaks.push(line);
          }
        });
      } else {
        withLineBreaks.push(part);
      }
    });

    return (
      <p key={pIndex} className="mb-3 last:mb-0">
        {withLineBreaks}
      </p>
    );
  });
}

// Message component
interface MessageProps {
  role: "user" | "assistant" | "system";
  parts: Array<UIMessagePart<UIDataTypes, UITools>>;
}

function Message({ role, parts }: MessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <UserIcon className="size-4" /> : <SparklesIcon className="size-4" />}
      </div>

      {/* Message content */}
      <div className={cn("max-w-[80%] space-y-2")}>
        {parts.map((part, index) => {
          if (part.type === "text") {
            return (
              <div
                key={index}
                className={cn(
                  "rounded-2xl px-4 py-3",
                  isUser
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {renderMarkdown(part.text || "")}
                </div>
              </div>
            );
          }

          if (part.type === "reasoning") {
            return (
              <details
                key={index}
                className="group overflow-hidden rounded-xl border border-border/50 bg-muted/30"
              >
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
                  <span className="text-base">💭</span>
                  <span className="font-medium">Thinking...</span>
                  <span className="ml-auto hidden text-xs opacity-70 group-open:inline">
                    Click to collapse
                  </span>
                  <span className="ml-auto text-xs opacity-70 group-open:hidden">
                    Click to expand
                  </span>
                </summary>
                <div className="border-t border-border/30 px-4 py-3">
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                    {part.text}
                  </pre>
                </div>
              </details>
            );
          }

          if (part.type === "file") {
            // Render images inline
            if (part.mediaType?.startsWith("image/")) {
              return (
                <img
                  key={index}
                  src={part.url}
                  alt={part.filename || "Attached image"}
                  className="max-w-full rounded-lg"
                />
              );
            }

            // Render PDF and other files with icon
            return (
              <div
                key={index}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  isUser
                    ? "border-primary-foreground/20 bg-primary-foreground/10"
                    : "border-border bg-background/50"
                )}
              >
                <FileIcon className="size-4" />
                <span className="truncate text-sm">
                  {part.filename || "Attached file"}
                </span>
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

// Loading indicator for streaming
function LoadingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SparklesIcon className="size-4" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
        <span className="size-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:0ms]" />
        <span className="size-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
        <span className="size-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

// Empty state
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <SparklesIcon className="size-6" />
      </div>
      <div>
        <h2 className="text-lg font-medium">Start a conversation</h2>
        <p className="text-sm text-muted-foreground">
          Ask me anything - I'm here to help.
        </p>
      </div>
    </div>
  );
}

// Error display
function ErrorDisplay({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-center">
      <p className="text-sm text-destructive">
        {error.message || "Something went wrong. Please try again."}
      </p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      )}
    </div>
  );
}

// Connected Model Selector using AI Elements
interface ConnectedModelSelectorProps {
  disabled?: boolean;
}

function ConnectedModelSelector({ disabled }: ConnectedModelSelectorProps) {
  const { selectedModelId, setSelectedModel } = useModelStore();
  const [open, setOpen] = useState(false);

  const selectedModel = models.find((m: Model) => m.id === selectedModelId);

  // Group models by provider
  const groupedModels = models.reduce(
    (acc: Record<string, Model[]>, model: Model) => {
      const provider = model.provider;
      if (!acc[provider]) {
        acc[provider] = [];
      }
      acc[provider].push(model);
      return acc;
    },
    {} as Record<string, Model[]>
  );

  // Map provider names to logo IDs
  const providerLogoMap: Record<string, string> = {
    OpenAI: "openai",
    Anthropic: "anthropic",
    Google: "google",
    DeepSeek: "deepseek",
    Meta: "llama",
  };

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            className="gap-2 text-muted-foreground"
          />
        }
      >
        {selectedModel && (
          <ModelSelectorLogoGroup>
            <ModelSelectorLogo
              provider={providerLogoMap[selectedModel.provider] || "openrouter"}
            />
          </ModelSelectorLogoGroup>
        )}
        <span className="truncate">{selectedModel?.name || "Select model"}</span>
        <ChevronDownIcon className="size-4 opacity-50" />
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {Object.entries(groupedModels).map(([provider, providerModels]) => (
            <ModelSelectorGroup key={provider} heading={provider}>
              {providerModels.map((model) => (
                <ModelSelectorItem
                  key={model.id}
                  value={model.id}
                  onSelect={() => {
                    setSelectedModel(model.id);
                    setOpen(false);
                  }}
                  className="gap-2"
                >
                  <ModelSelectorLogoGroup>
                    <ModelSelectorLogo
                      provider={providerLogoMap[model.provider] || "openrouter"}
                    />
                  </ModelSelectorLogoGroup>
                  <ModelSelectorName>{model.name}</ModelSelectorName>
                  {model.id === selectedModelId && (
                    <CheckIcon className="ml-auto size-4" />
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

// Chat Interface Props
interface ChatInterfaceProps {
  chatId?: string;
}

// Main Chat Interface
export function ChatInterface({ chatId }: ChatInterfaceProps) {
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Use persistent chat hook with Convex integration
  const {
    messages,
    sendMessage,
    status,
    error,
    stop,
    isLoadingMessages,
  } = usePersistentChat({
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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle submit from PromptInput
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      if (!message.text.trim() && message.files.length === 0) return;

      await sendMessage({
        text: message.text,
        files: message.files,
      });
    },
    [sendMessage]
  );

  // Show loading state while fetching messages for existing chat
  if (isLoadingMessages) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Loading conversation...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              {messages.map((message) => (
                <Message
                  key={message.id}
                  role={message.role as "user" | "assistant"}
                  parts={message.parts || []}
                />
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <LoadingIndicator />
              )}
              {error && <ErrorDisplay error={error} />}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-3xl px-4 py-4">
          <PromptInput
            onSubmit={handleSubmit}
            accept="image/*,application/pdf"
            multiple
            className="gap-0"
          >
            {/* Attachments preview */}
            <PromptInputAttachments>
              {(attachment) => <PromptInputAttachment data={attachment} />}
            </PromptInputAttachments>

            {/* Textarea */}
            <PromptInputTextarea
              placeholder="Type your message..."
              disabled={isLoading}
            />

            {/* Footer with tools */}
            <PromptInputFooter>
              <PromptInputTools>
                {/* Model selector */}
                <ConnectedModelSelector disabled={isLoading} />

                {/* Attachments menu */}
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionAddAttachments />
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
              </PromptInputTools>

              <PromptInputTools>
                {/* Stop button when loading */}
                {isLoading && (
                  <PromptInputButton onClick={stop}>Stop</PromptInputButton>
                )}

                {/* Submit button */}
                <PromptInputSubmit status={status} disabled={isLoading} />
              </PromptInputTools>
            </PromptInputFooter>
          </PromptInput>

          {/* Keyboard hint */}
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px]">
              Enter
            </kbd>
            <span>to send</span>
            <span className="text-border">|</span>
            <kbd className="inline-flex h-5 items-center rounded border border-border bg-muted px-1.5 font-mono text-[10px]">
              Shift + Enter
            </kbd>
            <span>for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
}
