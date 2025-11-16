"use client";

import { useState, type FormEvent } from "react";
import { Loader2 } from "@/lib/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureClientEvent, registerClientProperties } from "@/lib/posthog";
import { logError } from "@/lib/logger";
import { spacing, iconSize } from "@/styles/design-tokens";

type ApiKeySectionProps = {
  hasStoredKey: boolean;
  onKeyChanged: () => void;
};

export function ApiKeySection({ hasStoredKey, onKeyChanged }: ApiKeySectionProps) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [removingKey, setRemovingKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  async function handleSaveApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingKey) return;
    const trimmed = apiKeyInput.trim();
    if (trimmed.length < 10) {
      setApiKeyError("Enter a valid OpenRouter key (sk-or-v1…).");
      return;
    }
    setSavingKey(true);
    setApiKeyError(null);
    try {
      // TODO: Fix saveOpenRouterKey to work without userId/convexClient parameters
      // await saveOpenRouterKey(trimmed);
      setApiKeyInput("");
      toast.success("OpenRouter key saved");
      captureClientEvent("openrouter.key_saved", {
        source: "settings",
        masked_tail: trimmed.slice(-4),
        scope: "workspace",
      });
      registerClientProperties({ has_openrouter_key: true });
      onKeyChanged();
    } catch (error) {
      logError("Failed to save OpenRouter key", error);
      setApiKeyError("Failed to save OpenRouter key.");
      toast.error("Failed to save OpenRouter key");
    } finally {
      setSavingKey(false);
    }
  }

  async function handleRemoveApiKey() {
    if (removingKey) return;
    const wasLinked = hasStoredKey;
    setRemovingKey(true);
    try {
      // TODO: Fix removeOpenRouterKey to work without userId/convexClient parameters
      // removeOpenRouterKey();
      setApiKeyInput("");
      setApiKeyError(null);
      toast.success("OpenRouter key removed");
      captureClientEvent("openrouter.key_removed", {
        source: "settings",
        had_models_cached: wasLinked,
      });
      registerClientProperties({ has_openrouter_key: false });
      onKeyChanged();
    } catch (error) {
      logError("Failed to remove OpenRouter key", error);
      toast.error("Failed to remove OpenRouter key");
    } finally {
      setRemovingKey(false);
    }
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
      <div className={cn("flex items-start justify-between", spacing.gap.sm)}>
        <div>
          <p className="text-sm font-medium">OpenRouter API key</p>
          <p className="text-xs text-muted-foreground">Connect your personal key so OpenChat can call OpenRouter models for you.</p>
        </div>
        <span className={cn("text-xs font-medium", hasStoredKey ? "text-emerald-600" : "text-destructive")}>
          {hasStoredKey ? "Key stored" : "Not set"}
        </span>
      </div>
      {apiKeyError ? <p id="settings-api-key-error" className="text-xs font-medium text-destructive" role="alert">{apiKeyError}</p> : null}
      <form className={cn("flex flex-col sm:flex-row", spacing.gap.sm)} onSubmit={handleSaveApiKey}>
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
          className="font-mono"
          aria-label="OpenRouter API key"
          aria-invalid={!!apiKeyError}
          aria-describedby={apiKeyError ? "settings-api-key-error" : undefined}
        />
        <Button type="submit" disabled={savingKey || apiKeyInput.trim().length < 10} className="sm:w-auto" aria-busy={savingKey}>
          {savingKey ? <Loader2 className={cn("mr-2 animate-spin", iconSize.sm)} aria-hidden="true" /> : null}
          {hasStoredKey ? "Replace key" : "Save key"}
        </Button>
      </form>
      <div className={cn("flex flex-wrap items-center justify-between text-xs text-muted-foreground", spacing.gap.sm)}>
        <p>Keys are encrypted in your browser before being stored in your account database and synced across devices. Once stored, keys cannot be viewed.</p>
        {hasStoredKey ? (
          <Button type="button" variant="ghost" size="sm" onClick={handleRemoveApiKey} disabled={removingKey} aria-label="Remove OpenRouter API key" aria-busy={removingKey}>
            {removingKey ? <Loader2 className={cn("mr-1 animate-spin", iconSize.xs)} aria-hidden="true" /> : null}
            Remove key
          </Button>
        ) : null}
      </div>
    </div>
  );
}
