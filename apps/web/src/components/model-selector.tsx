import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Model } from "@/stores/model";
import { cn } from "@/lib/utils";
import { useModels, useModelStore, getModelById } from "@/stores/model";
import { fuzzyMatch } from "@/lib/fuzzy-search";
import { SearchIcon, ChevronDownIcon, CheckIcon } from "@/components/icons";

function ProviderLogo({ providerId, className }: { providerId: string; className?: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded bg-muted text-[10px] font-medium uppercase",
          className || "size-4",
        )}
      >
        {providerId.charAt(0)}
      </div>
    );
  }

  return (
    <img
      alt={`${providerId} logo`}
      className={cn("size-4 dark:invert", className)}
      height={16}
      width={16}
      src={`https://models.dev/logos/${providerId}.svg`}
      onError={() => setHasError(true)}
    />
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-3.5", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-3.75 5.25m0 0l-3.75-3.75m3.75 3.75V21m-7.5-1.25l3.75-5.25m0 0L8 10.75m3.75 3.75H3"
      />
    </svg>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("size-3.5", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function StarIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg
      className={cn("size-3.5", className)}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
      />
    </svg>
  );
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
}: {
  model: Model;
  isSelected: boolean;
  isHighlighted: boolean;
  isFavorite: boolean;
  onSelect: () => void;
  onHover: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  dataIndex: number;
}) {
  const hasVision = model.modality?.includes("image");
  const hasReasoning = model.reasoning;

  return (
    <button
      data-index={dataIndex}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        "group relative flex w-full cursor-default items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm outline-none transition-all duration-150",
        isHighlighted ? "bg-accent/80" : "hover:bg-accent/40",
      )}
    >
      <ProviderLogo providerId={model.providerId} className="size-4 shrink-0" />
      <span className={cn("flex-1 truncate font-medium", isSelected && "text-primary")}>
        {model.name}
      </span>

      <div className="flex items-center gap-1">
        {hasReasoning && (
          <span className="text-amber-500" title="Reasoning capable">
            <BrainIcon />
          </span>
        )}
        {hasVision && (
          <span className="text-sky-500" title="Vision capable">
            <EyeIcon />
          </span>
        )}
        {model.isFree && (
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-500">
            Free
          </span>
        )}

        <button
          onClick={onToggleFavorite}
          className={cn(
            "ml-0.5 rounded p-0.5 transition-colors",
            isFavorite
              ? "text-amber-400 hover:text-amber-300"
              : "text-muted-foreground/40 opacity-0 group-hover:opacity-100 hover:text-amber-400",
          )}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          <StarIcon filled={isFavorite} />
        </button>

        {isSelected && (
          <span className="ml-0.5 text-primary">
            <CheckIcon className="size-4" />
          </span>
        )}
      </div>
    </button>
  );
}

interface ModelSelectorProps {
  value: string;
  onValueChange: (modelId: string) => void;
  className?: string;
  disabled?: boolean;
}

export function ModelSelector({
  value,
  onValueChange,
  className,
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const { models, isLoading } = useModels();
  const { favorites, toggleFavorite, isFavorite } = useModelStore();

  const selectedModel = useMemo(() => getModelById(models, value), [models, value]);

  const uniqueProviders = useMemo(() => {
    const providerMap = new Map<string, { id: string; name: string; count: number }>();
    for (const model of models) {
      const existing = providerMap.get(model.providerId);
      if (existing) {
        existing.count++;
      } else {
        providerMap.set(model.providerId, {
          id: model.providerId,
          name: model.provider,
          count: 1,
        });
      }
    }
    return Array.from(providerMap.values()).sort((a, b) => b.count - a.count);
  }, [models]);

  const filteredModels = useMemo(() => {
    let result = models;

    if (showFavoritesOnly) {
      result = result.filter((m) => favorites.has(m.id));
    }

    if (selectedProvider) {
      result = result.filter((m) => m.providerId === selectedProvider);
    }

    if (query.trim()) {
      result = result.filter(
        (model) =>
          fuzzyMatch(model.name, query) ||
          fuzzyMatch(model.provider, query) ||
          fuzzyMatch(model.id, query) ||
          (model.family && fuzzyMatch(model.family, query)),
      );
    }

    return result;
  }, [models, query, selectedProvider, showFavoritesOnly, favorites]);

  const flatList = useMemo(() => {
    const popularModels = filteredModels.filter((m) => m.isPopular);
    const otherModels = filteredModels.filter((m) => !m.isPopular);
    return [...popularModels, ...otherModels];
  }, [filteredModels]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query, selectedProvider, showFavoritesOnly]);

  const handleOpen = useCallback(() => {
    if (disabled) return;
    setOpen(true);
    setQuery("");
    setHighlightedIndex(0);
    setIsClosing(false);
    setSelectedProvider(null);
    setShowFavoritesOnly(false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, [disabled]);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
      triggerRef.current?.focus();
    }, 150);
  }, []);

  const handleSelect = useCallback(
    (modelId: string) => {
      onValueChange(modelId);
      handleClose();
    },
    [onValueChange, handleClose],
  );

  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent, modelId: string) => {
      e.stopPropagation();
      toggleFavorite(modelId);
    },
    [toggleFavorite],
  );

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev < flatList.length - 1 ? prev + 1 : prev));
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          e.preventDefault();
          if (flatList[highlightedIndex]) {
            handleSelect(flatList[highlightedIndex].id);
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

  useEffect(() => {
    if (!listRef.current || !open) return;
    const selectedElement = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: "nearest" });
    }
  }, [highlightedIndex, open]);

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

  const hasFavorites = favorites.size > 0;

  return (
    <div className={cn("relative inline-block", className)}>
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
          open && "border-ring ring-ring/50 ring-[3px]",
        )}
      >
        {selectedModel ? (
          <span className="flex items-center gap-2">
            <ProviderLogo providerId={selectedModel.providerId} />
            <span className="truncate">{selectedModel.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {isLoading ? "Loading..." : "Select model..."}
          </span>
        )}
        <ChevronDownIcon />
      </button>

      {open && (
        <div
          ref={contentRef}
          className={cn(
            "absolute left-0 top-full z-50 mt-1.5 flex h-[420px] w-[400px] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl",
            isClosing
              ? "animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150"
              : "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200",
          )}
          role="listbox"
          aria-label="Models"
        >
          <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-muted/30 py-2">
            <button
              onClick={() => {
                setShowFavoritesOnly(!showFavoritesOnly);
                setSelectedProvider(null);
              }}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-all duration-150",
                showFavoritesOnly
                  ? "bg-amber-500/20 text-amber-400"
                  : hasFavorites
                    ? "text-muted-foreground hover:bg-accent hover:text-foreground"
                    : "cursor-not-allowed text-muted-foreground/30",
              )}
              title={hasFavorites ? "Show favorites" : "No favorites yet"}
              disabled={!hasFavorites}
            >
              <StarIcon filled={showFavoritesOnly} className="size-4" />
            </button>

            <div className="my-1 h-px w-6 bg-border" />

            <div className="flex flex-1 flex-col gap-1 overflow-y-auto">
              {uniqueProviders.slice(0, 15).map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => {
                    setSelectedProvider(selectedProvider === provider.id ? null : provider.id);
                    setShowFavoritesOnly(false);
                  }}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg transition-all duration-150",
                    selectedProvider === provider.id
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                  )}
                  title={provider.name}
                >
                  <ProviderLogo providerId={provider.id} className="size-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <SearchIcon className="size-4 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  showFavoritesOnly
                    ? "Search favorites..."
                    : selectedProvider
                      ? `Search ${uniqueProviders.find((p) => p.id === selectedProvider)?.name || "provider"}...`
                      : "Search models..."
                }
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {(selectedProvider || showFavoritesOnly || query) && (
                <button
                  onClick={() => {
                    setSelectedProvider(null);
                    setShowFavoritesOnly(false);
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  title="Clear filters"
                >
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain p-1.5">
              {isLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading models...
                </div>
              ) : flatList.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>No models found</span>
                  {(selectedProvider || showFavoritesOnly) && (
                    <button
                      onClick={() => {
                        setSelectedProvider(null);
                        setShowFavoritesOnly(false);
                        setQuery("");
                      }}
                      className="text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                flatList.map((model, index) => (
                  <ModelItem
                    key={model.id}
                    model={model}
                    isSelected={model.id === value}
                    isHighlighted={index === highlightedIndex}
                    isFavorite={isFavorite(model.id)}
                    onSelect={() => handleSelect(model.id)}
                    onHover={() => setHighlightedIndex(index)}
                    onToggleFavorite={(e) => handleToggleFavorite(e, model.id)}
                    dataIndex={index}
                  />
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-muted/30 px-3 py-1.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
                  ↑↓
                </kbd>
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
                  ↵
                </kbd>
              </div>
              <span className="text-xs text-muted-foreground">
                {flatList.length} model{flatList.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ConnectedModelSelector({
  className,
  disabled,
}: {
  className?: string;
  disabled?: boolean;
}) {
  const selectedModelId = useModelStore((state) => state.selectedModelId);
  const setSelectedModel = useModelStore((state) => state.setSelectedModel);

  return (
    <ModelSelector
      value={selectedModelId}
      onValueChange={setSelectedModel}
      className={className}
      disabled={disabled}
    />
  );
}
