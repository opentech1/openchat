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
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageFile,
} from "./ai-elements/message";
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
import { useModelStore, models, type Model } from "@/stores/model";
import { StartScreen } from "./start-screen";
import { usePersistentChat } from "@/hooks/use-persistent-chat";
import {
  ChevronDownIcon,
  CheckIcon,
  PaperclipIcon,
  ArrowUpIcon,
  SquareIcon,
  GlobeIcon,
} from "lucide-react";

// Reasoning part component for AI messages
interface ReasoningPartProps {
  text: string;
}

function ReasoningPart({ text }: ReasoningPartProps) {
  return (
    <details className="group overflow-hidden rounded-xl border border-border/50 bg-muted/30">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50">
        <span className="text-base">Thinking...</span>
        <span className="ml-auto hidden text-xs opacity-70 group-open:inline">
          Click to collapse
        </span>
        <span className="ml-auto text-xs opacity-70 group-open:hidden">
          Click to expand
        </span>
      </summary>
      <div className="border-t border-border/30 px-4 py-3">
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
          {text}
        </pre>
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

// Map provider names to logo IDs for models.dev SVG logos
const PROVIDER_LOGO_MAP: Record<string, string> = {
  OpenAI: "openai",
  Anthropic: "anthropic",
  Google: "google",
  DeepSeek: "deepseek",
  Meta: "llama",
  xAI: "xai",
};

// Connected Model Selector - Uses AI Elements pattern with SVG logos
interface ConnectedModelSelectorProps {
  disabled?: boolean;
}

function ConnectedModelSelector({ disabled }: ConnectedModelSelectorProps) {
  const { selectedModelId, setSelectedModel } = useModelStore();
  const [open, setOpen] = useState(false);

  const selectedModel = models.find((m: Model) => m.id === selectedModelId);

  // Group models by provider
  const providers = Array.from(new Set(models.map((m: Model) => m.provider)));

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger
        disabled={disabled}
        className={cn(
          "flex items-center gap-2",
          "h-8 px-3 rounded-full",
          "text-sm text-muted-foreground",
          "bg-muted/50 hover:bg-muted hover:text-foreground",
          "border border-border/50",
          "transition-all duration-150",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {selectedModel && (
          <ModelSelectorLogo
            provider={PROVIDER_LOGO_MAP[selectedModel.provider] || "openrouter"}
          />
        )}
        <span className="truncate max-w-[140px]">
          {selectedModel?.name || "Select model"}
        </span>
        <ChevronDownIcon className="size-3.5 opacity-50" />
      </ModelSelectorTrigger>
      <ModelSelectorContent className="w-[420px]">
        <ModelSelectorInput placeholder="Search models..." />
        <ModelSelectorList>
          <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
          {providers.map((provider) => (
            <ModelSelectorGroup key={provider} heading={provider}>
              {models
                .filter((m: Model) => m.provider === provider)
                .map((model) => (
                  <ModelSelectorItem
                    key={model.id}
                    value={model.id}
                    onSelect={() => {
                      setSelectedModel(model.id);
                      setOpen(false);
                    }}
                  >
                    <ModelSelectorLogo
                      provider={PROVIDER_LOGO_MAP[model.provider] || "openrouter"}
                    />
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
  className?: string;
}

function PillButton({ icon, label, onClick, className }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5",
        "h-8 px-3 rounded-full",
        "text-sm text-muted-foreground",
        "bg-muted/50 hover:bg-muted hover:text-foreground",
        "border border-border/50",
        "transition-all duration-150",
        className
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
          "hover:scale-105 active:scale-95"
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
          : "bg-muted text-muted-foreground cursor-not-allowed"
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
        "shadow-lg shadow-black/5"
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
            "resize-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0"
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
          {/* Left side: Model selector + Search + Attach pills */}
          <PromptInputTools className="gap-2">
            {/* Model selector dropdown */}
            <ConnectedModelSelector disabled={isLoading} />

            {/* Search pill */}
            <PillButton
              icon={<GlobeIcon className="size-4" />}
              label="Search"
            />

            {/* Attach pill */}
            <PillButton
              icon={<PaperclipIcon className="size-4" />}
              label="Attach"
              onClick={handleAttachClick}
            />
          </PromptInputTools>

          {/* Right side: Send button */}
          <PromptInputTools>
            <SendButton
              isLoading={isLoading}
              hasContent={hasContent}
              onStop={onStop}
            />
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
  const { messages, sendMessage, status, error, stop, isLoadingMessages } =
    usePersistentChat({
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
    [sendMessage]
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
  error,
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
        const isTextareaFocused = document.activeElement === textarea ||
          textarea.contains(document.activeElement as Node);

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
    [controller.textInput, textareaRef]
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
              {messages.map((message) => (
                <Message
                  key={message.id}
                  from={message.role as "user" | "assistant"}
                >
                  <MessageContent>
                    {(message.parts || []).map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <MessageResponse key={index}>
                            {part.text || ""}
                          </MessageResponse>
                        );
                      }

                      if (part.type === "reasoning") {
                        return (
                          <ReasoningPart key={index} text={part.text || ""} />
                        );
                      }

                      if (part.type === "file") {
                        return (
                          <MessageFile
                            key={index}
                            filename={part.filename}
                            url={part.url}
                            mediaType={part.mediaType}
                          />
                        );
                      }

                      return null;
                    })}
                  </MessageContent>
                </Message>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <LoadingIndicator />
              )}
              {error && <ErrorDisplay error={error} />}
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
