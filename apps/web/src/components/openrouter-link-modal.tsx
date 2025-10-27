"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, LoaderIcon, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { captureClientEvent } from "@/lib/posthog";

type OpenRouterLinkModalProps = {
  open: boolean;
  saving?: boolean;
  errorMessage?: string | null;
  onSubmit: (apiKey: string) => void | Promise<void>;
  onTroubleshoot?: () => void;
  onClose?: () => void;
  hasApiKey?: boolean;
};

export function OpenRouterLinkModal({
  open,
  saving,
  errorMessage,
  onSubmit,
  onTroubleshoot,
  onClose,
  hasApiKey,
}: OpenRouterLinkModalProps) {
  const [apiKey, setApiKey] = useState("");
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setApiKey("");
      trackedRef.current = false;
      return;
    }
    if (trackedRef.current) return;
    trackedRef.current = true;
    const reason = errorMessage ? "error" : "missing";
    captureClientEvent("openrouter.key_prompt_shown", {
      reason,
      has_api_key: Boolean(hasApiKey),
    });
  }, [open, errorMessage, hasApiKey]);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && open) {
          onClose?.();
        }
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-background/80 backdrop-blur" />
        <Dialog.Content className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Dialog.Title className="text-lg font-semibold">Add your OpenRouter API key</Dialog.Title>
                <Dialog.Description className="text-muted-foreground mt-1 text-sm">
                  Paste a personal API key so OpenChat can stream responses using your OpenRouter account. Keys stay encrypted in your browser and are only sent to your server when you request a completion.
                </Dialog.Description>
              </div>
              <Dialog.Close
                className="text-muted-foreground hover:bg-accent hover:text-accent-foreground inline-flex size-8 items-center justify-center rounded-md transition"
                aria-label="Close"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>
            <form
              className="mt-6 flex flex-col gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                const trimmed = apiKey.trim();
                if (!trimmed || saving) return;
                await onSubmit(trimmed);
              }}
            >
              <div className="flex flex-col gap-2 text-left">
                <Label htmlFor="openrouter-api-key" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  OpenRouter API Key
                </Label>
                <Input
                  id="openrouter-api-key"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  type="password"
                  placeholder="sk-or-v1..."
                  autoFocus
                  required
                  className="font-mono"
                />
                <p className="text-muted-foreground text-xs">
                  Create a key under
                  {" "}
                  <a
                    href="https://openrouter.ai/keys"
                    className="text-primary inline-flex items-center gap-1 underline-offset-4 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    OpenRouter → Keys
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  .
                </p>
              </div>
              {errorMessage ? (
                <div className="bg-destructive/10 text-destructive w-full rounded-lg px-3 py-2 text-xs font-medium">
                  {errorMessage}
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <Button
                  type="submit"
                  disabled={saving || apiKey.trim().length < 10}
                  className={cn("h-9 w-full justify-center text-sm font-semibold")}
                >
                  {saving ? <LoaderIcon className="h-4 w-4 animate-spin" /> : "Save and continue"}
                </Button>
                {onTroubleshoot ? (
                  <button
                    type="button"
                    onClick={() => {
                      setApiKey("");
                      void onTroubleshoot();
                    }}
                    className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline"
                  >
                    Refresh status
                  </button>
                ) : null}
              </div>
              <p className="text-muted-foreground text-xs">
                Your key is encrypted with an AES key generated via the Web Crypto API and stored locally. Clear browser storage or select “Remove key” in settings to delete it at any time.
              </p>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
