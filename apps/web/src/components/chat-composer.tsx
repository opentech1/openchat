"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, SendIcon, XIcon, LoaderIcon, SquareIcon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ModelSelector, type ModelSelectorOption } from "@/components/model-selector";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { captureClientEvent } from "@/lib/posthog";

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
				data-ph-no-capture
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
	onMissingRequirement?: (reason: "apiKey" | "model") => void;
	chatId?: string;
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
	onMissingRequirement,
	chatId,
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
		if (!trimmed || disabled || isSending) return;
		if (!activeModelId) {
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
	}, [activeModelId, adjustHeight, apiKey, attachments, disabled, isSending, onMissingRequirement, onSend, value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

	const isBusy = isSending || isStreaming;

	const handleFileSelection = (files: FileList | null) => {
		if (!files) return;
		const nextFiles: File[] = [];
		let rejectedName: string | null = null;
		for (const file of Array.from(files)) {
			if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
				rejectedName = file.name;
				captureClientEvent("chat.attachment_event", {
					chat_id: chatId,
					result: "rejected",
					file_mime: file.type || "application/octet-stream",
					file_size_bytes: file.size,
					limit_bytes: MAX_ATTACHMENT_SIZE_BYTES,
				});
				continue;
			}
			nextFiles.push(file);
		}
		if (rejectedName) {
			setErrorMessage(`Attachment ${rejectedName} exceeds the 5MB limit.`);
		}
		if (nextFiles.length === 0) return;
		const added: File[] = [];
		setAttachments((prev) => {
			const seen = new Set(prev.map((file) => `${file.name}:${file.size}`));
			const combined = [...prev];
			for (const file of nextFiles) {
				const key = `${file.name}:${file.size}`;
				if (seen.has(key)) continue;
				seen.add(key);
				combined.push(file);
				added.push(file);
			}
			return combined;
		});
		for (const file of added) {
			captureClientEvent("chat.attachment_event", {
				chat_id: chatId,
				result: "accepted",
				file_mime: file.type || "application/octet-stream",
				file_size_bytes: file.size,
				limit_bytes: MAX_ATTACHMENT_SIZE_BYTES,
			});
		}
	};

	return (
    <motion.div
      className="border-border bg-card/80 relative rounded-2xl border shadow-xl backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl"
      initial={{ scale: 0.985 }}
      animate={{ scale: 1 }}
      transition={{ delay: 0.05, duration: fast }}
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
		{attachments.length > 0 && (
			<motion.div
				className="flex flex-wrap gap-2 px-4 pb-3"
				initial={{ opacity: 0, height: 0 }}
				animate={{ opacity: 1, height: 'auto' }}
				exit={{ opacity: 0, height: 0 }}
			>
				{attachments.map((file, index) => (
					<motion.div
						key={index}
						className="bg-primary/5 text-muted-foreground flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
						initial={{ opacity: 0, scale: 0.9 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, scale: 0.9 }}
					>
						<span>
							{file.name}
							{file.size ? ` (${Math.round(file.size / 1024)} KB)` : ''}
						</span>
						<button
							onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
							className="text-muted-foreground hover:text-foreground transition-colors"
							aria-label="Remove attachment"
						>
							<XIcon className="h-3 w-3" />
						</button>
					</motion.div>
				))}
			</motion.div>
		)}
	</AnimatePresence>

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
