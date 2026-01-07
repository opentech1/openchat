import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Model } from "@/stores/model";
import { cn } from "@/lib/utils";
import { useModels, useModelStore, getModelById } from "@/stores/model";
import { fuzzyMatch } from "@/lib/fuzzy-search";
import { SearchIcon, ChevronDownIcon, CheckIcon } from "@/components/icons";

// Star icon component for favorites
function StarIcon({ filled, className }: { filled?: boolean; className?: string }) {
	return (
		<svg
			className={cn("size-4", className)}
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

// Provider logo from models.dev
function ProviderLogo({ providerId, className }: { providerId: string; className?: string }) {
	return (
		<img
			alt={`${providerId} logo`}
			className={cn("size-4 rounded-sm dark:invert", className)}
			height={16}
			width={16}
			src={`https://models.dev/logos/${providerId}.svg`}
			onError={(e) => {
				e.currentTarget.style.display = "none";
			}}
		/>
	);
}

// Default favorites for new users
const DEFAULT_FAVORITES = [
	"anthropic/claude-sonnet-4",
	"openai/gpt-4o",
	"google/gemini-2.0-flash-exp:free",
	"anthropic/claude-3.5-sonnet",
];

// Model item component - compact without descriptions
function ModelItem({
	model,
	isSelected,
	isHighlighted,
	isFavorited,
	onSelect,
	onHover,
	onToggleFavorite,
	dataIndex,
}: {
	model: Model;
	isSelected: boolean;
	isHighlighted: boolean;
	isFavorited: boolean;
	onSelect: () => void;
	onHover: () => void;
	onToggleFavorite: (e: React.MouseEvent) => void;
	dataIndex: number;
}) {
	return (
		<div
			data-index={dataIndex}
			onClick={onSelect}
			onMouseEnter={onHover}
			className={cn(
				"group relative flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
				isHighlighted
					? "bg-accent text-accent-foreground"
					: "text-foreground/90 hover:bg-accent/50",
			)}
		>
			<ProviderLogo providerId={model.providerId} className="size-4 shrink-0" />
			<span className="flex-1 truncate font-medium">{model.name}</span>

			{/* Badges */}
			{model.isFree && (
				<span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
					Free
				</span>
			)}

			{/* Favorite star - always visible on hover or if favorited */}
			<button
				onClick={onToggleFavorite}
				className={cn(
					"flex size-5 items-center justify-center rounded transition-all",
					isFavorited
						? "text-warning"
						: "text-muted-foreground/30 opacity-0 hover:text-warning/70 group-hover:opacity-100",
				)}
				aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
			>
				<StarIcon filled={isFavorited} className="size-3.5" />
			</button>

			{/* Checkmark for selected */}
			<div className="flex size-5 items-center justify-center">
				{isSelected && (
					<CheckIcon className="size-4 text-primary" />
				)}
			</div>
		</div>
	);
}

// Props for the ModelSelector component
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

	const triggerRef = useRef<HTMLButtonElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const listRef = useRef<HTMLDivElement>(null);
	const contentRef = useRef<HTMLDivElement>(null);

	// Load ALL models from OpenRouter
	const { models, isLoading } = useModels();

	// Favorites from store
	const favorites = useModelStore((state) => state.favorites);
	const toggleFavorite = useModelStore((state) => state.toggleFavorite);
	const isFavorite = useModelStore((state) => state.isFavorite);

	// Initialize default favorites on first load if empty
	useEffect(() => {
		if (favorites.size === 0 && models.length > 0) {
			DEFAULT_FAVORITES.forEach((modelId) => {
				if (models.some((m) => m.id === modelId)) {
					toggleFavorite(modelId);
				}
			});
		}
	}, [favorites.size, models, toggleFavorite]);

	const selectedModel = useMemo(() => getModelById(models, value), [models, value]);

	// Filter models based on query
	const filteredModels = useMemo(() => {
		if (!query.trim()) return models;

		return models.filter(
			(model) =>
				fuzzyMatch(model.name, query) ||
				fuzzyMatch(model.provider, query) ||
				fuzzyMatch(model.id, query) ||
				(model.family && fuzzyMatch(model.family, query)),
		);
	}, [models, query]);

	// Get favorite models from filtered results
	const favoriteModels = useMemo(() => {
		return filteredModels.filter((model) => isFavorite(model.id));
	}, [filteredModels, isFavorite]);

	// Get non-favorite models grouped by provider
	const groupedModels = useMemo(() => {
		const nonFavorites = filteredModels.filter((model) => !isFavorite(model.id));
		const grouped: Record<string, Model[]> = {};

		for (const model of nonFavorites) {
			const group = model.provider || "Other";
			if (!grouped[group]) {
				grouped[group] = [];
			}
			grouped[group].push(model);
		}

		return grouped;
	}, [filteredModels, isFavorite]);

	// Get sorted provider groups
	const sortedGroups = useMemo(() => {
		return Object.keys(groupedModels).sort((a, b) => {
			const aLen = groupedModels[a]?.length || 0;
			const bLen = groupedModels[b]?.length || 0;
			// Prioritize providers with popular models
			const aHasPopular = groupedModels[a]?.some((m) => m.isPopular);
			const bHasPopular = groupedModels[b]?.some((m) => m.isPopular);
			if (aHasPopular && !bHasPopular) return -1;
			if (!aHasPopular && bHasPopular) return 1;
			if (aLen !== bLen) return bLen - aLen;
			return a.localeCompare(b);
		});
	}, [groupedModels]);

	// Flat list for keyboard navigation: favorites first, then grouped models
	const flatList = useMemo(() => {
		const result: Model[] = [];
		result.push(...favoriteModels);
		for (const group of sortedGroups) {
			result.push(...(groupedModels[group] || []));
		}
		return result;
	}, [favoriteModels, sortedGroups, groupedModels]);

	// Reset highlighted index when filtered list changes
	useEffect(() => {
		setHighlightedIndex(0);
	}, [query]);

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
			onValueChange(modelId);
			handleClose();
		},
		[onValueChange, handleClose],
	);

	// Toggle favorite handler
	const handleToggleFavorite = useCallback(
		(e: React.MouseEvent, modelId: string) => {
			e.stopPropagation();
			toggleFavorite(modelId);
		},
		[toggleFavorite],
	);

	// Keyboard navigation
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

	// Scroll highlighted item into view
	useEffect(() => {
		if (!listRef.current || !open) return;
		const selectedElement = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
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

	// Get flat index for a model
	const getFlatIndex = useCallback(
		(modelId: string) => {
			return flatList.findIndex((m) => m.id === modelId);
		},
		[flatList],
	);

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
					"border-input data-[placeholder]:text-muted-foreground bg-input/30 hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 gap-2 rounded-full border px-3 py-2 text-sm transition-colors focus-visible:ring-[3px]",
					"flex h-9 w-fit min-w-[180px] items-center justify-between whitespace-nowrap outline-none",
					"disabled:cursor-not-allowed disabled:opacity-50",
					open && "border-ring ring-ring/50 ring-[3px]",
				)}
			>
				{selectedModel ? (
					<span className="flex items-center gap-2">
						<ProviderLogo providerId={selectedModel.providerId} />
						<span className="truncate font-medium">{selectedModel.name}</span>
					</span>
				) : (
					<span className="text-muted-foreground">
						{isLoading ? "Loading..." : "Select model..."}
					</span>
				)}
				<ChevronDownIcon
					className={cn("size-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")}
				/>
			</button>

			{/* Dropdown content */}
			{open && (
				<div
					ref={contentRef}
					className={cn(
						"absolute left-0 bottom-full z-50 mb-1.5 w-[320px] overflow-hidden rounded-xl border border-border/50 bg-popover text-popover-foreground shadow-xl shadow-black/10 dark:shadow-black/30",
						isClosing
							? "animate-out fade-out-0 zoom-out-95 slide-out-to-bottom-2 duration-150"
							: "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-150",
					)}
					role="listbox"
					aria-label="Models"
				>
					{/* Search input */}
					<div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
						<SearchIcon className="size-4 text-muted-foreground/50" />
						<input
							ref={inputRef}
							type="text"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder="Search models..."
							className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 outline-none"
							autoComplete="off"
							autoCorrect="off"
							spellCheck={false}
						/>
						{query && (
							<button
								onClick={() => setQuery("")}
								className="flex size-5 items-center justify-center rounded text-muted-foreground/50 hover:text-foreground transition-colors"
							>
								<svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							</button>
						)}
					</div>

					{/* Model list */}
					<div ref={listRef} className="max-h-[320px] overflow-y-auto overscroll-contain p-1">
						{isLoading ? (
							<div className="flex flex-col items-center justify-center gap-2 py-6 text-muted-foreground">
								<div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
								<span className="text-xs">Loading models...</span>
							</div>
						) : flatList.length === 0 ? (
							<div className="py-6 text-center text-sm text-muted-foreground">
								No models found for "{query}"
							</div>
						) : (
							<>
								{/* Favorites Section */}
								{favoriteModels.length > 0 && (
									<div className="mb-0.5">
										<div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-warning/80">
											<StarIcon filled className="size-3" />
											<span>Favorites</span>
										</div>
										{favoriteModels.map((model) => {
											const flatIndex = getFlatIndex(model.id);
											return (
												<ModelItem
													key={model.id}
													model={model}
													isSelected={model.id === value}
													isHighlighted={flatIndex === highlightedIndex}
													isFavorited={true}
													onSelect={() => handleSelect(model.id)}
													onHover={() => setHighlightedIndex(flatIndex)}
													onToggleFavorite={(e) => handleToggleFavorite(e, model.id)}
													dataIndex={flatIndex}
												/>
											);
										})}
									</div>
								)}

								{/* All Models by Provider */}
								{sortedGroups.length > 0 && (
									<div className={cn(favoriteModels.length > 0 && "border-t border-border/30 pt-1 mt-0.5")}>
										<div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
											All Models
										</div>
										{sortedGroups.map((group) => (
											<div key={group} className="mb-0.5">
												<div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium text-muted-foreground/70">
													<ProviderLogo
														providerId={groupedModels[group]?.[0]?.providerId || group.toLowerCase()}
														className="size-3 opacity-60"
													/>
													<span>{group}</span>
													<span className="text-[10px] text-muted-foreground/40">
														{groupedModels[group]?.length}
													</span>
												</div>
												{groupedModels[group]?.map((model) => {
													const flatIndex = getFlatIndex(model.id);
													return (
														<ModelItem
															key={model.id}
															model={model}
															isSelected={model.id === value}
															isHighlighted={flatIndex === highlightedIndex}
															isFavorited={isFavorite(model.id)}
															onSelect={() => handleSelect(model.id)}
															onHover={() => setHighlightedIndex(flatIndex)}
															onToggleFavorite={(e) => handleToggleFavorite(e, model.id)}
															dataIndex={flatIndex}
														/>
													);
												})}
											</div>
										))}
									</div>
								)}
							</>
						)}
					</div>

					{/* Footer with model count */}
					<div className="flex items-center justify-between border-t border-border/30 bg-muted/10 px-2.5 py-1.5">
						<div className="flex items-center gap-2 text-[10px] text-muted-foreground/50">
							<kbd className="inline-flex h-4 items-center rounded border border-border/40 bg-muted/30 px-1 font-mono text-[9px]">↑↓</kbd>
							<kbd className="inline-flex h-4 items-center rounded border border-border/40 bg-muted/30 px-1 font-mono text-[9px]">↵</kbd>
							<kbd className="inline-flex h-4 items-center rounded border border-border/40 bg-muted/30 px-1 font-mono text-[9px]">esc</kbd>
						</div>
						<span className="text-[10px] text-muted-foreground/40">
							{flatList.length} models
						</span>
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * ModelSelector with built-in Zustand store connection
 */
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
