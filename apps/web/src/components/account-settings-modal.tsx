"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  saveOpenRouterKey,
  hasOpenRouterKey,
  removeOpenRouterKey,
} from "@/lib/openrouter-key-storage";
import { useConvex, useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { captureClientEvent, registerClientProperties } from "@/lib/posthog";
import { logError } from "@/lib/logger";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function getFocusableElements(container: HTMLElement | null) {
  if (!container) return [] as HTMLElement[];
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hasAttribute("disabled") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

export function AccountSettingsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const convex = useConvex();

  // Get Convex user - only query when modal is open
  const convexUser = useQuery(
    api.users.getByExternalId,
    open && user?.id ? { externalId: user.id } : "skip"
  );

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [removingKey, setRemovingKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = getFocusableElements(dialogRef.current);
    const target = focusable[0] ?? closeButtonRef.current ?? dialogRef.current;
    requestAnimationFrame(() => {
      target?.focus({ preventScroll: true });
    });
    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;
      if (previouslyFocused) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = getFocusableElements(dialog);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (event.shiftKey) {
        if (!active || active === first || !dialog.contains(active)) {
          event.preventDefault();
          last.focus();
        }
        return;
      }
      if (!active || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !user?.id || !convexUser?._id) {
      if (!open) {
        setApiKeyInput("");
        setApiKeyError(null);
      }
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const keyExists = await hasOpenRouterKey(convexUser._id, convex);
        if (cancelled) return;
        setHasStoredKey(keyExists);
        setApiKeyError(null);
      } catch (error) {
        logError("Failed to check OpenRouter key status", error);
        if (cancelled) return;
        setHasStoredKey(false);
        setApiKeyError("Unable to check your OpenRouter key status.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, user?.id, convexUser?._id, convex]);

  if (!open || !user) return null;

  const displayName = user.name || user.email || "Unnamed user";
  const initials = (() => {
    const parts = displayName.trim().split(/\s+/);
    return (
      parts
        .slice(0, 2)
        .map((part: string) => part[0]?.toUpperCase() ?? "")
        .join("") || "U"
    );
  })();

  async function handleSaveApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingKey || !user?.id || !convexUser?._id) return;
    const trimmed = apiKeyInput.trim();
    if (trimmed.length < 10) {
      setApiKeyError("Enter a valid OpenRouter key (sk-or-v1…).");
      return;
    }
    setSavingKey(true);
    setApiKeyError(null);
    try {
      await saveOpenRouterKey(trimmed, convexUser._id, user.id, convex);
      setHasStoredKey(true);
      setApiKeyInput("");
      toast.success("OpenRouter key saved");
      captureClientEvent("openrouter.key_saved", {
        source: "settings",
        masked_tail: trimmed.slice(-4),
        scope: "workspace",
      });
      registerClientProperties({ has_openrouter_key: true });
    } catch (error) {
      logError("Failed to save OpenRouter key", error);
      setApiKeyError("Failed to save OpenRouter key.");
      toast.error("Failed to save OpenRouter key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleRemoveApiKey() {
    if (removingKey || !convexUser?._id) return;
    const wasLinked = hasStoredKey;
    setRemovingKey(true);
    try {
      await removeOpenRouterKey(convexUser._id, convex);
      setHasStoredKey(false);
      setApiKeyInput("");
      setApiKeyError(null);
      toast.success("OpenRouter key removed");
      captureClientEvent("openrouter.key_removed", {
        source: "settings",
        had_models_cached: wasLinked,
      });
      registerClientProperties({ has_openrouter_key: false });
    } catch (error) {
      logError("Failed to remove OpenRouter key", error);
      toast.error("Failed to remove OpenRouter key");
    } finally {
      setRemovingKey(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          onClose();
          toast.success("Signed out");
          router.push("/");
          router.refresh();
        },
        onError: (ctx) => {
          logError("Failed to sign out", ctx.error);
          toast.error("Failed to sign out");
          setSigningOut(false);
        },
      },
    });
  }

  async function handleCopyUserId() {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.id);
      toast.success("User ID copied to clipboard");
    } catch {
      toast.error("Unable to copy user ID");
    }
  }

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        className="relative bg-background w-full max-w-md rounded-2xl shadow-2xl border animate-in zoom-in-95 fade-in slide-in-from-bottom-4 duration-300 focus:outline-none focus-visible:outline-none"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-settings-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="account-settings-title" className="text-lg font-semibold">
            Account Settings
          </h2>
          <button
            onClick={onClose}
            className="hover:bg-accent rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            type="button"
            ref={closeButtonRef}
            aria-label="Close settings"
          >
            Close
          </button>
        </div>
        <div className="max-h-[calc(90vh_-_80px)] overflow-y-auto p-6 space-y-6">
            {/* User Profile Section */}
            <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-xl">
              <Avatar className="size-16 ring-2 ring-border">
                {user.image ? (
                  <AvatarImage src={user.image} alt={displayName || "User"} />
                ) : null}
                <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold truncate">{displayName}</p>
                <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>

            {/* User ID Section */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                User ID
              </label>
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
                <code className="flex-1 text-xs font-mono truncate text-muted-foreground">
                  {user.id}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={handleCopyUserId}
                  aria-label="Copy user ID to clipboard"
                  className="shrink-0"
                >
                  Copy
                </Button>
              </div>
            </div>
            {/* OpenRouter API Key Section */}
            <div className="space-y-3 p-4 bg-muted/40 rounded-xl border">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold">OpenRouter API Key</h3>
                  <p className="text-xs text-muted-foreground">
                    Connect your personal key so OpenChat can call OpenRouter models for you.
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 px-2 py-1 text-xs font-semibold rounded-full",
                    hasStoredKey
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-destructive/10 text-destructive"
                  )}
                >
                  {hasStoredKey ? "Key stored" : "Not set"}
                </span>
              </div>

              {apiKeyError ? (
                <p
                  id="settings-api-key-error"
                  className="text-xs font-medium text-destructive"
                  role="alert"
                >
                  {apiKeyError}
                </p>
              ) : null}

              <form
                className="flex flex-col gap-2"
                onSubmit={handleSaveApiKey}
              >
                <Input
                  value={apiKeyInput}
                  onChange={(event) => {
                    setApiKeyInput(event.target.value);
                    if (apiKeyError) setApiKeyError(null);
                  }}
                  type="password"
                  placeholder="sk-or-v1..."
                  autoComplete="off"
                  required
                  className="font-mono text-sm"
                  aria-label="OpenRouter API key"
                  aria-invalid={!!apiKeyError}
                  aria-describedby={
                    apiKeyError ? "settings-api-key-error" : undefined
                  }
                />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={savingKey || apiKeyInput.trim().length < 10}
                    className="flex-1"
                    aria-busy={savingKey}
                  >
                    {savingKey ? (
                      <Loader2
                        className="mr-2 size-4 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    {hasStoredKey ? "Update" : "Save"}
                  </Button>
                  {hasStoredKey ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleRemoveApiKey}
                      disabled={removingKey}
                      aria-label="Remove OpenRouter API key"
                      aria-busy={removingKey}
                    >
                      {removingKey ? (
                        <Loader2
                          className="size-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        "Remove"
                      )}
                    </Button>
                  ) : null}
                </div>
              </form>

              <p className="text-xs text-muted-foreground">
                Keys are encrypted in your browser before being stored in your account database and synced across devices. Once stored, keys cannot be viewed - only updated or removed.
              </p>
            </div>

            {/* Sign Out Section */}
            <div className="space-y-3 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                You are signed in with Better Auth. Signing out will end your session across all tabs.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleSignOut}
                disabled={signingOut}
                aria-label="Sign out of account"
                aria-busy={signingOut}
              >
                {signingOut ? "Signing out…" : "Sign out"}
              </Button>
            </div>
          </div>
        </div>
      </div>
  );

  const portalTarget = typeof document !== "undefined" ? document.body : null;
  if (!portalTarget) return null;
  return createPortal(modal, portalTarget);
}
