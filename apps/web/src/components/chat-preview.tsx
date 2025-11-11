"use client";

import { useEffect, useRef, useCallback, useTransition } from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Paperclip, SendIcon, XIcon, LoaderIcon } from "lucide-react";
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
          <div className="relative z-10 space-y-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 text-center">
              <div className="inline-block animate-in fade-in-0 slide-in-from-bottom-2 duration-300 delay-150">
                <h1 className="pb-1 text-3xl font-medium tracking-tight">
                  How can osschat help today?
                </h1>
                <div className="via-primary/50 h-px bg-gradient-to-r from-transparent to-transparent animate-in fade-in-0 duration-400 delay-250" />
              </div>
              <p className="text-muted-foreground text-sm animate-in fade-in-0 duration-300 delay-200">
                Ask a question or type a command
              </p>
            </div>

            <div
              className={cn(
                `border-border bg-card/${opacity.subtle} relative border backdrop-blur supports-[backdrop-filter]:backdrop-blur-2xl animate-in fade-in-0 zoom-in-[0.985] duration-300 delay-50`,
                borderRadius.xl,
                shadows.xl,
              )}
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
                  placeholder="Ask osschat a question..."
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

              {attachments.length > 0 && (
                <div className={cn("flex flex-wrap px-4 pb-3 animate-in fade-in-0 duration-200", spacing.gap.sm)}>
                  {attachments.map((file, index) => (
                    <div
                      key={index}
                      className={cn(
                        "bg-primary/5 text-muted-foreground flex items-center px-3 py-1.5 text-xs animate-in fade-in-0 zoom-in-95 duration-200",
                        borderRadius.md,
                        spacing.gap.sm,
                      )}
                    >
                      <span>{file}</span>
                      <button
                        onClick={() => removeAttachment(index)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={`Remove ${file}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div
                className={cn(
                  "border-border flex items-center justify-between border-t",
                  spacing.gap.lg,
                  spacing.padding.lg,
                )}
              >
                <div className={cn("flex items-center", spacing.gap.md)}>
                  <button
                    type="button"
                    onClick={handleAttachFile}
                    className={cn(
                      "group text-muted-foreground hover:text-foreground relative p-2 transition-all active:scale-[0.94]",
                      borderRadius.md,
                    )}
                    aria-label="Attach file"
                  >
                    <Paperclip className="size-4" />
                    <span
                      className={cn(
                        "bg-primary/10 absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100",
                        borderRadius.md,
                      )}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={isTyping || !value.trim()}
                  className={cn(
                    "px-4 py-2 text-sm font-medium transition-all hover:scale-[1.01] active:scale-[0.98]",
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
                </button>
              </div>
            </div>

            {/* Removed suggested command chips below input */}
          </div>
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
