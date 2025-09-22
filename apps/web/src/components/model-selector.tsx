"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

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
	pricing?: {
		prompt: number | null
		completion: number | null
	}
}

type ModelSelectorProps = {
	options: ModelSelectorOption[]
	value?: string | null
	onChange?: (value: string) => void
	disabled?: boolean
	loading?: boolean
}

function formatPricing(pricing: NonNullable<ModelSelectorOption['pricing']>) {
	const format = (cost: number | null) => {
		if (cost == null) return "–"
		return `$${cost.toFixed(3)}`
	}
	return `${format(pricing.prompt)} / ${format(pricing.completion)} per 1M tokens`
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

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled || loading || options.length === 0}
					role="combobox"
					aria-expanded={open}
					className="h-9 min-w-[180px] justify-between rounded-xl bg-background/90 px-3 text-foreground hover:text-foreground"
				>
					<span className="text-sm font-medium truncate">
						{selectedOption?.label ?? (loading ? "Loading models..." : "Select model")}
					</span>
					<ChevronsUpDown className="size-4 opacity-60" />
				</Button>
			</PopoverTrigger>
		<PopoverContent className="w-[220px] rounded-xl border border-border/60 bg-popover p-0 shadow-lg">
			<Command>
				<CommandInput placeholder="Search models" className="h-9" />
				<CommandList>
					<CommandEmpty>{loading ? "Loading models..." : "No model found."}</CommandEmpty>
					<CommandGroup
						className="max-h-64 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
					>
						{options.map((option) => {
							const isSelected = option.value === selectedValue
							return (
									<CommandItem
										key={option.value}
										value={option.value}
										onSelect={(currentValue) => {
											const next = currentValue
											if (value === undefined) {
												setInternalValue(next)
											}
											onChange?.(next)
											setOpen(false)
										}}
										className="data-[selected=true]:text-foreground"
									>
										<div className="flex w-full flex-col gap-0.5">
											<span className="text-sm font-medium leading-tight">{option.label}</span>
											{option.pricing ? (
												<span className="text-muted-foreground text-[11px]">
													{formatPricing(option.pricing)}
												</span>
											) : null}
										</div>
										<Check className={cn("ml-auto size-4", isSelected ? "opacity-100" : "opacity-0")} />
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
