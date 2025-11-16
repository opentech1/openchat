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
} from "@/styles/design-tokens";
import * as React from "react";
import { FileUploadButton } from "./file-upload-button";
import { FilePreview } from "./file-preview";
import { useMutation, useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { toast } from "sonner";
import type { Id } from "@server/convex/_generated/dataModel";

type FileAttachment = {
  storageId: Id<"_storage">;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
};

export type ChatComposerProps = {
  onSend: (payload: {
    text: string;
    modelId: string;
    apiKey: string;
    attachments?: FileAttachment[];
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
}: ChatComposerProps) {
  const [value, setValue] = useState(initialValue);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fallbackModelId, setFallbackModelId] = useState<string>("");
  const { textareaRef, adjustHeight, debouncedAdjustHeight } =
    useAutoResizeTextarea({ minHeight: 60, maxHeight: 200 });
  const activeModelIdRef = useRef<string>("");

  // File upload state
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<FileAttachment[]>([]);

  // Convex mutations and queries
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const saveFileMetadata = useMutation(api.files.saveFileMetadata);
  const quota = useQuery(
    api.files.getUserQuota,
    userId ? { userId } : "skip"
  );

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

  // Adjust height when initialValue is provided
  useEffect(() => {
    if (initialValue && textareaRef.current) {
      adjustHeight();
    }
  }, [initialValue, adjustHeight, textareaRef]);

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
      setUploadingFiles((prev) => [...prev, file]);

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
        setUploadedFiles((prev) => [
          ...prev,
          {
            storageId,
            filename: sanitizedFilename,
            contentType: file.type,
            size: file.size,
            url: url || undefined,
          },
        ]);

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
        setUploadingFiles((prev) => prev.filter((f) => f !== file));
      }
    },
    [userId, chatId, quota, generateUploadUrl, saveFileMetadata]
  );

  // Remove uploaded file
  const handleRemoveFile = useCallback((index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
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
    setValue("");
    adjustHeight(true);
    const attachmentsToSend = uploadedFiles.length > 0 ? uploadedFiles : undefined;
    setUploadedFiles([]);

    setErrorMessage(null);
    setIsSending(true);
    try {
      await onSend({
        text: trimmed,
        modelId: currentModelId,
        apiKey,
        attachments: attachmentsToSend
      });
    } catch (error) {
      logError("Failed to send message", error);
      // Restore message and files if failed
      setValue(trimmed);
      if (attachmentsToSend) {
        setUploadedFiles(attachmentsToSend);
      }
      adjustHeight();
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
    uploadedFiles,
  ]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

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
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (errorMessage) setErrorMessage(null);
            debouncedAdjustHeight();
          }}
          onKeyDown={onKeyDown}
          onPaste={handlePaste}
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
                setFallbackModelId(next);
              }
            }}
            disabled={disabled || isBusy || modelOptions.length === 0}
            loading={modelsLoading}
          />
          {userId && chatId && (
            <FileUploadButton
              onFileSelect={handleFileSelect}
              disabled={disabled || isBusy || uploadingFiles.length > 0}
              modelCapabilities={
                modelOptions.find(m => m.value === (modelValue ?? fallbackModelId))?.capabilities
              }
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
