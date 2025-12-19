"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { SendIcon, LoaderIcon, StopIcon, Check } from "@/lib/icons";
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
import { ReasoningSettingsButton } from "./reasoning-settings-button";
import { ReasoningSettingsPopover } from "./reasoning-settings-popover";
import {
  type ReasoningConfig,
  DEFAULT_REASONING_CONFIG,
  getDefaultReasoningForModel,
} from "@/lib/reasoning-config";
import { type SearchConfig, DEFAULT_SEARCH_CONFIG } from "@/lib/search-config";
import { getModelCapabilities, hasReasoningCapability } from "@/lib/model-capabilities";
import { SearchSettingsButton } from "./search-settings-button";
import { ContextUsageIndicator } from "@/components/ui/context-usage-indicator";
import { countTokens, countMessagesTokens } from "@/lib/token-counter";
import type { UIMessage } from "ai";
import { CommandAutocomplete } from "./command-autocomplete";
import { CommandBadge } from "./ui/command-badge";
import {
  isCommandStart,
  extractPartialCommand,
  parseCommand,
  applyTemplate,
} from "@/lib/template-parser";
import { useConvexUser } from "@/contexts/convex-user-context";

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
  isSending?: boolean;
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
    isSending,
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
          "placeholder:text-muted-foreground/70 placeholder:text-sm",
          "min-h-[60px]",
          "transition-all duration-150 ease-out",
          isSending && "animate-[pulse-flash_150ms_ease-out]",
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
  showSentSuccess: boolean;
  errorMessage: string | null;
  fallbackModelId: string;
};

type ComposerAction =
  | { type: "SET_VALUE"; payload: string }
  | { type: "SET_SENDING"; payload: boolean }
  | { type: "SET_SENT_SUCCESS"; payload: boolean }
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
    case "SET_SENT_SUCCESS":
      return { ...state, showSentSuccess: action.payload };
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
    searchConfig?: SearchConfig;
    jonMode?: boolean;
    localDate?: string;
    createdChatId?: Id<"chats">; // Chat ID if one was created during file upload
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
  /**
   * Callback to create a chat when needed (e.g., for file upload on root page).
   * Returns the created chat ID.
   */
  onCreateChat?: () => Promise<Id<"chats"> | null>;
  reasoningConfig?: ReasoningConfig;
  onReasoningConfigChange?: (config: ReasoningConfig) => void;
  searchConfig?: SearchConfig;
  onSearchConfigChange?: (config: SearchConfig) => void;
  messages?: UIMessage[];
  jonMode?: boolean;
  /**
   * Message to restore to the composer (e.g., after rate limit error for retry)
   */
  messageToRestore?: string | null;
  /**
   * Callback when message has been restored to composer
   */
  onMessageRestored?: () => void;
};

function ChatComposer({
  onSend,
  disabled,
  sendDisabled,
  placeholder = "Type a message... (Shift+Enter for new line)",
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
  chatId: externalChatId,
  onCreateChat,
  reasoningConfig: externalReasoningConfig,
  onReasoningConfigChange,
  searchConfig: externalSearchConfig,
  onSearchConfigChange,
  messages = [],
  jonMode,
  messageToRestore,
  onMessageRestored,
}: ChatComposerProps) {
  // Consolidated composer state with useReducer
  const [composerState, dispatchComposer] = useReducer(composerReducer, {
    value: initialValue,
    isSending: false,
    showSentSuccess: false,
    errorMessage: null,
    fallbackModelId: "",
  });
  const { value, isSending, showSentSuccess, errorMessage, fallbackModelId } = composerState;

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

  // Search configuration state
  const [internalSearchConfig, setInternalSearchConfig] = useState<SearchConfig>(
    () => externalSearchConfig ?? DEFAULT_SEARCH_CONFIG
  );

  // Model selector open state for keyboard shortcut
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);

  // Command autocomplete state
  const [showCommandAutocomplete, setShowCommandAutocomplete] = useState(false);
  const [partialCommand, setPartialCommand] = useState<string | null>(null);
  const [isCommandValid, setIsCommandValid] = useState(false);

  // Internal chat ID state - used when a chat is created during file upload on root page
  const [internalChatId, setInternalChatId] = useState<Id<"chats"> | null>(null);
  const [isCreatingChat, setIsCreatingChat] = useState(false);

  // Effective chatId: use external if provided, otherwise use internally created one
  const chatId = externalChatId ?? internalChatId;

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

  // Fetch user's prompt templates for command autocomplete
  const { convexUser } = useConvexUser();
  const templatesResult = useQuery(
    api.promptTemplates.list,
    convexUser?._id ? { userId: convexUser._id } : "skip"
  );
  const incrementTemplateUsage = useMutation(api.promptTemplates.incrementUsage);

  const templates = templatesResult?.templates || [];

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

  // Sync external search config
  useEffect(() => {
    if (externalSearchConfig !== undefined) {
      setInternalSearchConfig(externalSearchConfig);
    }
  }, [externalSearchConfig]);

  // Memoize the active search config
  const activeSearchConfig = externalSearchConfig ?? internalSearchConfig;

  // Debounced token count state to prevent CPU overhead on every keystroke
  const [debouncedTokenCount, setDebouncedTokenCount] = useState(0);

  // Calculate total context usage with debouncing (300ms delay)
  // This prevents expensive token counting from running on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      // 1. Count all previous messages in conversation history
      const historyTokens = messages.length > 0
        ? countMessagesTokens(messages, activeModelId)
        : 0;

      // 2. Count current input being typed
      const inputTokens = value.trim()
        ? countTokens(value, activeModelId)
        : 0;

      // 3. Count uploaded files (not yet sent - pending attachment tokens)
      // Note: uploadedFiles contains files attached but NOT yet sent in a message.
      // Once sent, these files become part of messages and are counted in historyTokens.
      // uploadedFiles is cleared after sending (see CLEAR_UPLOADED action), so no double-counting.
      const fileTokens = uploadedFiles.reduce((total, file) => {
        // File references in messages consume tokens
        const description = `File: ${file.filename} (${file.contentType})`;
        return total + countTokens(description, activeModelId);
      }, 0);

      // 4. Total context usage
      setDebouncedTokenCount(historyTokens + inputTokens + fileTokens);
    }, 300);

    return () => clearTimeout(timer);
  }, [messages, value, activeModelId, uploadedFiles]);

  // Use debounced value for display
  const currentTokenCount = debouncedTokenCount;

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

  // Auto-focus textarea on mount
  useEffect(() => {
    // Small delay to ensure the component is fully mounted and visible
    const timer = setTimeout(() => {
      if (textareaRef.current && !disabled) {
        textareaRef.current.focus();
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [disabled, textareaRef]);

  // Restore message to composer (e.g., after rate limit error for retry)
  useEffect(() => {
    if (messageToRestore && messageToRestore.trim()) {
      dispatchComposer({ type: "SET_VALUE", payload: messageToRestore });
      adjustHeight();
      // Focus the textarea after restoring
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          // Move cursor to end of text
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 50);
      // Notify parent that message was restored
      onMessageRestored?.();
    }
  }, [messageToRestore, onMessageRestored, adjustHeight, textareaRef]);

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
      // Check if we have userId
      if (!userId) {
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
        // Determine which chatId to use - may need to create one
        let effectiveChatId = chatId;

        // If no chatId and we have onCreateChat, create a chat first
        if (!effectiveChatId && onCreateChat) {
          setIsCreatingChat(true);
          try {
            const newChatId = await onCreateChat();
            if (!newChatId) {
              throw new Error("Failed to create chat for file upload");
            }
            effectiveChatId = newChatId;
            setInternalChatId(newChatId);
          } finally {
            setIsCreatingChat(false);
          }
        }

        if (!effectiveChatId) {
          throw new Error("Unable to upload file: no chat available");
        }

        // Step 1: Generate upload URL
        const uploadUrl = await generateUploadUrl({ userId, chatId: effectiveChatId });

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
          chatId: effectiveChatId,
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
    [userId, chatId, quota, generateUploadUrl, saveFileMetadata, onCreateChat]
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

    // Check if the message is a command and expand it to the template
    let messageToSend = trimmed;
    if (isCommandStart(trimmed)) {
      const parsed = parseCommand(trimmed);
      if (parsed && templates) {
        // Find matching template
        const matchingTemplate = templates.find(t => t.command === parsed.command);
        if (matchingTemplate) {
          // Expand the template with arguments
          messageToSend = applyTemplate(matchingTemplate.template, parsed);

          // Increment usage count for manual command typing
          if (convexUser?._id) {
            void incrementTemplateUsage({
              templateId: matchingTemplate._id as Id<"promptTemplates">,
              userId: convexUser._id,
            });
          }
        }
      }
    }

    // Clear input and files INSTANTLY for responsive feel
    dispatchComposer({ type: "CLEAR_INPUT" });
    adjustHeight(true);
    const attachmentsToSend = uploadedFiles.length > 0 ? uploadedFiles : undefined;
    dispatchFileUpload({ type: "CLEAR_UPLOADED" });

    // Clear command state
    setPartialCommand(null);
    setIsCommandValid(false);
    setShowCommandAutocomplete(false);

    dispatchComposer({ type: "SET_SENDING", payload: true });
    try {
      // Generate local date string for date context
      const localDate = new Date().toLocaleString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });

      await onSend({
        text: messageToSend,
        modelId: currentModelId,
        apiKey,
        attachments: attachmentsToSend,
        reasoningConfig: activeReasoningConfig,
        searchConfig: activeSearchConfig,
        jonMode: jonMode,
        localDate,
        // Pass the internally created chatId if one was created during file upload
        createdChatId: internalChatId ?? undefined,
      });

      // Show success state briefly
      dispatchComposer({ type: "SET_SENT_SUCCESS", payload: true });
      setTimeout(() => {
        dispatchComposer({ type: "SET_SENT_SUCCESS", payload: false });
      }, 400);

      // Keep focus in textarea after sending
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
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
    activeSearchConfig,
    templates,
    jonMode,
    convexUser,
    incrementTemplateUsage,
    internalChatId,
    textareaRef,
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

  // Handler for search toggle (simple on/off)
  const handleSearchToggle = useCallback(() => {
    const newConfig: SearchConfig = { enabled: !activeSearchConfig.enabled };
    if (onSearchConfigChange) {
      onSearchConfigChange(newConfig);
    } else {
      setInternalSearchConfig(newConfig);
    }
  }, [activeSearchConfig.enabled, onSearchConfigChange]);

  // Memoize event handlers to prevent unnecessary re-renders of ChatComposerTextarea
  const handleTextareaChange = useCallback(
    (newValue: string) => {
      dispatchComposer({ type: "SET_VALUE", payload: newValue });
      if (errorMessage) {
        dispatchComposer({ type: "SET_ERROR", payload: null });
      }
      debouncedAdjustHeight();

      // Check if user is typing a command
      if (isCommandStart(newValue)) {
        const partial = extractPartialCommand(newValue);

        // If there's a space in the input, user is typing arguments - hide autocomplete
        const hasSpace = newValue.trim().includes(" ");

        if (hasSpace) {
          // User is typing arguments after command
          setShowCommandAutocomplete(false);
          if (partial) {
            setPartialCommand(partial); // Keep the command for reference
            // Check if the command is valid (matches a template)
            const isValid = templates.some(t => t.command === partial);
            setIsCommandValid(isValid);
          }
        } else if (partial && partial !== partialCommand) {
          // User is typing the command itself
          setPartialCommand(partial);
          setShowCommandAutocomplete(true);
          // Check if the command is valid
          const isValid = templates.some(t => t.command === partial);
          setIsCommandValid(isValid);
        } else if (!partial) {
          setShowCommandAutocomplete(false);
          setIsCommandValid(false);
        }
      } else {
        setShowCommandAutocomplete(false);
        setPartialCommand(null);
        setIsCommandValid(false);
      }
    },
    [errorMessage, debouncedAdjustHeight, partialCommand, templates]
  );

  // Handle template selection from autocomplete
  const handleTemplateSelect = useCallback(
    (template: { _id: string; command: string; template: string }) => {
      // Insert the command with a space for arguments (Claude Code style)
      dispatchComposer({ type: "SET_VALUE", payload: `${template.command} ` });

      // Note: Usage count is incremented when message is sent, not on selection
      // This prevents double-counting and ensures accurate analytics

      setShowCommandAutocomplete(false);
      setPartialCommand(template.command);
      setIsCommandValid(true);
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
    [adjustHeight, textareaRef]
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
        `border-border bg-card/${opacity.subtle} relative border backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl animate-in fade-in-0 zoom-in-[0.985] duration-200`,
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
          onClose={() => {
            setShowCommandAutocomplete(false);
            setPartialCommand(null);
          }}
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
          isSending={isSending}
        />

        {/* File Previews */}
        {(uploadedFiles.length > 0 || uploadingFiles.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {uploadedFiles.map((file, index) => (
              <FilePreview
                key={file.storageId}
                file={file}
                onRemove={() => handleRemoveFile(index)}
                showRemove={true}
              />
            ))}
            {uploadingFiles.map((file) => (
              <div key={`uploading-${file.name}-${file.size}-${file.lastModified}`} className="relative">
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
          "border-border flex items-center justify-between border-t",
          spacing.gap.sm,
          spacing.padding.lg,
        )}
      >
        {/* Controls row - single row, compact on mobile */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0 overflow-x-auto">
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
          {userId && (chatId || onCreateChat) && (
            <FileUploadButton
              onFileSelect={handleFileSelect}
              disabled={disabled || isBusy || uploadingFiles.length > 0 || isCreatingChat}
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
          {hasReasoningCapability(activeModelId) && (
            <ReasoningSettingsPopover
              modelId={activeModelId}
              reasoningConfig={activeReasoningConfig}
              onReasoningConfigChange={handleReasoningConfigChange}
              disabled={disabled || isBusy}
            >
              <ReasoningSettingsButton
                reasoningConfig={activeReasoningConfig}
                disabled={disabled || isBusy}
              />
            </ReasoningSettingsPopover>
          )}
          <SearchSettingsButton
            searchConfig={activeSearchConfig}
            onToggle={handleSearchToggle}
            disabled={disabled || isBusy}
          />
          <div className="hidden sm:block">
            <ContextUsageIndicator
              currentTokens={currentTokenCount}
              maxTokens={maxContextTokens}
            />
          </div>
        </div>

        {/* Send button - icon only on mobile, with text on desktop */}
        <div className="flex flex-col items-end gap-1 shrink-0 ml-2 sm:ml-3">
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
              // INSTANT: Show Stop immediately when sending OR streaming
              if (isSending || isStreaming) {
                onStop?.();
              } else {
                void send();
              }
            }}
            disabled={
              // Only disable when models loading or no model selected
              // Don't disable during sending/streaming - user needs Stop button
              (isSending || isStreaming)
                ? false
                : sendDisabled ||
                  !value.trim() ||
                  !activeModelId
            }
            aria-label={
              showSentSuccess
                ? "Message sent"
                : (isSending || isStreaming)
                  ? "Stop generating response"
                  : "Send message"
            }
            aria-busy={isSending}
            className={cn(
              "flex items-center justify-center text-sm font-medium transition-all duration-150 ease-out",
              borderRadius.lg,
              // Icon only on mobile (square), text + icon on desktop
              "size-10 sm:h-10 sm:w-auto sm:px-4 sm:gap-2",
              // Hover and active states
              "hover:scale-[1.02] active:scale-[0.96]",
              // Success state - green with checkmark animation
              showSentSuccess
                ? "bg-green-500 text-white shadow-lg shadow-green-500/25 animate-send-success"
                // Stop state - destructive styling
                : (isSending || isStreaming)
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md shadow-destructive/20"
                  // Ready to send - primary with enhanced shadow
                  : value.trim()
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25"
                    // Disabled/empty state
                    : "bg-muted/50 text-muted-foreground",
            )}
          >
            {/* Success checkmark with pop animation */}
            {showSentSuccess ? (
              <Check className="size-4 animate-checkmark-pop" aria-hidden="true" />
            ) : (isSending || isStreaming) ? (
              <StopIcon className="size-4" aria-hidden="true" />
            ) : (
              <SendIcon className="size-4 transition-transform duration-100 ease-out" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">
              {showSentSuccess ? "Sent" : (isSending || isStreaming) ? "Stop" : "Send"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

ChatComposer.displayName = "ChatComposer";

export default React.memo(ChatComposer);
