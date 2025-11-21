/**
 * State management hook for chat room
 * Manages OpenRouter state, model selection, and API key handling
 */

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useOpenRouterKey } from "@/hooks/use-openrouter-key";
import { readCachedModels, writeCachedModels } from "@/lib/openrouter-model-cache";
import { fetchWithCsrf } from "@/lib/csrf-client";
import { captureClientEvent } from "@/lib/posthog";
import { logError } from "@/lib/logger";
import { isApiError } from "@/lib/error-handling";
import { getStorageItemSync, setStorageItemSync, removeStorageItemSync } from "@/lib/storage";
import { LOCAL_STORAGE_KEYS, SESSION_STORAGE_KEYS } from "@/config/storage-keys";
import type { ModelSelectorOption } from "@/components/model-selector";

// OpenRouter state reducer
type OpenRouterState = {
	savingApiKey: boolean;
	apiKeyError: string | null;
	modelsError: string | null;
	modelsLoading: boolean;
	modelOptions: ModelSelectorOption[];
	selectedModel: string | null;
	checkedApiKey: boolean;
	keyPromptDismissed: boolean;
};

type OpenRouterAction =
	| { type: "SET_SAVING_API_KEY"; payload: boolean }
	| { type: "SET_API_KEY_ERROR"; payload: string | null }
	| { type: "SET_MODELS_ERROR"; payload: string | null }
	| { type: "SET_MODELS_LOADING"; payload: boolean }
	| { type: "SET_MODEL_OPTIONS"; payload: ModelSelectorOption[] }
	| { type: "SET_SELECTED_MODEL"; payload: string | null }
	| { type: "SET_CHECKED_API_KEY"; payload: boolean }
	| { type: "SET_KEY_PROMPT_DISMISSED"; payload: boolean }
	| { type: "CLEAR_MODELS" }
	| { type: "RESET_ERRORS" };

function openRouterReducer(
	state: OpenRouterState,
	action: OpenRouterAction,
): OpenRouterState {
	switch (action.type) {
		case "SET_SAVING_API_KEY":
			return { ...state, savingApiKey: action.payload };
		case "SET_API_KEY_ERROR":
			return { ...state, apiKeyError: action.payload };
		case "SET_MODELS_ERROR":
			return { ...state, modelsError: action.payload };
		case "SET_MODELS_LOADING":
			return { ...state, modelsLoading: action.payload };
		case "SET_MODEL_OPTIONS":
			return { ...state, modelOptions: action.payload };
		case "SET_SELECTED_MODEL":
			return { ...state, selectedModel: action.payload };
		case "SET_CHECKED_API_KEY":
			return { ...state, checkedApiKey: action.payload };
		case "SET_KEY_PROMPT_DISMISSED":
			return { ...state, keyPromptDismissed: action.payload };
		case "CLEAR_MODELS":
			return {
				...state,
				modelOptions: [],
				selectedModel: null,
			};
		case "RESET_ERRORS":
			return {
				...state,
				apiKeyError: null,
				modelsError: null,
			};
		default:
			return state;
	}
}

const initialOpenRouterState: OpenRouterState = {
	savingApiKey: false,
	apiKeyError: null,
	modelsError: null,
	modelsLoading: false,
	modelOptions: [],
	selectedModel: null,
	checkedApiKey: false,
	keyPromptDismissed: true,
};

export interface UseChatStateResult {
	// OpenRouter state
	apiKey: string | null;
	keyLoading: boolean;
	savingApiKey: boolean;
	apiKeyError: string | null;
	modelsError: string | null;
	modelsLoading: boolean;
	modelOptions: ModelSelectorOption[];
	selectedModel: string | null;
	checkedApiKey: boolean;
	keyPromptDismissed: boolean;

	// Pending message state
	pendingMessage: string;
	shouldAutoSend: boolean;
	autoSendAttemptedRef: React.MutableRefObject<boolean>;

	// Actions
	saveKey: (key: string) => Promise<void>;
	removeKey: () => Promise<void>;
	fetchModels: (key: string) => Promise<void>;
	handleSaveApiKey: (key: string) => Promise<void>;
	applySelectedModel: (model: string | null) => void;
	dispatch: React.Dispatch<OpenRouterAction>;
	setPendingMessage: (message: string) => void;
	setShouldAutoSend: (value: boolean) => void;
}

export function useChatState(): UseChatStateResult {
	// Use the OpenRouter key hook for key management
	const {
		apiKey,
		isLoading: keyLoading,
		error: _keyError,
		saveKey,
		removeKey,
	} = useOpenRouterKey();

	// Use reducer for OpenRouter state management
	const [openRouterState, dispatch] = useReducer(
		openRouterReducer,
		initialOpenRouterState,
	);

	const storedModelIdRef = useRef<string | null>(null);
	const fetchModelsAbortControllerRef = useRef<AbortController | null>(null);
	const autoSendAttemptedRef = useRef(false);

	const [pendingMessage, setPendingMessage] = useState<string>("");
	const [shouldAutoSend, setShouldAutoSend] = useState(false);

	// Check for pending message and model from dashboard on mount
	useEffect(() => {
		if (typeof window === "undefined") return;
		const pending = sessionStorage.getItem(SESSION_STORAGE_KEYS.PENDING_MESSAGE);
		if (pending) {
			setPendingMessage(pending);
			setShouldAutoSend(true);
			sessionStorage.removeItem(SESSION_STORAGE_KEYS.PENDING_MESSAGE);
		}
		const pendingModel = sessionStorage.getItem(SESSION_STORAGE_KEYS.PENDING_MODEL);
		if (pendingModel) {
			dispatch({ type: "SET_SELECTED_MODEL", payload: pendingModel });
			setStorageItemSync(LOCAL_STORAGE_KEYS.USER.LAST_MODEL, pendingModel);
			storedModelIdRef.current = pendingModel;
			sessionStorage.removeItem(SESSION_STORAGE_KEYS.PENDING_MODEL);
		}
	}, []);

	// Load cached models on mount
	useEffect(() => {
		if (typeof window === "undefined") return;
		const cached = readCachedModels();
		if (cached && cached.length > 0) {
			dispatch({ type: "SET_MODEL_OPTIONS", payload: cached });
			const stored = storedModelIdRef.current;
			const initialModel =
				stored && cached.some((option) => option.value === stored)
					? stored
					: (cached[0]?.value ?? null);
			if (initialModel) {
				dispatch({ type: "SET_SELECTED_MODEL", payload: initialModel });
			}
		}
	}, []);

	const persistSelectedModel = useCallback((next: string | null) => {
		if (next) {
			setStorageItemSync(LOCAL_STORAGE_KEYS.USER.LAST_MODEL, next);
		} else {
			removeStorageItemSync(LOCAL_STORAGE_KEYS.USER.LAST_MODEL);
		}
		storedModelIdRef.current = next;
	}, []);

	const applySelectedModel = useCallback(
		(next: string | null) => {
			if (openRouterState.selectedModel !== next) {
				persistSelectedModel(next);
				dispatch({ type: "SET_SELECTED_MODEL", payload: next });
			}
		},
		[persistSelectedModel, openRouterState.selectedModel],
	);

	// Load stored model on mount
	useEffect(() => {
		const stored = getStorageItemSync(LOCAL_STORAGE_KEYS.USER.LAST_MODEL);
		storedModelIdRef.current = stored;
		if (stored && !openRouterState.selectedModel) {
			dispatch({ type: "SET_SELECTED_MODEL", payload: stored });
		}
	}, []);

	const fetchModels = useCallback(
		async (key: string) => {
			// Cancel any in-flight request to prevent race conditions
			if (fetchModelsAbortControllerRef.current) {
				fetchModelsAbortControllerRef.current.abort();
			}

			const abortController = new AbortController();
			fetchModelsAbortControllerRef.current = abortController;

			dispatch({ type: "SET_MODELS_LOADING", payload: true });
			dispatch({ type: "SET_MODELS_ERROR", payload: null });
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
						void removeKey();
						dispatch({ type: "CLEAR_MODELS" });
					}
					const errorMessage =
						typeof data?.message === "string" && data.message.length > 0
							? data.message
							: "Failed to fetch OpenRouter models.";
					let providerHost = "openrouter.ai";
					try {
						const baseUrl =
							process.env.NEXT_PUBLIC_OPENROUTER_BASE_URL ??
							"https://openrouter.ai/api/v1";
						providerHost = new URL(response.url ?? baseUrl).host;
					} catch {
						providerHost = "openrouter.ai";
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
				dispatch({ type: "SET_MODEL_OPTIONS", payload: parsedModels });
				writeCachedModels(parsedModels);
				const fallback = parsedModels[0]?.value ?? null;
				const storedPreferred = storedModelIdRef.current;
				let nextModel: string | null = openRouterState.selectedModel;
				if (
					storedPreferred &&
					parsedModels.some((model) => model.value === storedPreferred)
				) {
					nextModel = storedPreferred;
				} else if (
					!openRouterState.selectedModel ||
					!parsedModels.some((model) => model.value === openRouterState.selectedModel)
				) {
					nextModel = fallback;
				}
				if (nextModel !== openRouterState.selectedModel) {
					persistSelectedModel(nextModel ?? null);
					dispatch({ type: "SET_SELECTED_MODEL", payload: nextModel ?? null });
				}
			} catch (error) {
				// Ignore abort errors (request was cancelled)
				if (error instanceof Error && error.name === "AbortError") {
					return;
				}

				logError("Failed to load OpenRouter models", error);
				if (isApiError(error) && !error.__posthogTracked) {
					const status = typeof error.status === "number" ? error.status : 0;
					let providerHost = "openrouter.ai";
					const providerUrl = error.providerUrl;
					if (typeof providerUrl === "string" && providerUrl.length > 0) {
						try {
							providerHost = new URL(providerUrl).host;
						} catch {
							providerHost = "openrouter.ai";
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
				dispatch({ type: "CLEAR_MODELS" });
				dispatch({
					type: "SET_MODELS_ERROR",
					payload:
						error instanceof Error && error.message
							? error.message
							: "Failed to load OpenRouter models.",
				});
			} finally {
				// Only clear loading if this is still the active request
				if (fetchModelsAbortControllerRef.current === abortController) {
					dispatch({ type: "SET_MODELS_LOADING", payload: false });
					fetchModelsAbortControllerRef.current = null;
				}
			}
		},
		[persistSelectedModel, openRouterState.selectedModel, removeKey],
	);

	// Cleanup: abort pending requests on unmount
	useEffect(() => {
		return () => {
			if (fetchModelsAbortControllerRef.current) {
				fetchModelsAbortControllerRef.current.abort();
				fetchModelsAbortControllerRef.current = null;
			}
		};
	}, []);

	// Fetch models when API key is loaded
	useEffect(() => {
		// Mark that we've checked for API key once the hook finishes loading
		if (!keyLoading) {
			dispatch({ type: "SET_CHECKED_API_KEY", payload: true });
		}

		// Fetch models when key becomes available
		if (apiKey && !keyLoading) {
			void fetchModels(apiKey);
		}
	}, [apiKey, keyLoading, fetchModels]);

	// Select stored model when models are loaded
	useEffect(() => {
		if (openRouterState.modelOptions.length === 0) return;
		const stored = storedModelIdRef.current;
		if (!stored || openRouterState.selectedModel) return;
		const exists = openRouterState.modelOptions.some((option) => option.value === stored);
		if (exists) {
			dispatch({ type: "SET_SELECTED_MODEL", payload: stored });
		}
	}, [openRouterState.modelOptions, openRouterState.selectedModel]);

	// Update keyPromptDismissed when API key changes
	useEffect(() => {
		if (!apiKey) return;
		dispatch({ type: "SET_KEY_PROMPT_DISMISSED", payload: false });
	}, [apiKey]);

	const handleSaveApiKey = useCallback(
		async (key: string) => {
			dispatch({ type: "SET_API_KEY_ERROR", payload: null });
			dispatch({ type: "SET_SAVING_API_KEY", payload: true });
			try {
				await saveKey(key);
				dispatch({ type: "SET_KEY_PROMPT_DISMISSED", payload: false });
				captureClientEvent("openrouter.key_saved", {
					source: "modal",
					masked_tail: key.slice(-4),
					scope: "workspace",
				});
				await fetchModels(key);
			} catch (error) {
				logError("Failed to save OpenRouter API key", error);
				dispatch({
					type: "SET_API_KEY_ERROR",
					payload:
						error instanceof Error && error.message
							? error.message
							: "Failed to save OpenRouter API key.",
				});
			} finally {
				dispatch({ type: "SET_SAVING_API_KEY", payload: false });
			}
		},
		[saveKey, fetchModels],
	);

	return {
		// OpenRouter state
		apiKey,
		keyLoading,
		savingApiKey: openRouterState.savingApiKey,
		apiKeyError: openRouterState.apiKeyError,
		modelsError: openRouterState.modelsError,
		modelsLoading: openRouterState.modelsLoading,
		modelOptions: openRouterState.modelOptions,
		selectedModel: openRouterState.selectedModel,
		checkedApiKey: openRouterState.checkedApiKey,
		keyPromptDismissed: openRouterState.keyPromptDismissed,

		// Pending message state
		pendingMessage,
		shouldAutoSend,
		autoSendAttemptedRef,

		// Actions
		saveKey,
		removeKey,
		fetchModels,
		handleSaveApiKey,
		applySelectedModel,
		dispatch,
		setPendingMessage,
		setShouldAutoSend,
	};
}
