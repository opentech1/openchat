"use client";

/**
 * Enhanced API Key Section with OAuth Support
 *
 * This component demonstrates how to integrate the OpenRouter OAuth flow
 * alongside the manual API key entry. Users can choose to either:
 * 1. Connect via OAuth (recommended - more secure, easier)
 * 2. Manually enter their API key (advanced users)
 *
 * Usage:
 * Replace the existing ApiKeySection component with this one to add OAuth support.
 */

import { useState, type FormEvent } from "react";
import { Loader2 } from "@/lib/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { captureClientEvent, registerClientProperties } from "@/lib/posthog";
import { logError } from "@/lib/logger";
import { spacing, iconSize } from "@/styles/design-tokens";
import { useOpenRouterOAuth } from "@/hooks/use-openrouter-oauth";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";

type ApiKeySectionWithOAuthProps = {
  hasStoredKey: boolean;
  onKeyChanged: () => void;
};

export function ApiKeySectionWithOAuth({
  hasStoredKey,
  onKeyChanged,
}: ApiKeySectionWithOAuthProps) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [savingKey, setSavingKey] = useState(false);
  const [removingKey, setRemovingKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);

  // OAuth hook
  const { initiateLogin, isLoading: isOAuthLoading, error: oauthError } = useOpenRouterOAuth();

  // Key management hook
  const { saveKey, removeKey } = useOpenRouterKey();

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
      await saveKey(trimmed);
      setApiKeyInput("");
      toast.success("OpenRouter key saved");
      captureClientEvent("openrouter.key_saved", {
        source: "settings_manual",
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
      await removeKey();
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

  function handleOAuthConnect() {
    captureClientEvent("openrouter.oauth_initiated", {
      source: "settings",
    });
    initiateLogin();
  }

  return (
    <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
      <div className={cn("flex items-start justify-between", spacing.gap.sm)}>
        <div>
          <p className="text-sm font-medium">OpenRouter API key</p>
          <p className="text-xs text-muted-foreground">
            Connect your personal key so OpenChat can call OpenRouter models for you.
          </p>
        </div>
        <span
          className={cn(
            "text-xs font-medium",
            hasStoredKey ? "text-emerald-600" : "text-destructive"
          )}
        >
          {hasStoredKey ? "Key stored" : "Not set"}
        </span>
      </div>

      {/* OAuth Error Display */}
      {oauthError && (
        <p className="text-xs font-medium text-destructive" role="alert">
          OAuth error: {oauthError.message}
        </p>
      )}

      {/* API Key Error Display */}
      {apiKeyError && (
        <p
          id="settings-api-key-error"
          className="text-xs font-medium text-destructive"
          role="alert"
        >
          {apiKeyError}
        </p>
      )}

      {!hasStoredKey && !showManualEntry && (
        <div className="space-y-2">
          {/* OAuth Connect Button (Primary Option) */}
          <Button
            type="button"
            onClick={handleOAuthConnect}
            disabled={isOAuthLoading}
            className="w-full"
            size="default"
          >
            {isOAuthLoading ? (
              <Loader2
                className={cn("mr-2 animate-spin", iconSize.sm)}
                aria-hidden="true"
              />
            ) : null}
            Connect with OpenRouter OAuth
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-muted/40 px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>

          {/* Manual Entry Button */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowManualEntry(true)}
            className="w-full"
            size="sm"
          >
            Enter API key manually
          </Button>
        </div>
      )}

      {/* Manual API Key Entry Form */}
      {(!hasStoredKey && showManualEntry) || hasStoredKey ? (
        <>
          <form
            className={cn("flex flex-col sm:flex-row", spacing.gap.sm)}
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
              className="font-mono"
              aria-label="OpenRouter API key"
              aria-invalid={!!apiKeyError}
              aria-describedby={
                apiKeyError ? "settings-api-key-error" : undefined
              }
            />
            <Button
              type="submit"
              disabled={savingKey || apiKeyInput.trim().length < 10}
              className="sm:w-auto"
              aria-busy={savingKey}
            >
              {savingKey ? (
                <Loader2
                  className={cn("mr-2 animate-spin", iconSize.sm)}
                  aria-hidden="true"
                />
              ) : null}
              {hasStoredKey ? "Replace key" : "Save key"}
            </Button>
          </form>

          {!hasStoredKey && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowManualEntry(false)}
              className="text-xs"
            >
              Use OAuth instead
            </Button>
          )}
        </>
      ) : null}

      <div
        className={cn(
          "flex flex-wrap items-center justify-between text-xs text-muted-foreground",
          spacing.gap.sm
        )}
      >
        <p>
          Keys are encrypted in your browser before being stored in your account
          database and synced across devices. Once stored, keys cannot be viewed.
        </p>
        {hasStoredKey ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveApiKey}
            disabled={removingKey}
            aria-label="Remove OpenRouter API key"
            aria-busy={removingKey}
          >
            {removingKey ? (
              <Loader2
                className={cn("mr-1 animate-spin", iconSize.xs)}
                aria-hidden="true"
              />
            ) : null}
            Remove key
          </Button>
        ) : null}
      </div>
    </div>
  );
}
