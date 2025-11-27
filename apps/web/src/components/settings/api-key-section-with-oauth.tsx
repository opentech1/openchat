"use client";

/**
 * OpenRouter OAuth Connection Section
 *
 * This component handles OpenRouter OAuth connection.
 * Users can connect their OpenRouter account via OAuth for secure, easy access.
 */

import { useState } from "react";
import { Loader2 } from "@/lib/icons";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { captureClientEvent, registerClientProperties } from "@/lib/posthog";
import { logError } from "@/lib/logger";
import { iconSize } from "@/styles/design-tokens";
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
  const [disconnecting, setDisconnecting] = useState(false);

  // OAuth hook
  const { initiateLogin, isLoading: isOAuthLoading, error: oauthError } = useOpenRouterOAuth();

  // Key management hook
  const { removeKey } = useOpenRouterKey();

  async function handleDisconnect() {
    if (disconnecting) return;
    const wasLinked = hasStoredKey;
    setDisconnecting(true);
    try {
      await removeKey();
      toast.success("OpenRouter account disconnected");
      captureClientEvent("openrouter.disconnected", {
        source: "settings",
        had_models_cached: wasLinked,
      });
      registerClientProperties({ has_openrouter_key: false });
      onKeyChanged();
    } catch (error) {
      logError("Failed to disconnect OpenRouter account", error);
      toast.error("Failed to disconnect OpenRouter account");
    } finally {
      setDisconnecting(false);
    }
  }

  function handleOAuthConnect() {
    captureClientEvent("openrouter.oauth_initiated", {
      source: "settings",
    });
    initiateLogin();
  }

  // When connected, just show disconnect button inline
  if (hasStoredKey) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleDisconnect}
        disabled={disconnecting}
        aria-label="Disconnect OpenRouter account"
        aria-busy={disconnecting}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        {disconnecting ? (
          <Loader2
            className={cn("mr-1.5 animate-spin", iconSize.xs)}
            aria-hidden="true"
          />
        ) : null}
        Disconnect
      </Button>
    );
  }

  // When not connected, show the connect UI
  return (
    <div className="space-y-3">
      {/* OAuth Error Display */}
      {oauthError && (
        <p className="text-xs font-medium text-destructive" role="alert">
          OAuth error: {oauthError.message}
        </p>
      )}

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
        Connect with OpenRouter
      </Button>
      
      <p className="text-xs text-muted-foreground text-center">
        Your API key will be encrypted before storage
      </p>
    </div>
  );
}
