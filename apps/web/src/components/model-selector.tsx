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

const models = [
	{ value: "openchat-turbo", label: "OpenChat Turbo" },
	{ value: "openchat-reasoner", label: "Reasoning Pro" },
	{ value: "openchat-creative", label: "Creative Studio" },
	{ value: "openchat-fast", label: "Flash 2.1" },
]

type ModelSelectorProps = {
	value?: string
	onChange?: (value: string) => void
	disabled?: boolean
}

export function ModelSelector({ value, onChange, disabled }: ModelSelectorProps) {
	const [open, setOpen] = React.useState(false)
	const [internalValue, setInternalValue] = React.useState(value ?? models[0]?.value ?? "")

	React.useEffect(() => {
		if (value !== undefined) {
			setInternalValue(value)
		}
	}, [value])

	const selectedValue = value ?? internalValue
	const selectedLabel = React.useMemo(() => {
		return models.find((model) => model.value === selectedValue)?.label
	}, [selectedValue])

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					disabled={disabled}
					role="combobox"
					aria-expanded={open}
					className="h-9 min-w-[180px] justify-between rounded-xl bg-background/90 px-3"
				>
					<span className="text-sm font-medium truncate">
						{selectedLabel ?? "Select model"}
					</span>
					<ChevronsUpDown className="size-4 opacity-60" />
				</Button>
			</PopoverTrigger>
				<PopoverContent className="w-[200px] rounded-xl border border-border/60 bg-popover p-0 shadow-lg">
				<Command>
					<CommandInput placeholder="Search models" className="h-9" />
					<CommandList>
						<CommandEmpty>No model found.</CommandEmpty>
						<CommandGroup>
							{models.map((model) => {
								const isSelected = model.value === selectedValue
								return (
									<CommandItem
										key={model.value}
										value={model.value}
										onSelect={(currentValue) => {
											const next = currentValue === selectedValue ? "" : currentValue
											if (value === undefined) {
												setInternalValue(next)
											}
											onChange?.(next)
											setOpen(false)
										}}
									>
										{model.label}
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
