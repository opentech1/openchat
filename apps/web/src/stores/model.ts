/**
 * Model Selection Store - Persisted model preference
 */

import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";

export interface Model {
  id: string;
  name: string;
  provider: string;
}

export const models: Model[] = [
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "openai/o1", name: "o1", provider: "OpenAI" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "google/gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "google/gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek" },
  { id: "deepseek/deepseek-chat", name: "DeepSeek V3", provider: "DeepSeek" },
  { id: "meta-llama/llama-3.3-70b-instruct", name: "Llama 3.3 70B", provider: "Meta" },
];

// Group models by provider for easy rendering
export const modelsByProvider = models.reduce<Record<string, Model[]>>(
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
export const providerOrder = ["OpenAI", "Anthropic", "Google", "DeepSeek", "Meta"];

// Get model by ID
export function getModelById(id: string): Model | undefined {
  return models.find((m) => m.id === id);
}

interface ModelState {
  selectedModelId: string;
  setSelectedModel: (modelId: string) => void;
}

export const useModelStore = create<ModelState>()(
  devtools(
    persist(
      (set) => ({
        selectedModelId: "anthropic/claude-3.5-sonnet",

        setSelectedModel: (modelId) =>
          set({ selectedModelId: modelId }, false, "model/setSelectedModel"),
      }),
      {
        name: "model-store",
      }
    ),
    { name: "model-store" }
  )
);
