"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SendIcon, LoaderIcon, SquareIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { ModelSelector, type ModelSelectorOption } from "@/components/model-selector";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

			// Set height to 'auto' temporarily to get accurate scrollHeight without visual flash
			textarea.style.height = 'auto';
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

export type ChatComposerProps = {
	onSend: (payload: { text: string; modelId: string; apiKey: string }) => void | Promise<void>;
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

export default function ChatComposer({
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
	const [value, setValue] = useState('');
	const [isSending, setIsSending] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [fallbackModelId, setFallbackModelId] = useState<string>('');
	const prefersReducedMotion = useReducedMotion();
	const fast = prefersReducedMotion ? 0 : 0.3;
	const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 60, maxHeight: 200 });
	const activeModelIdRef = useRef<string>('');

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
		setValue('');
		adjustHeight(true);
		} catch (error) {
			console.error('Failed to send message', error);
			setErrorMessage(error instanceof Error && error.message ? error.message : 'Failed to send message. Try again.');
		} finally {
			setIsSending(false);
		}
	}, [adjustHeight, apiKey, sendDisabled, isSending, onMissingRequirement, onSend, value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

	const isBusy = isSending || isStreaming;

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
          aria-label="Message input"
          aria-invalid={!!errorMessage}
          aria-describedby={errorMessage ? "composer-error" : undefined}
        />
      </div>

	<div className="border-border flex flex-col gap-4 border-t p-4 sm:flex-row sm:items-center sm:justify-between">
		<div className="flex items-center gap-2">
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
				<span id="composer-error" className="text-destructive text-xs font-medium" role="alert">
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
				disabled={isStreaming ? sendDisabled : (sendDisabled || isSending || !value.trim() || !activeModelId || !apiKey)}
				aria-label={isStreaming ? 'Stop generating response' : 'Send message'}
				aria-busy={isSending}
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
					<SquareIcon className="h-4 w-4" aria-hidden="true" />
				) : isSending ? (
					<LoaderIcon className="h-4 w-4 animate-[spin_2s_linear_infinite]" aria-hidden="true" />
				) : (
					<SendIcon className="h-4 w-4" aria-hidden="true" />
				)}
				<span>{isStreaming ? 'Stop' : 'Send'}</span>
			</motion.button>
		</div>
	</div>
	</motion.div>
	);
}
