"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModelSelectorOption } from "@/components/model-selector";
import {
  readCachedModels,
  writeCachedModels,
  clearCachedModels,
} from "@/lib/openrouter-model-cache";
import { KEY_CHANGE_EVENT } from "@/hooks/use-openrouter-key";
import { captureClientEvent, registerClientProperties } from "@/lib/posthog";
import { logError } from "@/lib/logger";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { isApiError } from "@/lib/error-handling";
import { OPENROUTER_CONFIG } from "@/config/constants";

const LAST_MODEL_STORAGE_KEY = "openchat:last-model";

type ModelManagerState = {
  apiKey: string | null;
  modelOptions: ModelSelectorOption[];
  selectedModel: string | null;
  modelsLoading: boolean;
  modelsError: string | null;
};

type ModelManagerActions = {
  setApiKey: (key: string | null) => void;
  setModelsError: (error: string | null) => void;
  handleSaveApiKey: (key: string) => Promise<void>;
  handleModelSelection: (modelId: string) => void;
};

export function useModelManager(): ModelManagerState & ModelManagerActions {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [modelOptions, setModelOptions] = useState<ModelSelectorOption[]>([]);
  const [selectedModel, setSelectedModelState] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const storedModelIdRef = useRef<string | null>(null);
  const fetchModelsAbortControllerRef = useRef<AbortController | null>(null);

  // Load cached models on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cached = readCachedModels();
    if (cached && cached.length > 0) {
      setModelOptions(cached);
      setSelectedModelState((prev) => {
        if (prev) return prev;
        const stored = storedModelIdRef.current;
        if (stored && cached.some((option) => option.value === stored)) {
          return stored;
        }
        return cached[0]?.value ?? null;
      });
    }
  }, []);

  // Load stored model preference
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(LAST_MODEL_STORAGE_KEY);
    storedModelIdRef.current = stored;
    if (stored) {
      setSelectedModelState((prev) => prev ?? stored);
    }
  }, []);

  // Listen for API key changes and clear model state when key is removed
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleKeyChange = () => {
      // Clear models immediately - if key was removed, UI should show "Connect" button
      // If key was added, new models will be fetched by the component using this hook
      clearCachedModels();
      setModelOptions([]);
      setSelectedModelState(null);
      setApiKey(null);
      setModelsError(null);
    };

    window.addEventListener(KEY_CHANGE_EVENT, handleKeyChange);
    return () => {
      window.removeEventListener(KEY_CHANGE_EVENT, handleKeyChange);
    };
  }, []);

  // Apply stored model when options become available
  useEffect(() => {
    if (modelOptions.length === 0) return;
    const stored = storedModelIdRef.current;
    if (!stored) return;
    setSelectedModelState((previous) => {
      if (previous) return previous;
      const exists = modelOptions.some((option) => option.value === stored);
      if (!exists) return previous;
      return stored;
    });
  }, [modelOptions]);

  const persistSelectedModel = useCallback((next: string | null) => {
    if (typeof window !== "undefined") {
      try {
        if (next) {
          window.localStorage.setItem(LAST_MODEL_STORAGE_KEY, next);
        } else {
          window.localStorage.removeItem(LAST_MODEL_STORAGE_KEY);
        }
      } catch {
        // ignore storage failures
      }
    }
    storedModelIdRef.current = next;
  }, []);

  const applySelectedModel = useCallback(
    (next: string | null) => {
      setSelectedModelState((prev) => {
        if (prev === next) return prev;
        persistSelectedModel(next);
        return next;
      });
    },
    [persistSelectedModel],
  );

  const fetchModels = useCallback(
    async (key: string) => {
      // Cancel any in-flight request to prevent race conditions
      if (fetchModelsAbortControllerRef.current) {
        fetchModelsAbortControllerRef.current.abort();
      }

      const abortController = new AbortController();
      fetchModelsAbortControllerRef.current = abortController;

      setModelsLoading(true);
      setModelsError(null);
      try {
        const response = await fetchWithCsrf("/api/openrouter/models", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ apiKey: key }),
          signal: abortController.signal,
        });
        const data = await response.json();
        if (!response.ok || !data?.ok) {
          if (response.status === 401) {
            // Clear local API key state (server-side key removal handled elsewhere)
            setApiKey(null);
          }
          const errorMessage =
            typeof data?.message === "string" && data.message.length > 0
              ? data.message
              : "Failed to fetch OpenRouter models.";
          let providerHost: string = OPENROUTER_CONFIG.HOST;
          try {
            const baseUrl =
              process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL ??
              "https://openrouter.ai/api/v1";
            providerHost = new URL(response.url ?? baseUrl).host;
          } catch {
            providerHost = OPENROUTER_CONFIG.HOST;
          }
          captureClientEvent("openrouter.models_fetch_failed", {
            status: response.status,
            error_message: errorMessage,
            provider_host: providerHost,
            has_api_key: Boolean(key),
          });
          throw Object.assign(new Error(errorMessage), {
            __posthogTracked: true,
            status: response.status,
            providerUrl: response.url,
          });
        }
        const parsedModels = data.models as ModelSelectorOption[];
        setModelOptions(parsedModels);
        writeCachedModels(parsedModels);
        const fallback = parsedModels[0]?.value ?? null;
        setSelectedModelState((previous) => {
          const storedPreferred = storedModelIdRef.current;
          let next: string | null = previous;
          if (
            storedPreferred &&
            parsedModels.some((model) => model.value === storedPreferred)
          ) {
            next = storedPreferred;
          } else if (
            !previous ||
            !parsedModels.some((model) => model.value === previous)
          ) {
            next = fallback;
          }
          if (next !== previous) persistSelectedModel(next ?? null);
          return next ?? null;
        });
      } catch (error) {
        // Ignore abort errors (request was cancelled)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        logError("Failed to load OpenRouter models", error);
        const apiError = isApiError(error) ? error : null;
        if (!apiError?.__posthogTracked) {
          const status =
            typeof apiError?.status === "number" ? apiError.status : 0;
          let providerHost: string = OPENROUTER_CONFIG.HOST;
          const providerUrl = apiError?.providerUrl;
          if (typeof providerUrl === "string" && providerUrl.length > 0) {
            try {
              providerHost = new URL(providerUrl).host;
            } catch {
              providerHost = OPENROUTER_CONFIG.HOST;
            }
          }
          captureClientEvent("openrouter.models_fetch_failed", {
            status,
            error_message:
              error instanceof Error && error.message
                ? error.message
                : "Failed to load OpenRouter models.",
            provider_host: providerHost,
            has_api_key: Boolean(key),
          });
        }
        setModelOptions([]);
        applySelectedModel(null);
        setModelsError(
          error instanceof Error && error.message
            ? error.message
            : "Failed to load OpenRouter models.",
        );
      } finally {
        // Only clear loading if this is still the active request
        if (fetchModelsAbortControllerRef.current === abortController) {
          setModelsLoading(false);
          fetchModelsAbortControllerRef.current = null;
        }
      }
    },
    [persistSelectedModel, applySelectedModel],
  );

  const handleSaveApiKey = useCallback(
    async (key: string) => {
      try {
        setApiKey(key);
        registerClientProperties({ has_openrouter_key: true });
        captureClientEvent("openrouter.key_saved", {
          source: "modal",
          masked_tail: key.slice(-4),
          scope: "workspace",
        });
        await fetchModels(key);
      } catch (error) {
        logError("Failed to save OpenRouter API key", error);
        throw error;
      }
    },
    [fetchModels],
  );

  const handleModelSelection = useCallback(
    (modelId: string) => {
      applySelectedModel(modelId);
    },
    [applySelectedModel],
  );

  return {
    apiKey,
    modelOptions,
    selectedModel,
    modelsLoading,
    modelsError,
    setApiKey,
    setModelsError,
    handleSaveApiKey,
    handleModelSelection,
  };
}
