"use client";

import { Button } from "@/components/ui/button";
import { useOpenRouterAuth } from "@/contexts/openrouter-auth";
import { ExternalLink, Loader2, Sparkles, Unlink } from "lucide-react";

interface OpenRouterConnectProps {
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg";
  showStatus?: boolean;
}

export function OpenRouterConnect({ 
  variant = "default", 
  size = "default",
  showStatus = true 
}: OpenRouterConnectProps) {
  const { 
    isConnected, 
    isLoading, 
    connectOpenRouter, 
    disconnect,
    availableModels 
  } = useOpenRouterAuth();

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Checking connection...
      </Button>
    );
  }

  if (isConnected) {
    if (!showStatus) return null;
    
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Sparkles className="h-4 w-4" />
          <span>OpenRouter Connected</span>
          <span className="text-xs text-muted-foreground">
            ({availableModels.length} models)
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          className="h-8 px-2 text-muted-foreground hover:text-destructive"
        >
          <Unlink className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={connectOpenRouter}
      className="gap-2"
    >
      <ExternalLink className="h-4 w-4" />
      Connect OpenRouter
    </Button>
  );
}

// Compact version for chat interface
export function OpenRouterStatus() {
  const { isConnected, isLoading, availableModels } = useOpenRouterAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Checking...</span>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
        <Sparkles className="h-3 w-3" />
        <span>{availableModels.length} models available</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
      <ExternalLink className="h-3 w-3" />
      <span>Connect OpenRouter to chat</span>
    </div>
  );
}