"use client"

import * as React from "react"
import { Check, ChevronDown, Sparkles } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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
}

type ModelSelectorProps = {
	options: ModelSelectorOption[]
	value?: string | null
	onChange?: (value: string) => void
	disabled?: boolean
	loading?: boolean
}

function formatPricing(pricing: NonNullable<ModelSelectorOption["pricing"]>) {
	const format = (cost: number | null) => {
		if (cost == null) return "–"
		return `$${cost.toFixed(3)}`
	}
	return `In: ${format(pricing.prompt)} · Out: ${format(pricing.completion)} per 1M tokens`
}

const getInitial = (label: string) => {
	const trimmed = label.trim()
	return trimmed.length > 0 ? trimmed[0]!.toUpperCase() : "?"
}

function OptionGlyph({ option }: { option: ModelSelectorOption | null }) {
	if (!option) {
		return <Sparkles className="size-4" />
	}
	const Icon = option.icon
	if (Icon) {
		return <Icon className="size-4" />
	}
	return (
		<span className="text-foreground/80 text-[11px] font-semibold uppercase leading-none">
			{getInitial(option.label)}
		</span>
	)
}

export function ModelSelector({ options, value, onChange, disabled, loading }: ModelSelectorProps) {
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

	const triggerLabel = React.useMemo(() => {
		if (selectedOption) return selectedOption.label
		if (loading) return "Loading models..."
		return "Select model"
	}, [loading, selectedOption])

	const triggerTitle = React.useMemo(() => {
		if (!selectedOption) return undefined
		const parts: string[] = []
		if (selectedOption.description) parts.push(selectedOption.description)
		if (selectedOption.context) parts.push(`Context: ${Intl.NumberFormat().format(selectedOption.context)} tokens`)
		if (selectedOption.pricing) parts.push(formatPricing(selectedOption.pricing))
		return parts.length > 0 ? parts.join(" • ") : undefined
	}, [selectedOption])

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					disabled={disabled || loading || options.length === 0}
					role="combobox"
					aria-expanded={open}
					title={triggerTitle}
					className="flex h-10 min-w-[220px] max-w-[360px] items-center justify-between gap-2 rounded-xl bg-background/90 px-3 text-left text-foreground"
				>
					<span className="flex min-w-0 items-center gap-2">
						<span className="bg-muted text-muted-foreground/90 flex size-8 items-center justify-center rounded-lg">
							<OptionGlyph option={selectedOption} />
						</span>
						<span className="text-sm font-medium leading-tight text-left whitespace-normal">{triggerLabel}</span>
					</span>
					<ChevronDown className={cn("size-4 transition-transform", open ? "rotate-180" : "rotate-0", disabled ? "opacity-40" : "opacity-60")} />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[320px] max-w-[90vw] border-none bg-popover/95 p-0 shadow-xl">
				<Command className="border-none bg-transparent shadow-none">
					<CommandInput placeholder="Search models" className="h-9 px-3 text-sm" />
					<CommandList className="max-h-60 overflow-y-auto">
						<CommandEmpty className="py-6 text-sm text-muted-foreground">
							{loading ? "Loading models..." : "No models found."}
						</CommandEmpty>
						<CommandGroup className="flex flex-col gap-1 p-2">
							{options.map((option) => {
								const isSelected = option.value === selectedValue
								return (
									<CommandItem
										key={option.value}
										value={option.value}
										onSelect={(currentValue) => {
											if (value === undefined) {
												setInternalValue(currentValue)
											}
											onChange?.(currentValue)
											setOpen(false)
										}}
										className={cn(
											"flex items-center justify-between gap-2 rounded-lg px-3 py-2",
											"data-[selected=true]:bg-primary/10 data-[selected=true]:text-foreground",
										)}
									>
									<span className="flex min-w-0 items-start gap-2">
										<span className="bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-lg">
											<OptionGlyph option={option} />
										</span>
										<span className="flex min-w-0 flex-col gap-0.5">
											<span className="text-sm font-medium leading-tight text-left whitespace-normal">
												{option.label}
											</span>
											{option.description ? (
												<span className="text-muted-foreground text-[11px] leading-tight text-left whitespace-normal">
													{option.description}
												</span>
											) : null}
											{option.pricing ? (
												<span className="text-muted-foreground text-[11px] leading-tight">
													{formatPricing(option.pricing)}
												</span>
											) : null}
											{option.context ? (
												<span className="text-muted-foreground text-[11px] leading-tight">
													Context: {Intl.NumberFormat().format(option.context)} tokens
												</span>
											) : null}
										</span>
									</span>
											<Check className={cn("size-4", isSelected ? "opacity-100" : "opacity-0")}
												aria-hidden={!isSelected}
											/>
										</CommandItem>
								)
								})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	)
}
