/**
 * Model Selection Store - Local model management with OpenRouter API
 *
 * Features:
 * - Fetches models directly from OpenRouter API
 * - Caches in browser localStorage for 4 hours
 * - Falls back to curated list if API unavailable
 * - Local favorites (persisted in localStorage)
 * - Selected model persistence
 */

import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'

// ============================================================================
// Types
// ============================================================================

export interface ModelPricing {
  prompt: number // Cost per 1M input tokens
  completion: number // Cost per 1M output tokens
}

export interface Model {
  id: string
  name: string
  provider: string
  description?: string
  contextLength?: number
  maxCompletionTokens?: number
  pricing?: ModelPricing
  supportedFeatures?: string[]
  // Computed fields for sorting/filtering
  isTopTier?: boolean // Major provider flagship models
  isFree?: boolean
}

// ============================================================================
// Featured Models - Curated list shown by default
// ============================================================================

const FEATURED_MODEL_IDS = [
  // Anthropic (top-tier)
  'anthropic/claude-sonnet-4',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.5-haiku',
  'anthropic/claude-3-opus',
  // OpenAI
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o1',
  'openai/o3-mini',
  // Google
  'google/gemini-2.0-flash-exp',
  'google/gemini-1.5-pro',
  // DeepSeek
  'deepseek/deepseek-r1',
  'deepseek/deepseek-chat',
  // Meta
  'meta-llama/llama-3.3-70b-instruct',
  // xAI
  'x-ai/grok-2-1212',
  // Mistral
  'mistralai/mistral-large-2411',
]

// Fallback models used when API is unavailable
export const fallbackModels: Model[] = [
  // OpenAI
  { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI' },
  { id: 'openai/o1', name: 'o1', provider: 'OpenAI' },
  { id: 'openai/o3-mini', name: 'o3 Mini', provider: 'OpenAI' },
  // Anthropic
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
  },
  {
    id: 'anthropic/claude-3-opus',
    name: 'Claude 3 Opus',
    provider: 'Anthropic',
  },
  // Google
  {
    id: 'google/gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
  },
  { id: 'google/gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'Google' },
  // DeepSeek
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek' },
  { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3', provider: 'DeepSeek' },
  // Meta
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    provider: 'Meta',
  },
  // xAI
  { id: 'x-ai/grok-2-1212', name: 'Grok 2', provider: 'xAI' },
  // Mistral
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large',
    provider: 'Mistral',
  },
]

// Legacy export for backwards compatibility
export const models = fallbackModels

// Group models by provider for easy rendering
export const modelsByProvider = fallbackModels.reduce<Record<string, Model[]>>(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  },
  {},
)

// Provider display order
export const providerOrder = [
  'Anthropic',
  'OpenAI',
  'Google',
  'DeepSeek',
  'Meta',
  'xAI',
  'Mistral',
]

// Get model by ID (from fallback list)
export function getModelById(id: string): Model | undefined {
  return fallbackModels.find((m) => m.id === id)
}

// ============================================================================
// OpenRouter API Cache
// ============================================================================

const CACHE_KEY = 'openrouter-models-cache'
const CACHE_TTL = 4 * 60 * 60 * 1000 // 4 hours in milliseconds

interface CachedModels {
  models: Model[]
  timestamp: number
}

function getCachedModels(): Model[] | null {
  if (typeof window === 'undefined') return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null

    const data: CachedModels = JSON.parse(cached)
    const age = Date.now() - data.timestamp

    // Return cached if still valid
    if (age < CACHE_TTL) {
      return data.models
    }

    // Cache expired
    return null
  } catch {
    return null
  }
}

function setCachedModels(models: Model[]): void {
  if (typeof window === 'undefined') return

  try {
    const data: CachedModels = {
      models,
      timestamp: Date.now(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or disabled, ignore
  }
}

// Provider display names (from API provider slug)
const PROVIDER_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  deepseek: 'DeepSeek',
  'meta-llama': 'Meta',
  'x-ai': 'xAI',
  mistralai: 'Mistral',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
}

// Extract features from OpenRouter model data
function extractFeatures(model: any): string[] {
  const features: string[] = []

  // Vision support
  if (
    model.architecture?.modality?.includes('image') ||
    model.architecture?.input_modalities?.includes('image')
  ) {
    features.push('vision')
  }

  // Tool calling
  if (model.supported_parameters?.includes('tools')) {
    features.push('tools')
  }

  // Reasoning (Claude, o1, o3, DeepSeek R1)
  if (
    model.id.includes('claude') ||
    model.id.includes('o1') ||
    model.id.includes('o3') ||
    model.id.includes('deepseek-r1')
  ) {
    features.push('reasoning')
  }

  return features
}

/**
 * Fetch models from OpenRouter API
 * Returns cached models if available and fresh, otherwise fetches from API
 */
export async function fetchOpenRouterModels(): Promise<Model[]> {
  // Check cache first
  const cached = getCachedModels()
  if (cached) {
    return cached
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`)
    }

    const data = await response.json()
    const rawModels = data.data || []

    // Transform to our Model format
    const models: Model[] = rawModels
      .filter((m: any) => m.id && !isLegacyModel(m.id))
      .map((m: any) => {
        const provider = m.id.split('/')[0] || 'unknown'
        return {
          id: m.id,
          name: m.name || m.id,
          provider: PROVIDER_NAMES[provider] || provider,
          contextLength: m.context_length,
          supportedFeatures: extractFeatures(m),
        }
      })

    // Cache the results
    setCachedModels(models)

    return models
  } catch (error) {
    console.error('Failed to fetch models from OpenRouter:', error)
    // Return fallback on error
    return fallbackModels
  }
}

// Legacy model patterns to filter out
function isLegacyModel(id: string): boolean {
  const patterns = [
    /-preview$/i,
    /-0[0-9]{3}$/i, // Date suffixes like -0301
    /deprecated/i,
    /beta$/i,
  ]
  return patterns.some((p) => p.test(id))
}

/**
 * Get featured models from the full list
 */
export function getFeaturedModels(allModels: Model[]): Model[] {
  // Filter to featured only, maintaining the curated order
  const featured: Model[] = []

  for (const id of FEATURED_MODEL_IDS) {
    const model = allModels.find((m) => m.id === id)
    if (model) {
      featured.push(model)
    }
  }

  return featured
}

// ============================================================================
// Zustand Store
// ============================================================================

interface ModelState {
  // Selection
  selectedModelId: string
  setSelectedModel: (modelId: string) => void

  // Local favorites (persisted)
  favorites: Set<string>
  addFavorite: (modelId: string) => void
  removeFavorite: (modelId: string) => void
  toggleFavorite: (modelId: string) => boolean // Returns new state
  isFavorite: (modelId: string) => boolean
}

export const useModelStore = create<ModelState>()(
  devtools(
    persist(
      (set, get) => ({
        // Default to Claude 3.5 Sonnet
        selectedModelId: 'anthropic/claude-3.5-sonnet',

        setSelectedModel: (modelId) =>
          set({ selectedModelId: modelId }, false, 'model/setSelectedModel'),

        // Local favorites
        favorites: new Set<string>(),

        addFavorite: (modelId) =>
          set(
            (state) => ({
              favorites: new Set([...state.favorites, modelId]),
            }),
            false,
            'model/addFavorite',
          ),

        removeFavorite: (modelId) =>
          set(
            (state) => {
              const newFavorites = new Set(state.favorites)
              newFavorites.delete(modelId)
              return { favorites: newFavorites }
            },
            false,
            'model/removeFavorite',
          ),

        toggleFavorite: (modelId) => {
          const isFav = get().favorites.has(modelId)
          if (isFav) {
            get().removeFavorite(modelId)
          } else {
            get().addFavorite(modelId)
          }
          return !isFav
        },

        isFavorite: (modelId) => get().favorites.has(modelId),
      }),
      {
        name: 'model-store',
        // Custom serialization for Set
        partialize: (state) => ({
          selectedModelId: state.selectedModelId,
          favorites: Array.from(state.favorites),
        }),
        // Custom deserialization for Set
        merge: (persisted, current) => {
          const persistedData = persisted as {
            selectedModelId?: string
            favorites?: string[]
          }
          return {
            ...current,
            selectedModelId:
              persistedData?.selectedModelId ?? current.selectedModelId,
            favorites: new Set(persistedData?.favorites ?? []),
          }
        },
      },
    ),
    { name: 'model-store' },
  ),
)

// ============================================================================
// React Hooks
// ============================================================================

import { useState, useEffect } from 'react'

/**
 * Hook to fetch and use OpenRouter models with caching
 * Returns featured models by default, full list when searching
 */
export function useOpenRouterModels() {
  const [allModels, setAllModels] = useState<Model[]>(fallbackModels)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const models = await fetchOpenRouterModels()
        if (!cancelled) {
          setAllModels(models)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e : new Error('Failed to fetch models'))
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  // Compute featured models
  const featuredModels = getFeaturedModels(allModels)

  return {
    allModels,
    featuredModels,
    isLoading,
    error,
  }
}

/**
 * Get the currently selected model from the fallback list
 * Used for display when full model data isn't needed
 */
export function useSelectedModelFallback(): Model {
  const selectedModelId = useModelStore((s) => s.selectedModelId)
  return getModelById(selectedModelId) ?? fallbackModels[0]
}
