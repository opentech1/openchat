/**
 * Model Selection Store - Persisted model preference with optimistic favorites
 *
 * This store manages:
 * - Selected model ID (persisted to localStorage)
 * - Optimistic favorites (for fast UI updates before Convex sync)
 *
 * The actual model list comes from Convex (synced from OpenRouter API).
 * This store only handles local state and optimistic updates.
 */

import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export interface Model {
  id: string;
  name: string;
  provider: string;
}

// Extended model type from Convex
export interface AIModel {
  _id: string;
  openRouterId: string;
  name: string;
  provider: string;
  contextLength: number;
  maxOutputLength?: number;
  inputModalities: string[];
  outputModalities: string[];
  supportedFeatures: string[];
  pricingPrompt?: string;
  pricingCompletion?: string;
  isFeatured: boolean;
  isLegacy: boolean;
  featuredOrder?: number;
  description?: string;
  lastSyncedAt: number;
  createdAt: number;
  updatedAt: number;
  // Added by queries
  isFavorite?: boolean;
}

// ============================================================================
// Fallback Models (used when Convex hasn't synced yet)
// ============================================================================

export const fallbackModels: Model[] = [
  // OpenAI
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai/o1", name: "o1", provider: "OpenAI" },
  { id: "openai/o3-mini", name: "o3 Mini", provider: "OpenAI" },

  // Anthropic
  { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "anthropic/claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic" },

  // Google
  { id: "google/gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "google/gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google" },

  // DeepSeek
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", provider: "DeepSeek" },

  // Meta
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "Meta" },

  // xAI
  { id: "x-ai/grok-2-1212", name: "Grok 2", provider: "xAI" },
];

// Legacy exports for backwards compatibility
export const models = fallbackModels;

// Group models by provider for easy rendering
export const modelsByProvider = fallbackModels.reduce<Record<string, Model[]>>(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {}
);

// Provider display order
export const providerOrder = ["Anthropic", "OpenAI", "Google", "DeepSeek", "Meta", "xAI", "Mistral"];

// Get model by ID (from fallback list)
export function getModelById(id: string): Model | undefined {
  return fallbackModels.find((m) => m.id === id);
}

// ============================================================================
// Store
// ============================================================================

interface ModelState {
  // Selection
  selectedModelId: string;
  setSelectedModel: (modelId: string) => void;

  // Optimistic favorites (for instant UI feedback)
  // These are reconciled with Convex data on component mount
  optimisticFavorites: Set<string>;
  addOptimisticFavorite: (modelId: string) => void;
  removeOptimisticFavorite: (modelId: string) => void;
  toggleOptimisticFavorite: (modelId: string) => boolean; // Returns new state
  clearOptimisticFavorites: () => void;
}

export const useModelStore = create<ModelState>()(
  devtools(
    persist(
      (set, get) => ({
        // Default to Claude 3.5 Sonnet
        selectedModelId: "anthropic/claude-3.5-sonnet",

        setSelectedModel: (modelId) =>
          set({ selectedModelId: modelId }, false, "model/setSelectedModel"),

        // Optimistic favorites for fast UI
        optimisticFavorites: new Set<string>(),

        addOptimisticFavorite: (modelId) =>
          set(
            (state) => ({
              optimisticFavorites: new Set([...state.optimisticFavorites, modelId]),
            }),
            false,
            "model/addOptimisticFavorite"
          ),

        removeOptimisticFavorite: (modelId) =>
          set(
            (state) => {
              const newFavorites = new Set(state.optimisticFavorites);
              newFavorites.delete(modelId);
              return { optimisticFavorites: newFavorites };
            },
            false,
            "model/removeOptimisticFavorite"
          ),

        toggleOptimisticFavorite: (modelId) => {
          const current = get().optimisticFavorites;
          const isFavorite = current.has(modelId);

          if (isFavorite) {
            get().removeOptimisticFavorite(modelId);
          } else {
            get().addOptimisticFavorite(modelId);
          }

          return !isFavorite;
        },

        clearOptimisticFavorites: () =>
          set({ optimisticFavorites: new Set() }, false, "model/clearOptimisticFavorites"),
      }),
      {
        name: "model-store",
        // Custom serialization for Set
        partialize: (state) => ({
          selectedModelId: state.selectedModelId,
          optimisticFavorites: Array.from(state.optimisticFavorites),
        }),
        // Custom deserialization for Set
        merge: (persisted, current) => {
          const persistedData = persisted as {
            selectedModelId?: string;
            optimisticFavorites?: string[];
          };
          return {
            ...current,
            selectedModelId: persistedData?.selectedModelId ?? current.selectedModelId,
            optimisticFavorites: new Set(persistedData?.optimisticFavorites ?? []),
          };
        },
      }
    ),
    { name: "model-store" }
  )
);

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Get the currently selected model from the fallback list
 * Used for display when Convex data isn't available
 */
export function useSelectedModelFallback(): Model {
  const selectedModelId = useModelStore((s) => s.selectedModelId);
  return getModelById(selectedModelId) ?? fallbackModels[0];
}
