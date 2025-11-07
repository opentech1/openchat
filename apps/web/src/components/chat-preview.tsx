"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Paperclip, SendIcon, XIcon, LoaderIcon } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import * as React from "react";
import { useAutoResizeTextarea } from "@/components/ui/auto-resize-textarea";
import {
  borderRadius,
  shadows,
  spacing,
  opacity,
  iconSize,
} from "@/styles/design-tokens";

function ChatPreview({ className }: { className?: string }) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const prefersReducedMotion = useReducedMotion();
  const fast = prefersReducedMotion ? 0 : 0.3;
  const slower = prefersReducedMotion ? 0 : 0.5;
  const [, startTransition] = useTransition();
  useEffect(
    () => () => {
      if (typingTimeoutRef.current !== null) {
        window.clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    },
    [],
  );
  // removed pointer-following gradient for performance
  const { textareaRef, adjustHeight, debouncedAdjustHeight } =
    useAutoResizeTextarea({
      minHeight: 60,
      maxHeight: 200,
    });
  // unused focus overlay removed
  // Slash command palette removed for a cleaner dashboard preview

  // pointer-follow tracking removed

  // Click-outside handling no longer necessary

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) handleSendMessage();
    }
  };

  const handleSendMessage = () => {
    if (value.trim()) {
      startTransition(() => {
        setIsTyping(true);
        if (typingTimeoutRef.current !== null) {
          window.clearTimeout(typingTimeoutRef.current);
        }
        typingTimeoutRef.current = window.setTimeout(() => {
          setIsTyping(false);
          setValue("");
          adjustHeight(true);
          typingTimeoutRef.current = null;
        }, 3000);
      });
    }
  };

  const handleAttachFile = () => {
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
          <motion.div
            className="relative z-10 space-y-12"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: slower, ease: "easeOut" }}
          >
            <div className="space-y-3 text-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: fast }}
                className="inline-block"
              >
                <h1 className="pb-1 text-3xl font-medium tracking-tight">
                  How can OpenChat help today?
                </h1>
                <motion.div
                  className="via-primary/50 h-px bg-gradient-to-r from-transparent to-transparent"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  transition={{
                    delay: 0.25,
                    duration: prefersReducedMotion ? 0 : 0.4,
                  }}
                />
              </motion.div>
              <motion.p
                className="text-muted-foreground text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2, duration: fast }}
              >
                Ask a question or type a command
              </motion.p>
            </div>

            <motion.div
              className={cn(
                `border-border bg-card/${opacity.subtle} relative border backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl`,
                borderRadius.xl,
                shadows.xl,
              )}
              initial={{ scale: 0.985 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.05, duration: fast }}
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
                  placeholder="Ask OpenChat a question..."
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

              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    className={cn("flex flex-wrap px-4 pb-3", spacing.gap.sm)}
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    {attachments.map((file, index) => (
                      <motion.div
                        key={index}
                        className={cn(
                          "bg-primary/5 text-muted-foreground flex items-center px-3 py-1.5 text-xs",
                          borderRadius.md,
                          spacing.gap.sm,
                        )}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                      >
                        <span>{file}</span>
                        <button
                          onClick={() => removeAttachment(index)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={`Remove ${file}`}
                        >
                          <XIcon className="size-3" />
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <div
                className={cn(
                  "border-border flex items-center justify-between border-t",
                  spacing.gap.lg,
                  spacing.padding.lg,
                )}
              >
                <div className={cn("flex items-center", spacing.gap.md)}>
                  <motion.button
                    type="button"
                    onClick={handleAttachFile}
                    whileTap={{ scale: 0.94 }}
                    className={cn(
                      "group text-muted-foreground hover:text-foreground relative p-2 transition-colors",
                      borderRadius.md,
                    )}
                    aria-label="Attach file"
                  >
                    <Paperclip className="size-4" />
                    <motion.span
                      className={cn(
                        "bg-primary/10 absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100",
                        borderRadius.md,
                      )}
                      layoutId="button-highlight"
                    />
                  </motion.button>
                </div>

                <motion.button
                  type="button"
                  onClick={handleSendMessage}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isTyping || !value.trim()}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-all",
                    "flex items-center",
                    borderRadius.md,
                    spacing.gap.sm,
                    value.trim()
                      ? cn(
                          "bg-primary text-primary-foreground shadow-primary/10",
                          shadows.lg,
                        )
                      : "bg-muted/50 text-muted-foreground",
                  )}
                  aria-label={isTyping ? "Sending message" : "Send message"}
                  aria-busy={isTyping}
                >
                  {isTyping ? (
                    <LoaderIcon
                      className="size-4 animate-[spin_2s_linear_infinite]"
                      aria-hidden="true"
                    />
                  ) : (
                    <SendIcon className="size-4" aria-hidden="true" />
                  )}
                  <span>Send</span>
                </motion.button>
              </div>
            </motion.div>

            {/* Removed suggested command chips below input */}
          </motion.div>
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
