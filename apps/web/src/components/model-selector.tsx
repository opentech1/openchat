/**
 * Model Selector - Searchable model picker with provider grouping
 *
 * Dynamically loads ALL models from OpenRouter API.
 * Features fuzzy search, keyboard navigation, and provider grouping.
 * Uses models.dev for provider logos.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Model } from '@/stores/model'
import { cn } from '@/lib/utils'
import { useModels, useModelStore, getModelById } from '@/stores/model'

// Icons
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
)

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
)

const CheckIcon = () => (
  <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
)

// Fuzzy search implementation
function fuzzyMatch(text: string, query: string): boolean {
  const searchLower = query.toLowerCase()
  const textLower = text.toLowerCase()

  // Direct substring match
  if (textLower.includes(searchLower)) return true

  // Fuzzy character matching
  let searchIndex = 0
  for (
    let i = 0;
    i < textLower.length && searchIndex < searchLower.length;
    i++
  ) {
    if (textLower[i] === searchLower[searchIndex]) {
      searchIndex++
    }
  }
  return searchIndex === searchLower.length
}

// Provider logo from models.dev
function ProviderLogo({ providerId, className }: { providerId: string; className?: string }) {
  return (
    <img
      alt={`${providerId} logo`}
      className={cn('size-4 dark:invert', className)}
      height={16}
      width={16}
      src={`https://models.dev/logos/${providerId}.svg`}
      onError={(e) => {
        // Fallback to first letter if logo not found
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

// Model item component
function ModelItem({
  model,
  isSelected,
  isHighlighted,
  onSelect,
  onHover,
  dataIndex,
}: {
  model: Model
  isSelected: boolean
  isHighlighted: boolean
  onSelect: () => void
  onHover: () => void
  dataIndex: number
}) {
  return (
    <button
      data-index={dataIndex}
      onClick={onSelect}
      onMouseEnter={onHover}
      className={cn(
        'relative flex w-full cursor-default items-center gap-2.5 rounded-xl py-2 pl-3 pr-8 text-left text-sm outline-none transition-colors',
        isHighlighted
          ? 'bg-accent text-accent-foreground'
          : 'bg-transparent text-foreground',
      )}
    >
      <ProviderLogo providerId={model.providerId} />
      <span className="flex-1 truncate">{model.name}</span>
      {model.isFree && (
        <span className="text-[10px] font-medium text-green-500 uppercase">Free</span>
      )}
      {isSelected && (
        <span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center text-primary">
          <CheckIcon />
        </span>
      )}
    </button>
  )
}

// Props for the ModelSelector component
interface ModelSelectorProps {
  value: string
  onValueChange: (modelId: string) => void
  className?: string
  disabled?: boolean
}

export function ModelSelector({
  value,
  onValueChange,
  className,
  disabled = false,
}: ModelSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [isClosing, setIsClosing] = useState(false)

  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Load ALL models from OpenRouter
  const { models, isLoading } = useModels()

  const selectedModel = useMemo(() => getModelById(models, value), [models, value])

  // Filter models based on query
  const filteredModels = useMemo(() => {
    if (!query.trim()) return models

    return models.filter(
      (model) =>
        fuzzyMatch(model.name, query) ||
        fuzzyMatch(model.provider, query) ||
        fuzzyMatch(model.id, query) ||
        (model.family && fuzzyMatch(model.family, query)),
    )
  }, [models, query])

  // Separate popular and other models from filtered results
  const { filteredPopular, filteredOthers } = useMemo(() => {
    const popular: Array<Model> = []
    const others: Array<Model> = []
    for (const model of filteredModels) {
      if (model.isPopular) {
        popular.push(model)
      } else {
        others.push(model)
      }
    }
    return { filteredPopular: popular, filteredOthers: others }
  }, [filteredModels])

  // Group other models by family/prefix
  const groupedOtherModels = useMemo(() => {
    const grouped: Record<string, Array<Model>> = {}
    for (const model of filteredOthers) {
      // Group by family if available, otherwise by ID prefix
      const group = model.family || model.id.split('/')[0] || 'Other'
      const groupName = group.charAt(0).toUpperCase() + group.slice(1).replace(/-/g, ' ')
      
      if (!grouped[groupName]) {
        grouped[groupName] = []
      }
      grouped[groupName].push(model)
    }
    return grouped
  }, [filteredOthers])

  // Get visible groups sorted
  const visibleGroups = useMemo(() => {
    return Object.keys(groupedOtherModels).sort((a, b) => {
      // Put larger groups first
      const aLen = groupedOtherModels[a]?.length || 0
      const bLen = groupedOtherModels[b]?.length || 0
      if (aLen !== bLen) return bLen - aLen
      return a.localeCompare(b)
    })
  }, [groupedOtherModels])

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const result: Array<Model> = []
    result.push(...filteredPopular)
    for (const group of visibleGroups) {
      result.push(...groupedOtherModels[group])
    }
    return result
  }, [filteredPopular, visibleGroups, groupedOtherModels])

  // Reset highlighted index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0)
  }, [query])

  // Open handler
  const handleOpen = useCallback(() => {
    if (disabled) return
    setOpen(true)
    setQuery('')
    setHighlightedIndex(0)
    setIsClosing(false)
    requestAnimationFrame(() => {
      inputRef.current?.focus()
    })
  }, [disabled])

  // Close handler with animation
  const handleClose = useCallback(() => {
    setIsClosing(true)
    setTimeout(() => {
      setOpen(false)
      setIsClosing(false)
      triggerRef.current?.focus()
    }, 150)
  }, [])

  // Select handler
  const handleSelect = useCallback(
    (modelId: string) => {
      onValueChange(modelId)
      handleClose()
    },
    [onValueChange, handleClose],
  )

  // Keyboard navigation
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex((prev) =>
            prev < flatList.length - 1 ? prev + 1 : prev,
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
          break
        case 'Enter':
          e.preventDefault()
          if (flatList[highlightedIndex]) {
            handleSelect(flatList[highlightedIndex].id)
          }
          break
        case 'Escape':
          e.preventDefault()
          handleClose()
          break
        case 'Tab':
          e.preventDefault()
          handleClose()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, flatList, highlightedIndex, handleSelect, handleClose])

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current || !open) return
    const selectedElement = listRef.current.querySelector(
      `[data-index="${highlightedIndex}"]`,
    )
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, open])

  // Close on click outside
  useEffect(() => {
    if (!open) return

    function handleClickOutside(e: MouseEvent) {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open, handleClose])

  // Get flat index for a model
  const getFlatIndex = useCallback(
    (modelId: string) => {
      return flatList.findIndex((m) => m.id === modelId)
    },
    [flatList],
  )

  return (
    <div className={cn('relative inline-block', className)}>
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
          'border-input data-[placeholder]:text-muted-foreground bg-input/30 hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 gap-2 rounded-4xl border px-3 py-2 text-sm transition-colors focus-visible:ring-[3px]',
          'flex h-9 w-fit min-w-[180px] items-center justify-between whitespace-nowrap outline-none',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-ring ring-ring/50 ring-[3px]',
        )}
      >
        {selectedModel ? (
          <span className="flex items-center gap-2">
            <ProviderLogo providerId={selectedModel.providerId} />
            <span className="truncate">{selectedModel.name}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">
            {isLoading ? 'Loading...' : 'Select model...'}
          </span>
        )}
        <ChevronDownIcon />
      </button>

      {/* Dropdown content */}
      {open && (
        <div
          ref={contentRef}
          className={cn(
            'absolute left-0 top-full z-50 mt-1.5 w-[320px] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl',
            isClosing
              ? 'animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-150'
              : 'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200',
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
              placeholder="Search models..."
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
            {isLoading ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                Loading models...
              </div>
            ) : flatList.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No models found
              </div>
            ) : (
              <>
                {/* Popular Models Section */}
                {filteredPopular.length > 0 && (
                  <>
                    <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-amber-500">
                      Popular
                    </div>
                    {filteredPopular.map((model) => {
                      const flatIndex = getFlatIndex(model.id)
                      return (
                        <ModelItem
                          key={model.id}
                          model={model}
                          isSelected={model.id === value}
                          isHighlighted={flatIndex === highlightedIndex}
                          onSelect={() => handleSelect(model.id)}
                          onHover={() => setHighlightedIndex(flatIndex)}
                          dataIndex={flatIndex}
                        />
                      )
                    })}
                  </>
                )}

                {/* All Models by Group */}
                {visibleGroups.length > 0 && (
                  <>
                    <div className={cn(
                      "px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70",
                      filteredPopular.length > 0 && "mt-2 border-t border-border pt-2"
                    )}>
                      All Models
                    </div>
                    {visibleGroups.map((group: string) => (
                      <div key={group} className="py-0.5">
                        <div className="px-3 py-1 text-xs font-medium text-muted-foreground flex items-center gap-2">
                          <ProviderLogo providerId={groupedOtherModels[group]?.[0]?.providerId || group.toLowerCase()} className="size-3" />
                          {group}
                        </div>
                        {groupedOtherModels[group].map((model: Model) => {
                          const flatIndex = getFlatIndex(model.id)
                          return (
                            <ModelItem
                              key={model.id}
                              model={model}
                              isSelected={model.id === value}
                              isHighlighted={flatIndex === highlightedIndex}
                              onSelect={() => handleSelect(model.id)}
                              onHover={() => setHighlightedIndex(flatIndex)}
                              dataIndex={flatIndex}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </>
                )}
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
              {flatList.length} model{flatList.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * ModelSelector with built-in Zustand store connection
 */
export function ConnectedModelSelector({
  className,
  disabled,
}: {
  className?: string
  disabled?: boolean
}) {
  const selectedModelId = useModelStore((state) => state.selectedModelId)
  const setSelectedModel = useModelStore((state) => state.setSelectedModel)

  return (
    <ModelSelector
      value={selectedModelId}
      onValueChange={setSelectedModel}
      className={className}
      disabled={disabled}
    />
  )
}
