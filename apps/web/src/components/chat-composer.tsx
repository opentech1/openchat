"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, SendIcon, XIcon, LoaderIcon, SquareIcon, Sparkles } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ModelSelector, type ModelSelectorOption } from "@/components/model-selector";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FOCUS_COMPOSER_EVENT, PREFILL_COMPOSER_EVENT, type PrefillComposerEventDetail } from "@/lib/events";

type UseAutoResizeTextareaProps = { minHeight: number; maxHeight?: number };
function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  containerClassName?: string;
  showRing?: boolean;
};

import * as React from "react";

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, containerClassName, showRing = false, ...props }, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const fast = prefersReducedMotion ? 0 : 0.3;
  return (
    <div className={cn('relative', containerClassName)}>
      <textarea
        className={cn(
          'border-input bg-background flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm',
          'transition-all duration-200 ease-in-out',
          'placeholder:text-muted-foreground',
          'disabled:cursor-not-allowed disabled:opacity-50',
          showRing
            ? 'focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none'
            : '',
          className,
        )}
        ref={ref}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        {...props}
      />

      {showRing && isFocused && (
        <motion.span
          className="ring-primary/30 pointer-events-none absolute inset-0 rounded-md ring-2 ring-offset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: fast }}
        />
      )}
    </div>
  );
});
Textarea.displayName = "Textarea";

const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5MB safeguard until backend storage lands
const QUICK_PROMPTS = [
	"Summarize our last conversation into bullet points.",
	"Draft a concise follow-up message from this chat.",
	"Highlight action items and owners from this thread.",
];

function formatFileSize(bytes: number) {
	if (!Number.isFinite(bytes) || bytes <= 0) return "";
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex += 1;
	}
	return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export type ChatComposerProps = {
	onSend: (payload: { text: string; modelId: string; apiKey: string; attachments: File[] }) => void | Promise<void>;
	disabled?: boolean;
	placeholder?: string;
	modelOptions?: ModelSelectorOption[];
	modelValue?: string | null;
	onModelChange?: (value: string) => void;
	modelsLoading?: boolean;
	apiKey?: string | null;
	isStreaming?: boolean;
	onStop?: () => void;
};

export default function ChatComposer({
	onSend,
	disabled,
	placeholder = "Ask OpenChat a question...",
	modelOptions = [],
	modelValue,
	onModelChange,
	modelsLoading,
	apiKey,
	isStreaming = false,
	onStop,
}: ChatComposerProps) {
	const [value, setValue] = useState('');
	const [attachments, setAttachments] = useState<File[]>([]);
	const [isSending, setIsSending] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [fallbackModelId, setFallbackModelId] = useState<string>('');
	const prefersReducedMotion = useReducedMotion();
	const fast = prefersReducedMotion ? 0 : 0.3;
	const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 60, maxHeight: 200 });
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [isDragActive, setIsDragActive] = useState(false);
	const hasAutoFocusedRef = useRef(false);

	const focusComposer = useCallback(() => {
		if (disabled) return;
		const textarea = textareaRef.current;
		if (!textarea) return;
		textarea.focus();
		const length = textarea.value.length;
		textarea.setSelectionRange(length, length);
	}, [disabled, textareaRef]);

	useEffect(() => {
		if (hasAutoFocusedRef.current) return;
		if (disabled) return;
		hasAutoFocusedRef.current = true;
		focusComposer();
	}, [disabled, focusComposer]);

	useEffect(() => {
		const handler = () => focusComposer();
		window.addEventListener(FOCUS_COMPOSER_EVENT, handler);
		return () => window.removeEventListener(FOCUS_COMPOSER_EVENT, handler);
	}, [focusComposer]);

	useEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey)) return;
			if (event.key.toLowerCase() !== "l") return;
			const target = event.target as HTMLElement | null;
			if (target && target.closest("input, textarea, [contenteditable=true]")) return;
			event.preventDefault();
			focusComposer();
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [focusComposer]);

	useEffect(() => {
		const handler = (event: Event) => {
			const detail = (event as CustomEvent<PrefillComposerEventDetail>).detail;
			if (!detail?.text) return;
			setErrorMessage(null);
			setValue(detail.text);
			setTimeout(() => {
				adjustHeight();
				focusComposer();
			}, 10);
		};
		window.addEventListener(PREFILL_COMPOSER_EVENT, handler as EventListener);
		return () => window.removeEventListener(PREFILL_COMPOSER_EVENT, handler as EventListener);
	}, [adjustHeight, focusComposer]);

	const attachmentEntries = useMemo(() => {
		return attachments.map((file) => {
			const key = `${file.name}:${file.size}:${file.lastModified}`;
			const preview = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
			return { file, key, preview };
		});
	}, [attachments]);

	useEffect(() => {
		return () => {
			for (const entry of attachmentEntries) {
				if (entry.preview) URL.revokeObjectURL(entry.preview);
			}
		};
	}, [attachmentEntries]);

  useEffect(() => {
    if (modelValue) {
      setFallbackModelId(modelValue);
      return;
    }
    if (modelOptions.length === 0) {
      setFallbackModelId('');
      return;
    }
    const hasCurrent = fallbackModelId && modelOptions.some((option) => option.value === fallbackModelId);
    if (!hasCurrent) {
      setFallbackModelId(modelOptions[0]!.value);
    }
  }, [modelValue, modelOptions, fallbackModelId]);

  const activeModelId = modelValue ?? fallbackModelId;

	const send = useCallback(async () => {
		const trimmed = value.trim();
		if (!trimmed || disabled || isSending || !activeModelId || !apiKey) return;
		setErrorMessage(null);
		setIsSending(true);
		try {
			await onSend({ text: trimmed, modelId: activeModelId, apiKey, attachments });
			setValue('');
			adjustHeight(true);
			setAttachments([]);
			if (fileInputRef.current) fileInputRef.current.value = '';
		} catch (error) {
			console.error('Failed to send message', error);
			setErrorMessage(error instanceof Error && error.message ? error.message : 'Failed to send message. Try again.');
		} finally {
			setIsSending(false);
		}
	}, [activeModelId, adjustHeight, apiKey, attachments, disabled, isSending, onSend, value]);

	const handleQuickPrompt = useCallback(
		(prompt: string) => {
			setErrorMessage(null);
			setValue((prev) => {
				const trimmed = prev.trim();
				if (!trimmed) return prompt;
				return `${trimmed}\n\n${prompt}`;
			});
			setTimeout(() => {
				adjustHeight();
				focusComposer();
			}, 10);
		},
		[adjustHeight, focusComposer],
	);

	const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			void send();
		}
	};

	const isBusy = isSending || isStreaming;

	const handleFileSelection = (files: FileList | File[] | null) => {
		if (!files) return;
		const list = Array.isArray(files) ? files : Array.from(files);
		const nextFiles: File[] = [];
		let rejectedName: string | null = null;
		for (const file of list) {
			if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
				rejectedName = file.name;
				continue;
			}
			nextFiles.push(file);
		}
		if (rejectedName) {
			setErrorMessage(`Attachment ${rejectedName} exceeds the 5MB limit.`);
		}
		if (nextFiles.length === 0) return;
		setAttachments((prev) => {
			const seen = new Set(prev.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
			const combined = [...prev];
			for (const file of nextFiles) {
				const key = `${file.name}:${file.size}:${file.lastModified}`;
				if (seen.has(key)) continue;
				seen.add(key);
				combined.push(file);
			}
			return combined;
		});
	};

	const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		event.dataTransfer.dropEffect = "copy";
		setIsDragActive(true);
	};

	const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
		if (event.currentTarget.contains(event.relatedTarget as Node)) return;
		setIsDragActive(false);
	};

	const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
		event.preventDefault();
		setIsDragActive(false);
		handleFileSelection(event.dataTransfer?.files ?? null);
	};

	return (
    <motion.div
      className={cn(
        "border-border bg-card/80 relative rounded-2xl border shadow-xl backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl",
        isDragActive && "border-primary/60 bg-primary/10",
      )}
      initial={{ scale: 0.985 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.05, duration: fast }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-dragging={isDragActive ? "true" : "false"}
    >
      <div className="p-4">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (errorMessage) setErrorMessage(null);
            adjustHeight();
          }}
          onKeyDown={onKeyDown}
          onPaste={(event) => {
            if (event.clipboardData?.files?.length) {
              handleFileSelection(event.clipboardData.files);
            }
          }}
          placeholder={placeholder}
          containerClassName="w-full"
          className={cn(
            'w-full px-4 py-3',
            'resize-none',
            'bg-transparent',
            'border-none',
            'text-foreground text-sm',
            'focus:outline-none',
            'placeholder:text-muted-foreground',
            'min-h-[60px]',
          )}
          style={{ overflow: 'hidden' }}
          showRing={false}
          disabled={disabled}
        />
      </div>

	<AnimatePresence>
		{attachmentEntries.length > 0 && (
			<motion.div
				className="grid gap-2 px-4 pb-3 sm:grid-cols-2"
				initial={{ opacity: 0, height: 0 }}
				animate={{ opacity: 1, height: "auto" }}
				exit={{ opacity: 0, height: 0 }}
			>
				{attachmentEntries.map(({ file, key, preview }) => (
					<motion.div
						key={key}
						className="border-border/60 relative flex items-center gap-3 overflow-hidden rounded-lg border bg-background/90 p-2 shadow-sm"
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
					>
						<div className="border-border/60 flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
							{preview ? (
								<img src={preview} alt={file.name} className="h-full w-full object-cover" />
							) : (
								<Paperclip className="size-4 text-muted-foreground" />
							)}
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium text-foreground">{file.name}</p>
							<p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
						</div>
						<button
							type="button"
							onClick={() => setAttachments((prev) => prev.filter((existing) => existing !== file))}
							className="hover:bg-destructive/10 text-muted-foreground hover:text-destructive absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full transition-colors"
							aria-label="Remove attachment"
						>
							<XIcon className="size-3.5" />
						</button>
					</motion.div>
				))}
			</motion.div>
		)}
	</AnimatePresence>

	{QUICK_PROMPTS.length > 0 ? (
		<div className="px-4 pb-3">
			<div className="flex flex-wrap gap-2">
				{QUICK_PROMPTS.map((prompt) => (
					<button
						type="button"
						key={prompt}
						className={cn(
							buttonVariants({ variant: "secondary", size: "sm" }),
							"gap-1 text-xs",
						)}
						onClick={() => handleQuickPrompt(prompt)}
					>
						<Sparkles className="size-3.5" />
						<span>{prompt}</span>
					</button>
				))}
			</div>
		</div>
	) : null}

	<div className="border-border flex items-center justify-between gap-4 border-t p-4">
		<div className="flex items-center gap-2">
			<motion.button
				type="button"
				onClick={() => {
					if (disabled || isBusy || !activeModelId) return;
					fileInputRef.current?.click();
				}}
				whileTap={{ scale: 0.95 }}
				className={cn(
					buttonVariants({ variant: "outline", size: "sm" }),
					'flex h-9 w-9 items-center justify-center rounded-xl p-0 px-0 text-muted-foreground',
				)}
				disabled={disabled || isBusy || !activeModelId}
				aria-label="Attach file"
			>
	            <Paperclip className="h-4 w-4" />
	          </motion.button>
			<input
				type="file"
				ref={fileInputRef}
				multiple
				onChange={(event) => {
					handleFileSelection(event.target.files);
					event.target.value = '';
				}}
				className="hidden"
			/>
			<ModelSelector
				options={modelOptions}
				value={modelValue ?? (modelOptions.length === 0 ? null : fallbackModelId)}
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

		<div className="flex flex-col items-end gap-1">
			{errorMessage && (
				<span className="text-destructive text-xs font-medium" role="alert">
					{errorMessage}
				</span>
			)}
			<motion.button
				type="button"
				onClick={() => {
					if (isStreaming) {
						onStop?.();
					} else {
						void send();
					}
				}}
				whileHover={{ scale: 1.01 }}
				whileTap={{ scale: 0.98 }}
				disabled={isStreaming ? disabled : (disabled || isSending || !value.trim() || !activeModelId || !apiKey)}
				className={cn(
					'flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all shadow-sm',
					isStreaming
						? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
						: value.trim()
							? 'bg-primary text-primary-foreground shadow-primary/10 hover:bg-primary/90'
							: 'bg-muted/50 text-muted-foreground',
				)}
			>
				{isStreaming ? (
					<SquareIcon className="h-4 w-4" />
				) : isSending ? (
					<LoaderIcon className="h-4 w-4 animate-[spin_2s_linear_infinite]" />
				) : (
					<SendIcon className="h-4 w-4" />
				)}
				<span>{isStreaming ? 'Stop' : 'Send'}</span>
			</motion.button>
		</div>
	</div>
	</motion.div>
	);
}
