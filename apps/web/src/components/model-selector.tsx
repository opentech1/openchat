"use client"

import * as React from "react"
import { Check, Info, Brain, Image, Mic, Video } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
	ModelSelector as AIModelSelector,
	ModelSelectorTrigger,
	ModelSelectorContent,
	ModelSelectorInput,
	ModelSelectorList,
	ModelSelectorEmpty,
	ModelSelectorGroup,
	ModelSelectorItem,
	ModelSelectorName,
	ModelSelectorLogo,
} from "@/components/ai-elements/model-selector"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip"
import { registerClientProperties } from "@/lib/posthog"

export type ModelSelectorOption = {
	value: string
	label: string
	description?: string
	context?: number | null
	pricing?: {
		prompt: number | null
		completion: number | null
	}
	icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
	popular?: boolean
	free?: boolean
	capabilities?: {
		reasoning?: boolean
		image?: boolean
		audio?: boolean
		video?: boolean
	}
}

// Format price per million tokens
function formatPrice(price: number | null): string {
	if (price === null || price === undefined || !Number.isFinite(price)) return "Free"
	// Handle -1 or negative values (used for variable/dynamic pricing like Auto Router)
	if (price < 0) return "Variable"
	const perMillion = price * 1_000_000
	if (perMillion === 0) return "Free"
	if (perMillion < 0.01) return `$${perMillion.toFixed(4)}`
	if (perMillion < 1) return `$${perMillion.toFixed(2)}`
	return `$${perMillion.toFixed(0)}`
}

// Get price tier based on combined input+output cost (0=green, 1=yellow, 2=red)
function getPriceTier(pricing: NonNullable<ModelSelectorOption["pricing"]>): number {
	const input = pricing.prompt ?? 0
	const output = pricing.completion ?? 0
	const avgCost = ((input + output) / 2) * 1_000_000

	if (avgCost === 0) return 0 // Free - green
	if (avgCost < 1) return 0 // Very cheap - green
	if (avgCost < 5) return 1 // Medium - yellow
	return 2 // Expensive - red
}

// Price indicator component with 3 bars
function PriceIndicator({ tier }: { tier: number }) {
	const colors = ["bg-green-500", "bg-yellow-500", "bg-red-500"]
	const bgColors = ["bg-green-500/20", "bg-yellow-500/20", "bg-red-500/20"]

	return (
		<div className="flex items-center gap-0.5">
			{[0, 1, 2].map((i) => (
				<div
					key={i}
					className={cn(
						"h-2 w-1 rounded-full",
						i <= tier ? colors[tier] : bgColors[tier]
					)}
				/>
			))}
		</div>
	)
}

type ModelSelectorProps = {
	options: ModelSelectorOption[]
	value?: string | null
	onChange?: (value: string) => void
	disabled?: boolean
	loading?: boolean
}

// Extract provider from model ID (e.g. "openai/gpt-4" -> "openai")
// Also handle special cases and normalize provider names for models.dev logos
function getProviderFromModelId(modelId: string): string | null {
	const parts = modelId.split("/")
	if (parts.length < 2) return null

	const provider = parts[0]!

	// Normalize provider names to match models.dev logo slugs
	const providerMap: Record<string, string> = {
		"xai": "xai",
		"x-ai": "xai",
		"openai": "openai",
		"anthropic": "anthropic",
		"google": "google",
		"deepseek": "deepseek",
		"meta-llama": "llama",
		"mistralai": "mistral",
		"openrouter": "openrouter",
		"perplexity": "perplexity",
		"cohere": "cohere",
		"01-ai": "01-ai",
		"qwen": "alibaba",
		"z-ai": "zhipuai",
		"nvidia": "nvidia",
		"microsoft": "azure",
		"amazon": "amazon-bedrock",
	}

	return providerMap[provider] || provider
}

// Major providers to show in the list
const MAJOR_PROVIDERS = new Set([
	"openai",
	"anthropic",
	"google",
	"xai",
	"x-ai",
	"deepseek",
	"mistral",
	"mistralai",
	"meta-llama",
	"openrouter",
	"qwen",
	"z-ai",
]);

// Group models with Popular and Free sections first, only showing major providers
function groupModels(options: ModelSelectorOption[]) {
	const groups: Array<[string, ModelSelectorOption[]]> = []

	// Popular models section
	const popularModels = options.filter(opt => opt.popular)
	if (popularModels.length > 0) {
		groups.push(["Popular", popularModels])
	}

	// Free models section - include all free models, even if they're also popular
	const freeModels = options.filter(opt => opt.free)
	if (freeModels.length > 0) {
		groups.push(["Free Models", freeModels])
	}

	// Regular provider groups - only major providers
	const regularModels = options.filter(opt => !opt.popular && !opt.free)
	const grouped = new Map<string, ModelSelectorOption[]>()

	for (const option of regularModels) {
		const parts = option.value.split("/")
		const provider = parts.length > 1 ? parts[0]! : "Other"

		// Only include major providers
		if (!MAJOR_PROVIDERS.has(provider)) {
			continue
		}

		if (!grouped.has(provider)) {
			grouped.set(provider, [])
		}
		grouped.get(provider)!.push(option)
	}

	groups.push(...Array.from(grouped.entries()))
	return groups
}

// Map provider slugs to display names
const providerNames: Record<string, string> = {
	"openai": "OpenAI",
	"anthropic": "Anthropic",
	"google": "Google",
	"meta-llama": "Meta",
	"mistralai": "Mistral AI",
	"deepseek": "DeepSeek",
	"perplexity": "Perplexity",
	"xai": "xAI",
	"x-ai": "xAI",
	"cohere": "Cohere",
	"01-ai": "01.AI",
	"qwen": "Alibaba",
	"z-ai": "Z.AI",
	"nvidia": "NVIDIA",
	"microsoft": "Microsoft",
	"amazon": "Amazon",
}

function ModelSelector({ options, value, onChange, disabled, loading }: ModelSelectorProps) {
	const [open, setOpen] = React.useState(false)
	const [internalValue, setInternalValue] = React.useState(() => value ?? options[0]?.value ?? "")

	React.useEffect(() => {
		if (value !== undefined) {
			setInternalValue(value ?? "")
		}
	}, [value])

	React.useEffect(() => {
		if (value !== undefined) return
		if (options.length === 0) {
			if (internalValue) setInternalValue("")
			return
		}
		const exists = internalValue && options.some((option) => option.value === internalValue)
		if (!internalValue || !exists) {
			setInternalValue(options[0]!.value)
		}
	}, [options, value, internalValue])

	const selectedValue = value ?? internalValue
	const selectedOption = React.useMemo(() => {
		return options.find((option) => option.value === selectedValue) ?? null
	}, [options, selectedValue])

	React.useEffect(() => {
		if (!selectedValue) return
		registerClientProperties({ model_id: selectedValue })
	}, [selectedValue])

	const triggerLabel = React.useMemo(() => {
		if (selectedOption) return selectedOption.label
		if (loading) return "Loading models..."
		return "Select model"
	}, [loading, selectedOption])

	// Get provider logo for selected option
	const selectedProvider = selectedOption ? getProviderFromModelId(selectedOption.value) : null

	// Group options with Popular and Free sections first
	const groupedOptions = React.useMemo(() => groupModels(options), [options])

	return (
		<AIModelSelector open={open} onOpenChange={setOpen}>
			<ModelSelectorTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled || loading || options.length === 0}
					className="w-[200px] justify-between"
				>
					{selectedProvider && (
						<ModelSelectorLogo provider={selectedProvider} className="size-4" />
					)}
					{selectedOption && (
						<ModelSelectorName>{triggerLabel}</ModelSelectorName>
					)}
					<Check className="ml-2 size-4 shrink-0 opacity-50" />
				</Button>
			</ModelSelectorTrigger>
			<ModelSelectorContent>
				<ModelSelectorInput placeholder="Search models..." />
				<ModelSelectorList>
					<ModelSelectorEmpty>
						{loading ? "Loading models..." : "No models found."}
					</ModelSelectorEmpty>
					{groupedOptions.map(([groupName, groupModels]) => (
						<ModelSelectorGroup
							key={groupName}
							heading={groupName === "Popular" || groupName === "Free Models" ? groupName : (providerNames[groupName] || groupName)}
						>
							{groupModels.map((option) => {
								const isSelected = option.value === selectedValue
								const provider = getProviderFromModelId(option.value)
								const hasPricing = option.pricing && (option.pricing.prompt !== null || option.pricing.completion !== null)
								const priceTier = hasPricing ? getPriceTier(option.pricing!) : 0

								// Check if model is free (both input and output are 0)
								const isFreeModel = hasPricing &&
									((option.pricing!.prompt ?? 0) === 0 && (option.pricing!.completion ?? 0) === 0)

								return (
									<ModelSelectorItem
										key={option.value}
										value={option.value}
										keywords={[option.label, option.value, provider || ""]}
										onSelect={(currentValue) => {
											if (value === undefined) {
												setInternalValue(currentValue)
											}
											onChange?.(currentValue)
											setOpen(false)
										}}
										className="flex items-center gap-2"
									>
										{provider && <ModelSelectorLogo provider={provider} className="size-4 shrink-0" />}
										<ModelSelectorName className="flex-1 min-w-0">{option.label}</ModelSelectorName>

										{/* Capabilities icons with tooltips */}
										{option.capabilities && (
											<div className="flex items-center gap-1 shrink-0">
												<TooltipProvider delayDuration={100}>
													{option.capabilities.reasoning && (
														<Tooltip>
															<TooltipTrigger asChild>
																<Brain className="size-3.5 text-purple-500" />
															</TooltipTrigger>
															<TooltipContent side="left" className="max-w-xs">
																<div className="text-xs">
																	This model supports advanced reasoning and thinking capabilities
																</div>
															</TooltipContent>
														</Tooltip>
													)}
													{option.capabilities.image && (
														<Tooltip>
															<TooltipTrigger asChild>
																<Image className="size-3.5 text-blue-500" />
															</TooltipTrigger>
															<TooltipContent side="left" className="max-w-xs">
																<div className="text-xs">
																	This model can process and understand images
																</div>
															</TooltipContent>
														</Tooltip>
													)}
													{option.capabilities.audio && (
														<Tooltip>
															<TooltipTrigger asChild>
																<Mic className="size-3.5 text-green-500" />
															</TooltipTrigger>
															<TooltipContent side="left" className="max-w-xs">
																<div className="text-xs">
																	This model can process and understand audio files
																</div>
															</TooltipContent>
														</Tooltip>
													)}
													{option.capabilities.video && (
														<Tooltip>
															<TooltipTrigger asChild>
																<Video className="size-3.5 text-red-500" />
															</TooltipTrigger>
															<TooltipContent side="left" className="max-w-xs">
																<div className="text-xs">
																	This model can process and understand video files
																</div>
															</TooltipContent>
														</Tooltip>
													)}
												</TooltipProvider>
											</div>
										)}
										{hasPricing && (
											<div className="flex items-center gap-1.5 shrink-0">
												<TooltipProvider delayDuration={100}>
													<Tooltip>
														<TooltipTrigger asChild>
															<div className="flex items-center gap-1 text-xs text-muted-foreground">
																<PriceIndicator tier={priceTier} />
																<span className="tabular-nums">
																	{isFreeModel
																		? "Free"
																		: `${formatPrice(option.pricing!.prompt)}/${formatPrice(option.pricing!.completion)}`
																	}
																</span>
															</div>
														</TooltipTrigger>
														<TooltipContent side="left" className="text-xs px-2 py-1">
															<div className="flex items-center gap-1 whitespace-nowrap">
																<span>In: {formatPrice(option.pricing!.prompt)}</span>
																<span>·</span>
																<span>Out: {formatPrice(option.pricing!.completion)}</span>
															</div>
														</TooltipContent>
													</Tooltip>
												</TooltipProvider>
											</div>
										)}
										{isSelected && (
											<Check className="size-4 shrink-0" />
										)}
									</ModelSelectorItem>
								)
							})}
						</ModelSelectorGroup>
					))}
					{!loading && groupedOptions.length > 0 && (
						<div className="px-2 py-4 text-center text-xs text-muted-foreground">
							Can't find your model? Search above...
						</div>
					)}
				</ModelSelectorList>
			</ModelSelectorContent>
		</AIModelSelector>
	)
}

ModelSelector.displayName = "ModelSelector";

export const MemoizedModelSelector = React.memo(ModelSelector);
export { MemoizedModelSelector as ModelSelector };
