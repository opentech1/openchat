"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import * as React from "react";
import { borderRadius } from "@/styles/design-tokens";
import { fetchWithCsrf } from "@/lib/csrf-client";
import type { ModelSelectorOption } from "@/components/model-selector";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import {
  readCachedModels,
  writeCachedModels,
} from "@/lib/openrouter-model-cache";
import { getStorageItemSync, setStorageItemSync } from "@/lib/storage";
import { FileTextIcon } from "lucide-react";
import Link from "next/link";
import ChatComposer from "@/components/chat-composer";
import { toast } from "sonner";
import { OpenRouterLinkModalLazy as OpenRouterLinkModal } from "@/components/lazy/openrouter-link-modal-lazy";
import { logError } from "@/lib/logger";
import { captureClientEvent, registerClientProperties } from "@/lib/posthog";

const LAST_MODEL_STORAGE_KEY = "openchat:last-model";

function ChatPreview({ className }: { className?: string }) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [modelOptions, setModelOptions] = useState<ModelSelectorOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  const { apiKey, isLoading: keyLoading, saveKey } = useOpenRouterKey();

  // Load cached models on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = readCachedModels();
    if (cached && cached.length > 0) {
      setModelOptions(cached);
    }
  }, []);

  // Load last selected model from storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = getStorageItemSync(LAST_MODEL_STORAGE_KEY);
    if (stored && !selectedModel) {
      setSelectedModel(stored);
    }
  }, [selectedModel]);

  // Fetch models when API key is available
  useEffect(() => {
    if (!apiKey || keyLoading) return;

    const fetchModels = async () => {
      setModelsLoading(true);
      try {
        const response = await fetchWithCsrf("/api/openrouter/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey }),
        });
        const data = await response.json();
        if (response.ok && data?.ok) {
          const parsedModels = data.models as ModelSelectorOption[];
          setModelOptions(parsedModels);
          writeCachedModels(parsedModels);

          // Set default model if none selected
          if (!selectedModel && parsedModels.length > 0) {
            const stored = getStorageItemSync(LAST_MODEL_STORAGE_KEY);
            const defaultModel =
              stored && parsedModels.some((m) => m.value === stored)
                ? stored
                : parsedModels[0]!.value;
            setSelectedModel(defaultModel);
            setStorageItemSync(LAST_MODEL_STORAGE_KEY, defaultModel);
          }
        }
      } catch (error) {
        logError("Failed to fetch models:", error);
      } finally {
        setModelsLoading(false);
      }
    };

    void fetchModels();
  }, [apiKey, keyLoading, selectedModel]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    setStorageItemSync(LAST_MODEL_STORAGE_KEY, modelId);
  };

  const handleMissingRequirement = (reason: "apiKey" | "model") => {
    if (reason === "apiKey") {
      toast.error("Add your OpenRouter API key to use AI models", {
        duration: 6000,
        action: {
          label: "Add key",
          onClick: () => setShowKeyModal(true),
        },
      });
    } else {
      toast.error("Select an OpenRouter model to continue.");
    }
  };

  const handleSaveApiKey = async (key: string) => {
    setApiKeyError(null);
    setSavingApiKey(true);
    try {
      await saveKey(key);
      setShowKeyModal(false);
      registerClientProperties({ has_openrouter_key: true });
      captureClientEvent("openrouter.key_saved", {
        source: "modal",
        masked_tail: key.slice(-4),
        scope: "workspace",
      });
    } catch (error) {
      logError("Failed to save OpenRouter API key", error);
      setApiKeyError(
        error instanceof Error && error.message
          ? error.message
          : "Failed to save OpenRouter API key."
      );
    } finally {
      setSavingApiKey(false);
    }
  };

  const handleSend = async ({
    text,
    modelId,
  }: {
    text: string;
    modelId: string;
    apiKey: string;
  }) => {
    const messageText = text.trim();
    if (!messageText || isCreating) return;

    setIsCreating(true);

    // Store message and model for chat page to auto-send
    if (typeof window !== "undefined") {
      sessionStorage.setItem("pendingMessage", messageText);
      sessionStorage.setItem("pendingModel", modelId);
    }

    try {
      // Create a new empty chat
      const response = await fetchWithCsrf("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });

      if (!response.ok) {
        throw new Error("Failed to create chat");
      }

      const data = await response.json();

      captureClientEvent("chat.created", {
        chat_id: data.chat.id,
        source: "dashboard",
      });

      // Redirect to the new chat (message will auto-send from there)
      router.push(`/chat/${data.chat.id}`);
    } catch (error) {
      logError("Failed to create chat:", error);
      toast.error("Failed to create chat. Please try again.");
      // Clear session storage if failed
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("pendingMessage");
        sessionStorage.removeItem("pendingModel");
      }
      setIsCreating(false);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <OpenRouterLinkModal
        open={showKeyModal}
        saving={savingApiKey}
        errorMessage={apiKeyError}
        onSubmit={handleSaveApiKey}
        onTroubleshoot={() => setApiKeyError(null)}
        onClose={() => setShowKeyModal(false)}
        hasApiKey={Boolean(apiKey)}
      />

      <div className="text-foreground relative w-full overflow-hidden bg-transparent p-0">
        <div className="relative mx-auto w-full max-w-2xl">
          <div className="relative z-10 space-y-12 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            <div className="space-y-3 text-center">
              <div className="inline-block animate-in fade-in-0 slide-in-from-bottom-2 duration-200 delay-150">
                <h1 className="pb-1 text-3xl font-medium tracking-tight">
                  How can I help you today?
                </h1>
                <div className="via-primary/50 h-px bg-gradient-to-r from-transparent to-transparent animate-in fade-in-0 duration-400 delay-250" />
              </div>
              <p className="text-muted-foreground text-sm animate-in fade-in-0 duration-200 delay-200">
                Ask a question or type a command
              </p>
            </div>

            <div className="animate-in fade-in-0 zoom-in-[0.985] duration-200 delay-50">
              <ChatComposer
                placeholder="Type your message..."
                onSend={handleSend}
                disabled={isCreating}
                sendDisabled={isCreating || !selectedModel}
                modelOptions={modelOptions}
                modelValue={selectedModel}
                onModelChange={handleModelChange}
                modelsLoading={modelsLoading}
                apiKey={apiKey}
                onMissingRequirement={handleMissingRequirement}
                // No userId/chatId - file uploads will be hidden on dashboard
                // (files can only be uploaded after chat is created)
              />
            </div>

            {/* Prompt Library Quick Access */}
            <div className="flex items-center justify-center animate-in fade-in-0 duration-500 delay-300 py-2">
              <Link href="/templates" className="w-full max-w-md">
                <div
                  className={cn(
                    "group relative flex items-center justify-between px-6 py-4",
                    "bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10",
                    "border border-primary/20 hover:border-primary/40",
                    "hover:shadow-lg hover:shadow-primary/10",
                    "transition-all duration-200 hover:scale-[1.02]",
                    borderRadius.xl,
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10",
                      "bg-primary/20 group-hover:bg-primary/30",
                      "transition-colors",
                      borderRadius.lg,
                    )}>
                      <FileTextIcon className="size-5 text-primary" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-foreground">Prompt Library</span>
                      <span className="text-xs text-muted-foreground">
                        Create & manage reusable templates
                      </span>
                    </div>
                  </div>
                  <div className="text-muted-foreground group-hover:text-foreground transition-colors">
                    <svg
                      className="size-5"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ChatPreview);
