/**
 * Model Selector V2 - Dynamic model picker with Convex data
 *
 * Features:
 * - Dynamic models from OpenRouter API (via Convex)
 * - Favorites system with star toggle
 * - Search across all 200+ models
 * - Featured models shown by default
 * - Provider grouping with visual badges
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-client";
import {
  useModelStore,
  fallbackModels,
  providerOrder,
  type AIModel,
} from "@/stores/model";

// ============================================================================
// Constants
// ============================================================================

// Provider color mapping for visual distinction
const providerColors: Record<string, string> = {
  anthropic: "bg-orange-500",
  openai: "bg-emerald-500",
  google: "bg-blue-500",
  deepseek: "bg-violet-500",
  "meta-llama": "bg-sky-500",
  "x-ai": "bg-red-500",
  mistralai: "bg-cyan-500",
};

// Provider display names
const providerDisplayNames: Record<string, string> = {
  anthropic: "Anthropic",
  openai: "OpenAI",
  google: "Google",
  deepseek: "DeepSeek",
  "meta-llama": "Meta",
  "x-ai": "xAI",
  mistralai: "Mistral",
};

// ============================================================================
// Icons
// ============================================================================

const ChevronDownIcon = () => (
  <svg
    className="size-4 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  </svg>
);

const SearchIcon = () => (
  <svg
    className="size-4 text-muted-foreground"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg
    className={cn(
      "size-4 transition-colors",
      filled ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
    )}
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    />
  </svg>
);

// ============================================================================
// Helper Components
// ============================================================================

function ProviderBadge({ provider }: { provider: string }) {
  const initial = providerDisplayNames[provider]?.[0] || provider[0]?.toUpperCase() || "?";
  return (
    <span
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white",
        providerColors[provider] || "bg-gray-500"
      )}
    >
      {initial}
    </span>
  );
}

function FeatureBadge({ feature }: { feature: string }) {
  const badges: Record<string, { label: string; className: string }> = {
    reasoning: { label: "Reasoning", className: "bg-purple-500/10 text-purple-500" },
    vision: { label: "Vision", className: "bg-blue-500/10 text-blue-500" },
    tools: { label: "Tools", className: "bg-green-500/10 text-green-500" },
  };

  const badge = badges[feature];
  if (!badge) return null;

  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        badge.className
      )}
    >
      {badge.label}
    </span>
  );
}

interface ModelItemProps {
  model: AIModel | { openRouterId: string; name: string; provider: string; supportedFeatures?: string[]; isFavorite?: boolean };
  isSelected: boolean;
  isHighlighted: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onHover: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  dataIndex: number;
}

function ModelItem({
  model,
  isSelected,
  isHighlighted,
  isFavorite,
  onSelect,
  onHover,
  onToggleFavorite,
  dataIndex,
}: ModelItemProps) {
  const features = "supportedFeatures" in model ? model.supportedFeatures : [];

  return (
    <button
      data-index={dataIndex}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "relative flex w-full cursor-default items-center gap-2.5 rounded-xl py-2 pl-3 pr-8 text-left text-sm outline-none transition-colors",
        isHighlighted
          ? "bg-accent text-accent-foreground"
          : "bg-transparent text-foreground"
      )}
    >
      <ProviderBadge provider={model.provider} />
      <span className="flex-1 truncate">{model.name}</span>

      {/* Feature badges */}
      <div className="flex items-center gap-1">
        {features?.includes("reasoning") && <FeatureBadge feature="reasoning" />}
        {features?.includes("vision") && <FeatureBadge feature="vision" />}
      </div>

      {/* Favorite button */}
      <button
        onClick={onToggleFavorite}
        className="absolute right-8 p-0.5 hover:scale-110 transition-transform"
        aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <StarIcon filled={isFavorite} />
      </button>

      {isSelected && (
        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-primary">
          <CheckIcon />
        </span>
      )}
    </button>
  );
}

// ============================================================================
// Main Component
// ============================================================================

interface ModelSelectorV2Props {
  className?: string;
  disabled?: boolean;
}

export function ModelSelectorV2({
  className,
  disabled = false,
}: ModelSelectorV2Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Store state
  const {
    selectedModelId,
    setSelectedModel,
    optimisticFavorites,
    toggleOptimisticFavorite,
  } = useModelStore();

  // Get Convex user ID
  const convexUser = useQuery(
    api.users.getByExternalId,
    user?.id ? { externalId: user.id } : "skip"
  );

  // Fetch featured models (default view)
  const featuredModels = useQuery(
    api.models.listFeatured,
    convexUser?._id ? { userId: convexUser._id } : {}
  );

  // Search models (only when searching)
  const searchResults = useQuery(
    api.models.search,
    query.length >= 2 && convexUser?._id
      ? { query, userId: convexUser._id, includeLegacy: query.length >= 4 }
      : "skip"
  );

  // Favorite mutations
  const addFavorite = useMutation(api.models.addFavorite);
  const removeFavorite = useMutation(api.models.removeFavorite);

  // Determine which models to show
  const displayModels = useMemo(() => {
    // If searching and have results, use search results
    if (query.length >= 2 && searchResults) {
      return searchResults;
    }

    // If have featured models from Convex, use those
    if (featuredModels && featuredModels.length > 0) {
      return featuredModels;
    }

    // Fallback to static list
    return fallbackModels.map((m) => ({
      _id: m.id,
      openRouterId: m.id,
      name: m.name,
      provider: m.id.split("/")[0],
      contextLength: 128000,
      inputModalities: ["text"],
      outputModalities: ["text"],
      supportedFeatures: [] as string[],
      isFeatured: true,
      isLegacy: false,
      lastSyncedAt: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isFavorite: false,
    }));
  }, [query, searchResults, featuredModels]);

  // Merge with optimistic favorites
  const modelsWithFavorites = useMemo(() => {
    return displayModels.map((m) => ({
      ...m,
      isFavorite: optimisticFavorites.has(m.openRouterId) || m.isFavorite || false,
    }));
  }, [displayModels, optimisticFavorites]);

  // Group models: favorites first, then by provider
  const groupedModels = useMemo(() => {
    const favorites = modelsWithFavorites.filter((m) => m.isFavorite);
    const nonFavorites = modelsWithFavorites.filter((m) => !m.isFavorite);

    // Group non-favorites by provider
    const byProvider: Record<string, typeof modelsWithFavorites> = {};
    for (const model of nonFavorites) {
      const provider = model.provider;
      if (!byProvider[provider]) {
        byProvider[provider] = [];
      }
      byProvider[provider].push(model);
    }

    return { favorites, byProvider };
  }, [modelsWithFavorites]);

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const result: typeof modelsWithFavorites = [];

    // Add favorites first
    result.push(...groupedModels.favorites);

    // Add by provider in order
    for (const provider of Object.keys(groupedModels.byProvider).sort()) {
      result.push(...groupedModels.byProvider[provider]);
    }

    return result;
  }, [groupedModels]);

  // Get selected model for display
  const selectedModel = useMemo(() => {
    const found = modelsWithFavorites.find((m) => m.openRouterId === selectedModelId);
    if (found) return found;

    // Fallback to static list
    const fallback = fallbackModels.find((m) => m.id === selectedModelId);
    return fallback
      ? {
          openRouterId: fallback.id,
          name: fallback.name,
          provider: fallback.id.split("/")[0],
        }
      : null;
  }, [modelsWithFavorites, selectedModelId]);

  // Reset highlighted index when list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  // Handle favorite toggle
  const handleToggleFavorite = useCallback(
    async (e: React.MouseEvent, modelId: string, currentlyFavorite: boolean) => {
      e.stopPropagation();
      if (!convexUser?._id) return;

      // Optimistic update
      toggleOptimisticFavorite(modelId);

      try {
        if (currentlyFavorite) {
          await removeFavorite({ userId: convexUser._id, modelId });
        } else {
          await addFavorite({ userId: convexUser._id, modelId });
        }
      } catch (error) {
        // Revert on error
        toggleOptimisticFavorite(modelId);
        console.error("Failed to toggle favorite:", error);
      }
    },
    [convexUser?._id, toggleOptimisticFavorite, addFavorite, removeFavorite]
  );

  // Open handler
  const handleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setHighlightedIndex(0);
    setIsClosing(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [disabled]);

  // Close handler with animation
  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
      triggerRef.current?.focus();
    }, 150);
  }, []);

  // Select handler
  const handleSelect = useCallback(
    (modelId: string) => {
      setSelectedModel(modelId);
      handleClose();
    },
    [setSelectedModel, handleClose]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < flatList.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (flatList[highlightedIndex]) {
            handleSelect(flatList[highlightedIndex].openRouterId);
          }
          break;
        case "Escape":
          e.preventDefault();
          handleClose();
          break;
        case "Tab":
          e.preventDefault();
          handleClose();
          break;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, flatList, highlightedIndex, handleSelect, handleClose]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current || !open) return;
    const selectedElement = listRef.current.querySelector(
      `[data-index="${highlightedIndex}"]`
    );
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, handleClose]);

  // Track running index for data-index attributes
  let runningIndex = 0;

  return (
    <div className={cn("relative inline-block", className)}>
      {/* Trigger button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? handleClose() : handleOpen())}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select model"
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground bg-input/30 hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 gap-2 rounded-4xl border px-3 py-2 text-sm transition-colors focus-visible:ring-[3px]",
          "flex h-9 w-fit min-w-[180px] items-center justify-between whitespace-nowrap outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-ring ring-ring/50 ring-[3px]"
        )}
      >
        {selectedModel ? (
          <span className="flex items-center gap-2">
            <ProviderBadge provider={selectedModel.provider} />
            <span className="truncate">{selectedModel.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Select model...</span>
        )}
        <ChevronDownIcon />
      </button>

      {/* Dropdown content */}
      {open && (
        <div
          ref={contentRef}
          className={cn(
            "absolute left-0 top-full z-50 mt-1.5 w-[320px] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl",
            isClosing
              ? "animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150"
              : "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"
          )}
          role="listbox"
          aria-label="Models"
        >
          {/* Search input */}
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <SearchIcon />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search all models..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>

          {/* Model list */}
          <div
            ref={listRef}
            className="max-h-[400px] overflow-y-auto overscroll-contain p-1"
          >
            {flatList.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                {query.length >= 2
                  ? "No models found. Try a different search."
                  : "Loading models..."}
              </div>
            ) : (
              <>
                {/* Favorites section */}
                {groupedModels.favorites.length > 0 && (
                  <div className="py-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <StarIcon filled />
                      Favorites
                    </div>
                    {groupedModels.favorites.map((model) => {
                      const idx = runningIndex++;
                      return (
                        <ModelItem
                          key={model.openRouterId}
                          model={model}
                          isSelected={model.openRouterId === selectedModelId}
                          isHighlighted={idx === highlightedIndex}
                          isFavorite={model.isFavorite}
                          onSelect={() => handleSelect(model.openRouterId)}
                          onHover={() => setHighlightedIndex(idx)}
                          onToggleFavorite={(e) =>
                            handleToggleFavorite(e, model.openRouterId, model.isFavorite)
                          }
                          dataIndex={idx}
                        />
                      );
                    })}
                  </div>
                )}

                {/* By provider */}
                {Object.entries(groupedModels.byProvider)
                  .sort(([a], [b]) => {
                    const orderA = providerOrder.indexOf(providerDisplayNames[a] || a);
                    const orderB = providerOrder.indexOf(providerDisplayNames[b] || b);
                    return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
                  })
                  .map(([provider, models]) => (
                    <div key={provider} className="py-1">
                      <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {providerDisplayNames[provider] || provider}
                      </div>
                      {models.map((model) => {
                        const idx = runningIndex++;
                        return (
                          <ModelItem
                            key={model.openRouterId}
                            model={model}
                            isSelected={model.openRouterId === selectedModelId}
                            isHighlighted={idx === highlightedIndex}
                            isFavorite={model.isFavorite}
                            onSelect={() => handleSelect(model.openRouterId)}
                            onHover={() => setHighlightedIndex(idx)}
                            onToggleFavorite={(e) =>
                              handleToggleFavorite(e, model.openRouterId, model.isFavorite)
                            }
                            dataIndex={idx}
                          />
                        );
                      })}
                    </div>
                  ))}
              </>
            )}
          </div>

          {/* Footer with keyboard hints */}
          <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
                  ↵
                </kbd>
                <span>Select</span>
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {query.length >= 2
                ? `${flatList.length} results`
                : `${flatList.length} featured`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Connected model selector - uses Convex data when available
 * Falls back to static list if Convex hasn't synced yet
 */
export function ConnectedModelSelectorV2({
  className,
  disabled,
}: {
  className?: string;
  disabled?: boolean;
}) {
  return <ModelSelectorV2 className={className} disabled={disabled} />;
}
