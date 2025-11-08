"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendIcon, LoaderIcon, SquareIcon } from "lucide-react";
import {
  ModelSelector,
  type ModelSelectorOption,
} from "@/components/model-selector";
import { cn } from "@/lib/utils";
import { logError } from "@/lib/logger";
import { useAutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import {
  borderRadius,
  shadows,
  spacing,
  opacity,
  iconSize,
} from "@/styles/design-tokens";
import * as React from "react";

export type ChatComposerProps = {
  onSend: (payload: {
    text: string;
    modelId: string;
    apiKey: string;
  }) => void | Promise<void>;
  disabled?: boolean;
  sendDisabled?: boolean;
  placeholder?: string;
  modelOptions?: ModelSelectorOption[];
  modelValue?: string | null;
  onModelChange?: (value: string) => void;
  modelsLoading?: boolean;
  apiKey?: string | null;
  isStreaming?: boolean;
  onStop?: () => void;
  onMissingRequirement?: (reason: "apiKey" | "model") => void;
};

function ChatComposer({
  onSend,
  disabled,
  sendDisabled,
  placeholder = "Ask OpenChat a question...",
  modelOptions = [],
  modelValue,
  onModelChange,
  modelsLoading,
  apiKey,
  isStreaming = false,
  onStop,
  onMissingRequirement,
}: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackModelId, setFallbackModelId] = useState<string>("");
  const { textareaRef, adjustHeight, debouncedAdjustHeight } =
    useAutoResizeTextarea({ minHeight: 60, maxHeight: 200 });
  const activeModelIdRef = useRef<string>("");

  useEffect(() => {
    if (modelValue) {
      setFallbackModelId(modelValue);
      return;
    }
    if (modelOptions.length === 0) {
      setFallbackModelId("");
      return;
    }
    const hasCurrent =
      fallbackModelId &&
      modelOptions.some((option) => option.value === fallbackModelId);
    if (!hasCurrent) {
      setFallbackModelId(modelOptions[0]!.value);
    }
  }, [modelValue, modelOptions, fallbackModelId]);

  const activeModelId = modelValue ?? fallbackModelId;

  // Keep ref in sync with the latest activeModelId to prevent stale closures
  useEffect(() => {
    activeModelIdRef.current = activeModelId;
  }, [activeModelId]);

  const send = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || sendDisabled || isSending) return;
    // Use ref to get the latest activeModelId value
    const currentModelId = activeModelIdRef.current;
    if (!currentModelId) {
      onMissingRequirement?.("model");
      return;
    }
    if (!apiKey) {
      onMissingRequirement?.("apiKey");
      return;
    }
    setErrorMessage(null);
    setIsSending(true);
    try {
      await onSend({ text: trimmed, modelId: currentModelId, apiKey });
      setValue("");
      adjustHeight(true);
    } catch (error) {
      logError("Failed to send message", error);
      setErrorMessage(
        error instanceof Error && error.message
          ? error.message
          : "Failed to send message. Try again.",
      );
    } finally {
      setIsSending(false);
    }
  }, [
    adjustHeight,
    apiKey,
    sendDisabled,
    isSending,
    onMissingRequirement,
    onSend,
    value,
  ]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const isBusy = isSending || isStreaming;

  return (
    <div
      className={cn(
        `border-border bg-card/${opacity.subtle} relative border backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl animate-in fade-in-0 zoom-in-[0.985] duration-300`,
        borderRadius.xl,
        shadows.xl,
      )}
    >
      <div className={spacing.padding.lg}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (errorMessage) setErrorMessage(null);
            debouncedAdjustHeight();
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
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
          style={{ overflow: "hidden" }}
          disabled={disabled}
          aria-label="Message input"
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? "composer-error" : undefined}
          data-ph-no-capture
        />
      </div>

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
            value={
              modelValue ?? (modelOptions.length === 0 ? null : fallbackModelId)
            }
            onChange={(next) => {
              if (onModelChange) {
                onModelChange(next);
              } else {
                setFallbackModelId(next);
              }
            }}
            disabled={disabled || isBusy || modelOptions.length === 0}
            loading={modelsLoading}
          />
        </div>

        <div className={cn("flex flex-col items-end", spacing.gap.xs)}>
          {errorMessage && (
            <span
              id="composer-error"
              className="text-destructive text-xs font-medium"
              role="alert"
            >
              {errorMessage}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              if (isStreaming) {
                onStop?.();
              } else {
                void send();
              }
            }}
            disabled={
              isStreaming
                ? sendDisabled
                : sendDisabled ||
                  isSending ||
                  !value.trim() ||
                  !activeModelId ||
                  !apiKey
            }
            aria-label={
              isStreaming ? "Stop generating response" : "Send message"
            }
            aria-busy={isSending}
            className={cn(
              "flex h-9 items-center text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.98]",
              borderRadius.lg,
              spacing.gap.sm,
              shadows.sm,
              "px-4",
              isStreaming
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : value.trim()
                  ? "bg-primary text-primary-foreground shadow-primary/10 hover:bg-primary/90"
                  : "bg-muted/50 text-muted-foreground",
            )}
          >
            {isStreaming ? (
              <SquareIcon className="size-4" aria-hidden="true" />
            ) : isSending ? (
              <LoaderIcon
                className="size-4 animate-[spin_2s_linear_infinite]"
                aria-hidden="true"
              />
            ) : (
              <SendIcon className="size-4" aria-hidden="true" />
            )}
            <span>{isStreaming ? "Stop" : "Send"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

ChatComposer.displayName = "ChatComposer";

export default React.memo(ChatComposer);
