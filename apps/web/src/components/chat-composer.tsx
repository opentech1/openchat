"use client";

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { SendIcon, LoaderIcon, SquareIcon } from "@/lib/icons";
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
} from "@/styles/design-tokens";
import { FileUploadButton } from "./file-upload-button";
import { FilePreview } from "./file-preview";
import { toast } from "sonner";
import type { Id } from "@server/convex/_generated/dataModel";
import { ReasoningControls } from "./reasoning-controls";
import {
  type ReasoningConfig,
  DEFAULT_REASONING_CONFIG,
  getDefaultReasoningForModel,
} from "@/lib/reasoning-config";
import { getModelCapabilities } from "@/lib/model-capabilities";
import { ContextUsageIndicator } from "@/components/ui/context-usage-indicator";
import { countTokens, countMessagesTokens } from "@/lib/token-counter";
import type { UIMessage } from "ai";
import { CommandAutocomplete } from "./command-autocomplete";
import { CommandBadge } from "./ui/command-badge";
import type { ConvexFileAttachment } from "@/lib/convex-types";
import { useFileUpload } from "@/components/chat-composer/use-file-upload";
import { useCommandParser } from "@/components/chat-composer/use-command-parser";

type FileAttachment = ConvexFileAttachment;

// Extracted textarea component for performance optimization
interface ChatComposerTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled?: boolean;
  errorMessage: string | null;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

const ChatComposerTextarea = React.memo(
  ({
    value,
    onChange,
    onKeyDown,
    onPaste,
    placeholder,
    disabled,
    errorMessage,
    textareaRef,
  }: ChatComposerTextareaProps) => {
    // PERFORMANCE FIX: Memoize inline style
    const textareaStyle = useMemo(() => ({ overflow: "hidden" as const }), []);

    return (
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
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
        style={textareaStyle}
        disabled={disabled}
        aria-label="Message input"
        aria-invalid={!!errorMessage}
        aria-describedby={errorMessage ? "composer-error" : undefined}
        data-ph-no-capture
      />
    );
  }
);

ChatComposerTextarea.displayName = "ChatComposerTextarea";

// Consolidated composer state
type ComposerState = {
  value: string;
  isSending: boolean;
  errorMessage: string | null;
  fallbackModelId: string;
};

type ComposerAction =
  | { type: "SET_VALUE"; payload: string }
  | { type: "SET_SENDING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_FALLBACK_MODEL"; payload: string }
  | { type: "CLEAR_INPUT" }
  | { type: "RESTORE_MESSAGE"; payload: string };

function composerReducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case "SET_VALUE":
      return { ...state, value: action.payload };
    case "SET_SENDING":
      return { ...state, isSending: action.payload };
    case "SET_ERROR":
      return { ...state, errorMessage: action.payload };
    case "SET_FALLBACK_MODEL":
      return { ...state, fallbackModelId: action.payload };
    case "CLEAR_INPUT":
      return { ...state, value: "", errorMessage: null };
    case "RESTORE_MESSAGE":
      return { ...state, value: action.payload };
    default:
      return state;
  }
}

export type ChatComposerProps = {
  onSend: (payload: {
    text: string;
    modelId: string;
    apiKey: string;
    attachments?: FileAttachment[];
    reasoningConfig?: ReasoningConfig;
    jonMode?: boolean;
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
  initialValue?: string;
  userId?: Id<"users"> | null;
  chatId?: Id<"chats"> | null;
  reasoningConfig?: ReasoningConfig;
  onReasoningConfigChange?: (config: ReasoningConfig) => void;
  messages?: UIMessage[];
  jonMode?: boolean;
};

function ChatComposer({
  onSend,
  disabled,
  sendDisabled,
  placeholder = "Type your message...",
  modelOptions = [],
  modelValue,
  onModelChange,
  modelsLoading,
  apiKey,
  isStreaming = false,
  onStop,
  onMissingRequirement,
  initialValue = "",
  userId,
  chatId,
  reasoningConfig: externalReasoningConfig,
  onReasoningConfigChange,
  messages = [],
  jonMode,
}: ChatComposerProps) {
  // Consolidated composer state with useReducer
  const [composerState, dispatchComposer] = useReducer(composerReducer, {
    value: initialValue,
    isSending: false,
    errorMessage: null,
    fallbackModelId: "",
  });
  const { value, isSending, errorMessage, fallbackModelId } = composerState;

  // Use file upload hook
  const {
    uploadingFiles,
    uploadedFiles,
    quota,
    handleFileSelect,
    handleRemoveFile,
    clearUploadedFiles,
    restoreUploadedFiles,
  } = useFileUpload({ userId, chatId });

  // Use command parser hook
  const {
    showCommandAutocomplete,
    partialCommand,
    isCommandValid,
    templates,
    handleTemplateSelect: handleTemplateSelectFromHook,
    closeAutocomplete,
    expandCommandIfNeeded,
    clearCommandState,
  } = useCommandParser({
    value,
    onValueChange: (newValue: string) => {
      dispatchComposer({ type: "SET_VALUE", payload: newValue });
    },
  });

  // Reasoning configuration state
  const [internalReasoningConfig, setInternalReasoningConfig] = useState<ReasoningConfig>(
    () => externalReasoningConfig ?? DEFAULT_REASONING_CONFIG
  );

  // Model selector open state for keyboard shortcut
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  const { textareaRef, adjustHeight, debouncedAdjustHeight } =
    useAutoResizeTextarea({ minHeight: 60, maxHeight: 200 });
  const activeModelIdRef = useRef<string>("");

  useEffect(() => {
    if (modelValue) {
      dispatchComposer({ type: "SET_FALLBACK_MODEL", payload: modelValue });
      return;
    }
    if (modelOptions.length === 0) {
      dispatchComposer({ type: "SET_FALLBACK_MODEL", payload: "" });
      return;
    }
    const hasCurrent =
      fallbackModelId &&
      modelOptions.some((option) => option.value === fallbackModelId);
    if (!hasCurrent) {
      dispatchComposer({ type: "SET_FALLBACK_MODEL", payload: modelOptions[0]!.value });
    }
  }, [modelValue, modelOptions, fallbackModelId]);

  const activeModelId = modelValue ?? fallbackModelId;

  // Keep ref in sync with the latest activeModelId to prevent stale closures
  useEffect(() => {
    activeModelIdRef.current = activeModelId;
  }, [activeModelId]);

  // PERFORMANCE FIX: Memoize model capabilities to prevent unstable reference
  const selectedModelCapabilities = useMemo(
    () => modelOptions.find(m => m.value === activeModelId)?.capabilities,
    [modelOptions, activeModelId]
  );

  // Sync external reasoning config
  useEffect(() => {
    if (externalReasoningConfig !== undefined) {
      setInternalReasoningConfig(externalReasoningConfig);
    }
  }, [externalReasoningConfig]);

  // Reset reasoning config when model changes (and it's a new reasoning-capable model)
  useEffect(() => {
    if (!activeModelId) return;

    const capabilities = getModelCapabilities(activeModelId);
    if (capabilities.reasoning) {
      // Only reset if external config is not provided
      if (externalReasoningConfig === undefined) {
        setInternalReasoningConfig(getDefaultReasoningForModel(activeModelId));
      }
    } else {
      // Non-reasoning model selected, disable reasoning
      setInternalReasoningConfig(DEFAULT_REASONING_CONFIG);
    }
  }, [activeModelId, externalReasoningConfig]);

  // Memoize the active reasoning config
  const activeReasoningConfig = externalReasoningConfig ?? internalReasoningConfig;

  // Calculate total context usage including conversation history
  const currentTokenCount = useMemo(() => {
    // 1. Count all previous messages in conversation history
    const historyTokens = messages.length > 0
      ? countMessagesTokens(messages, activeModelId)
      : 0;

    // 2. Count current input being typed
    const inputTokens = value.trim()
      ? countTokens(value, activeModelId)
      : 0;

    // 3. Count uploaded files (not yet sent - pendingattachment tokens)
    // Note: uploadedFiles contains files attached but NOT yet sent in a message.
    // Once sent, these files become part of messages and are counted in historyTokens.
    // uploadedFiles is cleared after sending (see CLEAR_UPLOADED action), so no double-counting.
    const fileTokens = uploadedFiles.reduce((total, file) => {
      // File references in messages consume tokens
      const description = `File: ${file.filename} (${file.contentType})`;
      return total + countTokens(description, activeModelId);
    }, 0);

    // 4. Total context usage
    return historyTokens + inputTokens + fileTokens;
  }, [messages, value, activeModelId, uploadedFiles]);

  // Get max context length from selected model
  const maxContextTokens = useMemo(() => {
    const selectedModel = modelOptions.find(m => m.value === activeModelId);
    return selectedModel?.context ?? null;
  }, [modelOptions, activeModelId]);

  // Adjust height when initialValue is provided
  useEffect(() => {
    if (initialValue && textareaRef.current) {
      adjustHeight();
    }
  }, [initialValue, adjustHeight, textareaRef]);

  // Keyboard shortcut: Cmd+M / Ctrl+M to open model selector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+M (Mac) or Ctrl+M (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'm') {
        e.preventDefault();
        setModelSelectorOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

    // Check if the message is a command and expand it to the template
    const messageToSend = expandCommandIfNeeded(trimmed);

    // Clear input and files INSTANTLY for responsive feel
    dispatchComposer({ type: "CLEAR_INPUT" });
    adjustHeight(true);
    const attachmentsToSend = uploadedFiles.length > 0 ? uploadedFiles : undefined;
    clearUploadedFiles();

    // Clear command state
    clearCommandState();

    dispatchComposer({ type: "SET_SENDING", payload: true });
    try {
      await onSend({
        text: messageToSend,
        modelId: currentModelId,
        apiKey,
        attachments: attachmentsToSend,
        reasoningConfig: activeReasoningConfig,
        jonMode: jonMode,
      });
    } catch (error) {
      logError("Failed to send message", error);
      // Restore message and files if failed
      dispatchComposer({ type: "RESTORE_MESSAGE", payload: trimmed });
      if (attachmentsToSend) {
        restoreUploadedFiles(attachmentsToSend);
      }
      adjustHeight();
      dispatchComposer({
        type: "SET_ERROR",
        payload: error instanceof Error && error.message
          ? error.message
          : "Failed to send message. Try again.",
      });
    } finally {
      dispatchComposer({ type: "SET_SENDING", payload: false });
    }
  }, [
    adjustHeight,
    apiKey,
    sendDisabled,
    isSending,
    onMissingRequirement,
    onSend,
    value,
    uploadedFiles,
    activeReasoningConfig,
    expandCommandIfNeeded,
    clearUploadedFiles,
    clearCommandState,
    restoreUploadedFiles,
  ]);

  // Handler for reasoning config changes
  const handleReasoningConfigChange = useCallback(
    (config: ReasoningConfig) => {
      if (onReasoningConfigChange) {
        onReasoningConfigChange(config);
      } else {
        setInternalReasoningConfig(config);
      }
    },
    [onReasoningConfigChange]
  );

  // Memoize event handlers to prevent unnecessary re-renders of ChatComposerTextarea
  const handleTextareaChange = useCallback(
    (newValue: string) => {
      dispatchComposer({ type: "SET_VALUE", payload: newValue });
      if (errorMessage) {
        dispatchComposer({ type: "SET_ERROR", payload: null });
      }
      debouncedAdjustHeight();
    },
    [errorMessage, debouncedAdjustHeight]
  );

  // Handle template selection from autocomplete
  const handleTemplateSelect = useCallback(
    (template: { _id: string; name: string; command: string; template: string }) => {
      handleTemplateSelectFromHook(template);
      adjustHeight();

      // Focus back on textarea at the end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 0);
    },
    [adjustHeight, textareaRef, handleTemplateSelectFromHook]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Don't send if command autocomplete is open - let it handle Enter
      if (e.key === "Enter" && !e.shiftKey && !showCommandAutocomplete) {
        e.preventDefault();
        void send();
      }
    },
    [send, showCommandAutocomplete]
  );

  // Handle paste events for images
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        // Check if the pasted item is an image
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await handleFileSelect(file);
          }
          break;
        }
      }
    },
    [handleFileSelect]
  );

  const isBusy = isSending || isStreaming;

  return (
    <div
      className={cn(
        `border-border bg-card/${opacity.subtle} relative border backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl animate-in fade-in-0 zoom-in-[0.985] duration-300`,
        borderRadius.xl,
        shadows.xl,
      )}
    >
      {/* Command Autocomplete */}
      {showCommandAutocomplete && partialCommand && (
        <CommandAutocomplete
          templates={templates}
          partialCommand={partialCommand}
          onSelect={handleTemplateSelect}
          onClose={closeAutocomplete}
        />
      )}

      <div
        className={spacing.padding.lg}
        onClick={(e) => {
          // Only focus if clicking outside the textarea (to allow text selection)
          if (e.target !== textareaRef.current) {
            textareaRef.current?.focus();
          }
        }}
      >
        {/* Command Badge Indicator */}
        {partialCommand && !showCommandAutocomplete && (
          <div className="mb-2">
            <CommandBadge
              command={partialCommand}
              isValid={isCommandValid}
              show={true}
            />
          </div>
        )}

        <ChatComposerTextarea
          value={value}
          onChange={handleTextareaChange}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          errorMessage={errorMessage}
          textareaRef={textareaRef}
        />

        {/* File Previews */}
        {(uploadedFiles.length > 0 || uploadingFiles.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <FilePreview
                key={`uploaded-${index}`}
                file={file}
                onRemove={() => handleRemoveFile(index)}
                showRemove={true}
              />
            ))}
            {uploadingFiles.map((file, index) => (
              <div key={`uploading-${index}`} className="relative">
                <FilePreview
                  file={{
                    filename: file.name,
                    contentType: file.type,
                    size: file.size,
                  }}
                  showRemove={false}
                />
                <div className="absolute inset-0 bg-background/50 rounded flex items-center justify-center">
                  <LoaderIcon className="size-4 animate-spin text-primary" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        className={cn(
          "border-border flex flex-col border-t sm:flex-row sm:items-center sm:justify-between",
          spacing.gap.lg,
          spacing.padding.lg,
        )}
      >
        <div className={cn("flex items-center flex-wrap", spacing.gap.sm)}>
          <ModelSelector
            options={modelOptions}
            value={
              modelValue ?? (modelOptions.length === 0 ? null : fallbackModelId)
            }
            onChange={(next) => {
              if (onModelChange) {
                onModelChange(next);
              } else {
                dispatchComposer({ type: "SET_FALLBACK_MODEL", payload: next });
              }
            }}
            disabled={disabled || isBusy || modelOptions.length === 0}
            loading={modelsLoading}
            open={modelSelectorOpen}
            onOpenChange={setModelSelectorOpen}
          />
          {userId && chatId && (
            <FileUploadButton
              onFileSelect={handleFileSelect}
              disabled={disabled || isBusy || uploadingFiles.length > 0}
              modelCapabilities={selectedModelCapabilities}
              onUnsupportedModel={() => {
                // Find a model with file support
                const fileModel = modelOptions.find(m =>
                  m.capabilities?.image || m.capabilities?.audio || m.capabilities?.video
                );
                if (fileModel && onModelChange) {
                  onModelChange(fileModel.value);
                  toast.success(`Switched to ${fileModel.label}`);
                } else {
                  toast.error("No models with file support available");
                }
              }}
            />
          )}
          {selectedModelCapabilities?.reasoning && (
            <ReasoningControls
              value={activeReasoningConfig}
              onChange={handleReasoningConfigChange}
              modelId={activeModelId}
              capabilities={selectedModelCapabilities}
              disabled={disabled || isBusy}
            />
          )}
          <ContextUsageIndicator
            currentTokens={currentTokenCount}
            maxTokens={maxContextTokens}
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
                  !activeModelId
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
