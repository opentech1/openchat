"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Paperclip, SendIcon, XIcon, LoaderIcon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ModelSelector } from "@/components/model-selector";
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

export type ChatComposerProps = {
  onSend: (text: string) => void | Promise<void>;
  disabled?: boolean;
  placeholder?: string;
};

export default function ChatComposer({ onSend, disabled, placeholder = "Ask OpenChat a question..." }: ChatComposerProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("openchat-turbo");
  const prefersReducedMotion = useReducedMotion();
  const fast = prefersReducedMotion ? 0 : 0.3;
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 60, maxHeight: 200 });

  const send = useCallback(async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled || isSending) return;
    setErrorMessage(null);
    setIsSending(true);
    try {
      await onSend(trimmed);
      setValue('');
      adjustHeight(true);
    } catch (error) {
      console.error('Failed to send message', error);
      setErrorMessage(error instanceof Error && error.message ? error.message : 'Failed to send message. Try again.');
    } finally {
      setIsSending(false);
    }
  }, [adjustHeight, disabled, isSending, onSend, value]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
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
                <span>{file}</span>
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
              const mockFileName = `file-${Math.floor(Math.random() * 1000)}.pdf`;
              setAttachments((prev) => [...prev, mockFileName]);
            }}
            whileTap={{ scale: 0.95 }}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              'flex h-9 w-9 items-center justify-center rounded-xl p-0 px-0 text-muted-foreground',
            )}
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </motion.button>
          <ModelSelector value={selectedModel} onChange={setSelectedModel} disabled={disabled || isSending} />
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
              void send();
            }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            disabled={disabled || isSending || !value.trim()}
            className={cn(
              'flex h-9 items-center gap-2 rounded-xl px-4 text-sm font-medium transition-all shadow-sm',
              value.trim()
                ? 'bg-primary text-primary-foreground shadow-primary/10 hover:bg-primary/90'
                : 'bg-muted/50 text-muted-foreground',
            )}
          >
            {isSending ? (
              <LoaderIcon className="h-4 w-4 animate-[spin_2s_linear_infinite]" />
            ) : (
              <SendIcon className="h-4 w-4" />
            )}
            <span>Send</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
