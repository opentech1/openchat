"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import * as React from "react";
import { FileUploadButton } from "./file-upload-button";
import { FilePreview } from "./file-preview";
import { useMutation, useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
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

type FileAttachment = {
  storageId: Id<"_storage">;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
};

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
        style={{ overflow: "hidden" }}
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

// Consolidated file upload state
type FileUploadState = {
  uploadingFiles: File[];
  uploadedFiles: FileAttachment[];
};

type FileUploadAction =
  | { type: "ADD_UPLOADING"; payload: File }
  | { type: "REMOVE_UPLOADING"; payload: File }
  | { type: "ADD_UPLOADED"; payload: FileAttachment }
  | { type: "REMOVE_UPLOADED"; payload: number }
  | { type: "CLEAR_UPLOADED" }
  | { type: "RESTORE_UPLOADED"; payload: FileAttachment[] };

function fileUploadReducer(state: FileUploadState, action: FileUploadAction): FileUploadState {
  switch (action.type) {
    case "ADD_UPLOADING":
      return { ...state, uploadingFiles: [...state.uploadingFiles, action.payload] };
    case "REMOVE_UPLOADING":
      return { ...state, uploadingFiles: state.uploadingFiles.filter(f => f !== action.payload) };
    case "ADD_UPLOADED":
      return { ...state, uploadedFiles: [...state.uploadedFiles, action.payload] };
    case "REMOVE_UPLOADED":
      return { ...state, uploadedFiles: state.uploadedFiles.filter((_, i) => i !== action.payload) };
    case "CLEAR_UPLOADED":
      return { ...state, uploadedFiles: [] };
    case "RESTORE_UPLOADED":
      return { ...state, uploadedFiles: action.payload };
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
}: ChatComposerProps) {
  // Consolidated composer state with useReducer
  const [composerState, dispatchComposer] = useReducer(composerReducer, {
    value: initialValue,
    isSending: false,
    errorMessage: null,
    fallbackModelId: "",
  });
  const { value, isSending, errorMessage, fallbackModelId } = composerState;

  // Consolidated file upload state with useReducer
  const [fileUploadState, dispatchFileUpload] = useReducer(fileUploadReducer, {
    uploadingFiles: [],
    uploadedFiles: [],
  });
  const { uploadingFiles, uploadedFiles } = fileUploadState;

  // Reasoning configuration state
  const [internalReasoningConfig, setInternalReasoningConfig] = useState<ReasoningConfig>(
    () => externalReasoningConfig ?? DEFAULT_REASONING_CONFIG
  );

  // Model selector open state for keyboard shortcut
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  const { textareaRef, adjustHeight, debouncedAdjustHeight } =
    useAutoResizeTextarea({ minHeight: 60, maxHeight: 200 });
  const activeModelIdRef = useRef<string>("");

  // Convex mutations and queries
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFileMetadata = useMutation(api.files.saveFileMetadata);
  const quota = useQuery(
    api.files.getUserQuota,
    userId ? { userId } : "skip"
  );

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

    // 3. Count uploaded files (approximate - file descriptions add tokens)
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

  // File upload handler
  const handleFileSelect = useCallback(
    async (file: File) => {
      // Check if we have userId and chatId
      if (!userId || !chatId) {
        toast.error("Unable to upload file. Please try again.");
        return;
      }

      // Check quota first
      if (quota && quota.used >= quota.limit) {
        toast.error("You've reached your file upload limit", { duration: 5000 });
        return;
      }

      // Add to uploading state
      dispatchFileUpload({ type: "ADD_UPLOADING", payload: file });

      try {
        // Step 1: Generate upload URL
        const uploadUrl = await generateUploadUrl({ userId, chatId });

        // Step 2: Upload file to Convex storage
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload file");
        }

        const { storageId } = (await uploadResponse.json()) as {
          storageId: Id<"_storage">;
        };

        // Step 3: Save file metadata and get URL
        const { filename: sanitizedFilename, url } = await saveFileMetadata({
          userId,
          chatId,
          storageId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        });

        // Add to uploaded files with URL
        dispatchFileUpload({
          type: "ADD_UPLOADED",
          payload: {
            storageId,
            filename: sanitizedFilename,
            contentType: file.type,
            size: file.size,
            url: url || undefined,
          },
        });

        toast.success(`${sanitizedFilename} uploaded successfully`);
      } catch (error) {
        logError("Failed to upload file", error);

        // Check if it's a quota error
        if (error instanceof Error && error.message.includes("quota exceeded")) {
          toast.error("You've reached your file upload limit", { duration: 5000 });
        } else {
          toast.error(
            error instanceof Error ? error.message : "Failed to upload file"
          );
        }
      } finally {
        // Remove from uploading state
        dispatchFileUpload({ type: "REMOVE_UPLOADING", payload: file });
      }
    },
    [userId, chatId, quota, generateUploadUrl, saveFileMetadata]
  );

  // Remove uploaded file
  const handleRemoveFile = useCallback((index: number) => {
    dispatchFileUpload({ type: "REMOVE_UPLOADED", payload: index });
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

    // Clear input and files INSTANTLY for responsive feel
    dispatchComposer({ type: "CLEAR_INPUT" });
    adjustHeight(true);
    const attachmentsToSend = uploadedFiles.length > 0 ? uploadedFiles : undefined;
    dispatchFileUpload({ type: "CLEAR_UPLOADED" });

    dispatchComposer({ type: "SET_SENDING", payload: true });
    try {
      await onSend({
        text: trimmed,
        modelId: currentModelId,
        apiKey,
        attachments: attachmentsToSend,
        reasoningConfig: activeReasoningConfig,
      });
    } catch (error) {
      logError("Failed to send message", error);
      // Restore message and files if failed
      dispatchComposer({ type: "RESTORE_MESSAGE", payload: trimmed });
      if (attachmentsToSend) {
        dispatchFileUpload({ type: "RESTORE_UPLOADED", payload: attachmentsToSend });
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

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send]
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
      <div className={spacing.padding.lg}>
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
