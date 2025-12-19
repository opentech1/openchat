"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import * as React from "react";
import { fetchWithCsrf } from "@/lib/csrf-client";
import type { ModelSelectorOption } from "@/components/model-selector";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import {
  readCachedModels,
  writeCachedModels,
} from "@/lib/openrouter-model-cache";
import { getStorageItemSync, setStorageItemSync } from "@/lib/storage";
import ChatComposer from "@/components/chat-composer";
import { toast } from "sonner";
import { OpenRouterLinkModalLazy as OpenRouterLinkModal } from "@/components/lazy/openrouter-link-modal-lazy";
import { logError } from "@/lib/logger";
import { captureClientEvent, registerClientProperties } from "@/lib/posthog";
import { useConvexUser } from "@/contexts/convex-user-context";
import type { Id } from "@server/convex/_generated/dataModel";

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
  const { convexUser } = useConvexUser();

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

  /**
   * Creates a new chat and returns its ID.
   * Used by ChatComposer when a file is uploaded before any message is sent.
   */
  const handleCreateChat = useCallback(async (): Promise<Id<"chats"> | null> => {
    try {
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
        source: "dashboard_file_upload",
      });

      return data.chat.id as Id<"chats">;
    } catch (error) {
      logError("Failed to create chat for file upload:", error);
      toast.error("Failed to create chat. Please try again.");
      return null;
    }
  }, []);

  const handleSend = async ({
    text,
    modelId,
    createdChatId,
  }: {
    text: string;
    modelId: string;
    apiKey: string;
    createdChatId?: Id<"chats">;
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
      let chatId = createdChatId;

      // Only create a new chat if one wasn't already created (e.g., during file upload)
      if (!chatId) {
        const response = await fetchWithCsrf("/api/chats", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title: "New Chat" }),
        });

        if (!response.ok) {
          throw new Error("Failed to create chat");
        }

        const data = await response.json();
        chatId = data.chat.id as Id<"chats">;

        captureClientEvent("chat.created", {
          chat_id: chatId,
          source: "dashboard",
        });
      }

      // Redirect to the chat (message will auto-send from there)
      router.push(`/chat/${chatId}`);
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
                userId={convexUser?._id}
                onCreateChat={handleCreateChat}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default React.memo(ChatPreview);
