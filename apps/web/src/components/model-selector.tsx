/**
 * Model Selector - Searchable model picker with provider grouping
 *
 * A command-style searchable dropdown for selecting AI models.
 * Features fuzzy search, keyboard navigation, and provider grouping.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  models,
  providerOrder,
  getModelById,
  useModelStore,
  type Model,
} from '@/stores/model'

// Provider color mapping for visual distinction
const providerColors: Record<string, string> = {
  OpenAI: 'bg-emerald-500',
  Anthropic: 'bg-orange-500',
  Google: 'bg-blue-500',
  DeepSeek: 'bg-violet-500',
  Meta: 'bg-sky-500',
}

// Provider initials for compact display
const providerInitials: Record<string, string> = {
  OpenAI: 'O',
  Anthropic: 'A',
  Google: 'G',
  DeepSeek: 'D',
  Meta: 'M',
}

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

// Provider badge component
function ProviderBadge({ provider }: { provider: string }) {
  return (
    <span
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold text-white',
        providerColors[provider] || 'bg-gray-500',
      )}
    >
      {providerInitials[provider] || provider[0]}
    </span>
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
      <ProviderBadge provider={model.provider} />
      <span className="flex-1 truncate">{model.name}</span>
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

  const selectedModel = getModelById(value)

  // Filter models based on query
  const filteredModels = useMemo(() => {
    if (!query.trim()) return models

    return models.filter(
      (model) =>
        fuzzyMatch(model.name, query) ||
        fuzzyMatch(model.provider, query) ||
        fuzzyMatch(model.id, query),
    )
  }, [query])

  // Group filtered models by provider
  const groupedFilteredModels = useMemo(() => {
    const groups: Record<string, Model[]> = {}
    for (const model of filteredModels) {
      if (!groups[model.provider]) {
        groups[model.provider] = []
      }
      groups[model.provider].push(model)
    }
    return groups
  }, [filteredModels])

  // Ordered providers that have models
  const visibleProviders = useMemo(
    () => providerOrder.filter((p) => groupedFilteredModels[p]?.length > 0),
    [groupedFilteredModels],
  )

  // Flat list for keyboard navigation
  const flatList = useMemo(() => {
    const result: Model[] = []
    for (const provider of visibleProviders) {
      result.push(...groupedFilteredModels[provider])
    }
    return result
  }, [visibleProviders, groupedFilteredModels])

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
    // Focus input after a short delay to ensure DOM is ready
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
            'absolute left-0 top-full z-50 mt-1.5 w-[280px] overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl',
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
            className="max-h-[300px] overflow-y-auto overscroll-contain p-1"
          >
            {flatList.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                No models found
              </div>
            ) : (
              visibleProviders.map((provider) => (
                <div key={provider} className="py-1">
                  <div className="px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {provider}
                  </div>
                  {groupedFilteredModels[provider].map((model) => {
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
              ))
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
 * Use this for a simpler API when using the global model store
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
