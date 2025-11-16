"use client";

import { useEffect, useRef } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { SendIcon, XIcon, LoaderIcon } from "lucide-react";
import * as React from "react";
import { useAutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import {
  borderRadius,
  shadows,
  spacing,
  opacity,
} from "@/styles/design-tokens";
import { fetchWithCsrf } from "@/lib/csrf-client";
import {
  ModelSelector,
  type ModelSelectorOption,
} from "@/components/model-selector";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import {
  readCachedModels,
  writeCachedModels,
} from "@/lib/openrouter-model-cache";
import { getStorageItemSync, setStorageItemSync } from "@/lib/storage";

const LAST_MODEL_STORAGE_KEY = "openchat:last-model";

function ChatPreview({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [modelOptions, setModelOptions] = useState<ModelSelectorOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);

  const { apiKey, isLoading: keyLoading } = useOpenRouterKey();
  useEffect(
    () => () => {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    },
    [],
  );

  // Load cached models on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = readCachedModels();
    if (cached && cached.length > 0) {
      setModelOptions(cached);
    }
  }, []);

  // Load last selected model from storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = getStorageItemSync(LAST_MODEL_STORAGE_KEY);
    if (stored && !selectedModel) {
      setSelectedModel(stored);
    }
  }, [selectedModel]);

  // Fetch models when API key is available
  useEffect(() => {
    if (!apiKey || keyLoading) return;

    const fetchModels = async () => {
      setModelsLoading(true);
      try {
        const response = await fetchWithCsrf("/api/openrouter/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey }),
        });
        const data = await response.json();
        if (response.ok && data?.ok) {
          const parsedModels = data.models as ModelSelectorOption[];
          setModelOptions(parsedModels);
          writeCachedModels(parsedModels);

          // Set default model if none selected
          if (!selectedModel && parsedModels.length > 0) {
            const stored = getStorageItemSync(LAST_MODEL_STORAGE_KEY);
            const defaultModel =
              stored && parsedModels.some((m) => m.value === stored)
                ? stored
                : parsedModels[0]!.value;
            setSelectedModel(defaultModel);
            setStorageItemSync(LAST_MODEL_STORAGE_KEY, defaultModel);
          }
        }
      } catch (error) {
        console.error("Failed to fetch models:", error);
      } finally {
        setModelsLoading(false);
      }
    };

    void fetchModels();
  }, [apiKey, keyLoading, selectedModel]);

  const { textareaRef, adjustHeight, debouncedAdjustHeight } =
    useAutoResizeTextarea({
      minHeight: 60,
      maxHeight: 200,
    });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    const messageText = value.trim();
    if (!messageText || isCreating || !selectedModel || !apiKey) return;

    // Clear input INSTANTLY for responsive feel
    setValue("");
    adjustHeight(true);
    setIsCreating(true);

    // Store message and model for chat page to auto-send
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pendingMessage", messageText);
      sessionStorage.setItem("pendingModel", selectedModel);
    }

    try {
      // Create a new empty chat
      const response = await fetchWithCsrf("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });

      if (!response.ok) {
        throw new Error("Failed to create chat");
      }

      const data = await response.json();

      // Redirect to the new chat (message will auto-send from there)
      router.push(`/dashboard/chat/${data.chat.id}`);
    } catch (error) {
      console.error("Failed to create chat:", error);
      // Restore message if failed
      setValue(messageText);
      adjustHeight();
      setIsCreating(false);
    }
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    setStorageItemSync(LAST_MODEL_STORAGE_KEY, modelId);
  };

  const _handleAttachFile = () => {
    const mockFileName = `file-${Math.floor(Math.random() * 1000)}.pdf`;
    setAttachments((prev) => [...prev, mockFileName]);
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Command suggestions removed

  return (
    <div className={cn("w-full", className)}>
      <div className="text-foreground relative w-full overflow-hidden bg-transparent p-0">
        <div className="relative mx-auto w-full max-w-2xl">
          <div className="relative z-10 space-y-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 text-center">
              <div className="inline-block animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
                <h1 className="pb-1 text-3xl font-medium tracking-tight">
                  How can osschat help today?
                </h1>
                <div className="via-primary/50 h-px bg-gradient-to-r from-transparent to-transparent animate-in fade-in-0 duration-400 delay-250" />
              </div>
              <p className="text-muted-foreground text-sm animate-in fade-in-0 duration-300 delay-200">
                Ask a question or type a command
              </p>
            </div>

            <div
              className={cn(
                `border-border bg-card/${opacity.subtle} relative border backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl animate-in fade-in-0 zoom-in-[0.985] duration-300 delay-50`,
                borderRadius.xl,
                shadows.xl,
              )}
            >
              {/* Removed focus ring overlay for a cleaner typing experience */}
              {/* Command palette removed */}

              <div className={spacing.padding.lg}>
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => {
                    setValue(e.target.value);
                    debouncedAdjustHeight();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  className={cn(
                    "w-full px-4 py-3",
                    "resize-none",
                    "bg-transparent",
                    "border-none",
                    "text-foreground text-sm",
                    "focus:outline-none",
                    "placeholder:text-muted-foreground",
                    "min-h-[60px]",
                  )}
                  style={{
                    overflow: "hidden",
                  }}
                  data-ph-no-capture
                  aria-label="Message input"
                />
              </div>

              {attachments.length > 0 && (
                <div className={cn("flex flex-wrap px-4 pb-3 animate-in fade-in-0 duration-200", spacing.gap.sm)}>
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className={cn(
                        "bg-primary/5 text-muted-foreground flex items-center px-3 py-1.5 text-xs animate-in fade-in-0 zoom-in-95 duration-200",
                        borderRadius.md,
                        spacing.gap.sm,
                      )}
                    >
                      <span>{file}</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`Remove ${file}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className={cn(
                  "border-border flex flex-col border-t sm:flex-row sm:items-center sm:justify-between",
                  spacing.gap.lg,
                  spacing.padding.lg,
                )}
              >
                <div className={cn("flex items-center", spacing.gap.sm)}>
                  <ModelSelector
                    options={modelOptions}
                    value={selectedModel}
                    onChange={handleModelChange}
                    disabled={isCreating || modelOptions.length === 0}
                    loading={modelsLoading}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isCreating || !value.trim() || !selectedModel || !apiKey}
                  className={cn(
                    "flex h-9 items-center px-4 text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.98]",
                    borderRadius.lg,
                    spacing.gap.sm,
                    shadows.sm,
                    value.trim() && selectedModel && apiKey
                      ? "bg-primary text-primary-foreground shadow-primary/10 hover:bg-primary/90"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                  aria-label={isCreating ? "Creating chat" : "Send message"}
                  aria-busy={isCreating}
                >
                  {isCreating ? (
                    <LoaderIcon
                      className="size-4 animate-[spin_2s_linear_infinite]"
                      aria-hidden="true"
                    />
                  ) : (
                    <SendIcon className="size-4" aria-hidden="true" />
                  )}
                  <span>Send</span>
                </button>
              </div>
            </div>

            {/* Removed suggested command chips below input */}
          </div>
        </div>

        {/* Neutral look; gradients removed for performance */}
      </div>
    </div>
  );
}

export default React.memo(ChatPreview);

// removed unused TypingDots and ActionButtonProps

const rippleKeyframes = `
@keyframes ripple {
  0% { transform: scale(0.5); opacity: 0.6; }
  100% { transform: scale(2); opacity: 0; }
}
`;

if (typeof document !== "undefined") {
  const STYLE_ID = "chat-preview-ripple-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.innerHTML = rippleKeyframes;
    document.head.appendChild(style);
  }
}
