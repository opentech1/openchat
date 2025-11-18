"use client";

import * as React from "react";
import * as Popover from "@radix-ui/react-popover";
import { toast } from "sonner";
import { Brain, Check } from "@/lib/icons";
import { cn } from "@/lib/utils";
import {
	type ReasoningConfig,
	type ReasoningEffort,
	supportsReasoningEffort,
	supportsReasoningMaxTokens,
} from "@/lib/reasoning-config";

type ReasoningControlsProps = {
	/** Current reasoning configuration */
	value: ReasoningConfig;
	/** Callback when configuration changes */
	onChange: (config: ReasoningConfig) => void;
	/** Current model ID to determine which controls to show */
	modelId: string;
	/** Model capabilities (including mandatoryReasoning flag) */
	capabilities?: {
		reasoning?: boolean;
		image?: boolean;
		audio?: boolean;
		video?: boolean;
		mandatoryReasoning?: boolean;
	};
	/** Whether the controls should be disabled */
	disabled?: boolean;
};

// Option value format: "off" | "low" | "medium" | "high" | "1024" | "2000" | etc.
type ReasoningOption = string;

const EFFORT_OPTIONS: Array<{ value: ReasoningOption; label: string; description: string }> = [
	{ value: "off", label: "Off", description: "No reasoning" },
	{ value: "medium", label: "Medium", description: "Balanced reasoning" },
	{ value: "high", label: "High", description: "Deep reasoning" },
];

const TOKEN_OPTIONS: Array<{ value: ReasoningOption; label: string; description: string }> = [
	{ value: "off", label: "Off", description: "No reasoning" },
	{ value: "4000", label: "4K", description: "Moderate reasoning" },
	{ value: "16000", label: "16K", description: "Deep reasoning" },
];

const STORAGE_KEY = "reasoning-toast-shown";

export function ReasoningControls({
	value,
	onChange,
	modelId,
	capabilities,
	disabled = false,
}: ReasoningControlsProps) {
	const [open, setOpen] = React.useState(false);
	const supportsEffort = supportsReasoningEffort(modelId);

	const options = supportsEffort ? EFFORT_OPTIONS : TOKEN_OPTIONS;

	// Check if we've shown the toast for this model in this session
	const hasShownToast = React.useCallback((model: string): boolean => {
		if (typeof window === "undefined") return false;
		try {
			const shown = sessionStorage.getItem(STORAGE_KEY);
			if (!shown) return false;
			const shownModels = JSON.parse(shown) as string[];
			return shownModels.includes(model);
		} catch {
			return false;
		}
	}, []);

	// Mark that we've shown the toast for this model
	const markToastShown = React.useCallback((model: string) => {
		if (typeof window === "undefined") return;
		try {
			const shown = sessionStorage.getItem(STORAGE_KEY);
			const shownModels = shown ? (JSON.parse(shown) as string[]) : [];
			if (!shownModels.includes(model)) {
				shownModels.push(model);
				sessionStorage.setItem(STORAGE_KEY, JSON.stringify(shownModels));
			}
		} catch {
			// Ignore storage errors
		}
	}, []);

	// AUTO-ENABLE: If model has mandatory reasoning but reasoning is off, auto-enable it
	React.useEffect(() => {
		// Only check if model has mandatory reasoning and reasoning is currently disabled
		// AND we haven't already shown the toast for this model in this session
		if (
			capabilities?.mandatoryReasoning === true &&
			value.enabled === false &&
			!hasShownToast(modelId)
		) {
			markToastShown(modelId);

			toast.warning("This model always uses reasoning", {
				description: "Auto-enabled reasoning. This model has built-in reasoning that cannot be disabled.",
			});

			// Auto-enable with default settings
			const newConfig = supportsEffort
				? { enabled: true as const, effort: "medium" as const }
				: { enabled: true as const, max_tokens: 4000 };

			console.log("Auto-enabling reasoning for mandatory model:", modelId, newConfig);
			onChange(newConfig);
		}
	}, [modelId, capabilities?.mandatoryReasoning, value.enabled, supportsEffort, onChange, hasShownToast, markToastShown]);

	// Get current value as option string
	const currentOption = React.useMemo(() => {
		if (!value.enabled) return "off";
		if (value.effort) return value.effort;
		if (value.max_tokens) return String(value.max_tokens);
		return supportsEffort ? "medium" : "2000";
	}, [value, supportsEffort]);

	// Get current label for display
	const currentLabel = React.useMemo(() => {
		const option = options.find(opt => opt.value === currentOption);
		return option ? option.label : "Off";
	}, [currentOption, options]);

	// Handle selection change
	const handleSelect = React.useCallback(
		(optionValue: string) => {
			if (optionValue === "off") {
				// DYNAMIC: Check if this model has mandatory reasoning (from OpenRouter API data)
				if (capabilities?.mandatoryReasoning === true) {
					toast.warning("This model always uses reasoning", {
						description: "Setting to Medium instead. This model has built-in reasoning that cannot be disabled.",
					});

					// Reset to medium effort (or 4000 tokens for max_tokens models)
					if (supportsReasoningEffort(modelId)) {
						onChange({
							enabled: true,
							effort: "medium",
						});
					} else {
						onChange({
							enabled: true,
							max_tokens: 4000,
						});
					}
					setOpen(false);
					return;
				}

				// Normal models: disable reasoning
				onChange({ enabled: false });
				setOpen(false);
				return;
			}

			// Check if it's an effort level
			if (["medium", "high"].includes(optionValue)) {
				onChange({
					enabled: true,
					effort: optionValue as ReasoningEffort,
				});
				setOpen(false);
				return;
			}

			// Otherwise it's a token count
			const tokens = Number(optionValue);
			if (!isNaN(tokens)) {
				onChange({
					enabled: true,
					max_tokens: tokens,
				});
				setOpen(false);
			}
		},
		[modelId, onChange, capabilities]
	);

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Trigger asChild>
				<button
					type="button"
					disabled={disabled}
					className={cn(
						"inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium",
						"hover:bg-accent hover:text-accent-foreground",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
						"disabled:cursor-not-allowed disabled:opacity-50",
						"transition-colors",
						currentOption !== "off" && "border-purple-500/50 bg-purple-500/5"
					)}
					aria-label="Select reasoning level"
				>
					<Brain
						className={cn(
							"size-4 shrink-0",
							currentOption !== "off" ? "text-purple-500" : "text-muted-foreground"
						)}
					/>
					<span>{currentLabel}</span>
					<svg
						className="size-4 text-muted-foreground ml-1"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
					</svg>
				</button>
			</Popover.Trigger>

			<Popover.Portal>
				<Popover.Content
					align="start"
					sideOffset={4}
					className={cn(
						"z-50 min-w-[200px] overflow-hidden rounded-md border border-border bg-popover p-1 shadow-md",
						"data-[state=open]:animate-in data-[state=closed]:animate-out",
						"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
						"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
						"data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
					)}
				>
					<div className="space-y-0.5">
						{options.map((option) => {
							const isSelected = option.value === currentOption;
							return (
								<button
									key={option.value}
									type="button"
									onClick={() => handleSelect(option.value)}
									className={cn(
										"relative flex w-full cursor-pointer items-center rounded-sm px-3 py-2 text-sm outline-none transition-colors",
										"hover:bg-accent hover:text-accent-foreground",
										"focus:bg-accent focus:text-accent-foreground",
										isSelected && "bg-accent/50"
									)}
								>
									<div className="flex flex-1 flex-col items-start gap-0.5">
										<span className="font-medium">{option.label}</span>
										<span className="text-xs text-muted-foreground">{option.description}</span>
									</div>
									{isSelected && (
										<Check className="size-4 shrink-0 ml-2" />
									)}
								</button>
							);
						})}
					</div>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
