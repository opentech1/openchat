"use client";

import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
	type ReasoningConfig,
	supportsReasoningEffort,
} from "@/lib/reasoning-config";
import { hasMandatoryReasoning, hasReasoningCapability } from "@/lib/model-capabilities";

/**
 * Props for the ReasoningSettingsPopover component
 */
export interface ReasoningSettingsPopoverProps {
	/** Current model ID to determine which controls to show */
	modelId: string;
	/** Current reasoning configuration */
	reasoningConfig: ReasoningConfig;
	/** Callback when configuration changes */
	onReasoningConfigChange: (config: ReasoningConfig) => void;
	/** Whether the controls should be disabled */
	disabled?: boolean;
	/** The trigger element (typically ReasoningSettingsButton) */
	children: React.ReactNode;
}

/**
 * Preset levels for the reasoning effort slider
 */
type PresetLevel = "none" | "low" | "medium" | "high";

const PRESET_LABELS: PresetLevel[] = ["none", "low", "medium", "high"];

const PRESET_DISPLAY_LABELS: Record<PresetLevel, string> = {
	none: "None",
	low: "Low",
	medium: "Medium",
	high: "High",
};

/**
 * Token values for max_tokens-based models (Anthropic, Gemini, etc.)
 */
const PRESET_TOKEN_VALUES: Record<Exclude<PresetLevel, "none">, number> = {
	low: 4096,
	medium: 8192,
	high: 16384,
};

/**
 * Convert a ReasoningConfig to a preset level index (0-3)
 */
function configToSliderValue(config: ReasoningConfig, supportsEffort: boolean): number {
	if (!config.enabled) return 0; // None

	if (supportsEffort && config.effort) {
		switch (config.effort) {
			case "low":
				return 1; // Low
			case "medium":
				return 2; // Medium
			case "high":
				return 3; // High
			default:
				return 2; // Default to medium
		}
	}

	if (config.max_tokens) {
		// Map token values to slider positions
		if (config.max_tokens <= 4096) return 1; // Low
		if (config.max_tokens <= 8192) return 2; // Medium
		return 3; // High
	}

	return 2; // Default to medium
}

/**
 * Convert a slider value (0-3) to a ReasoningConfig
 */
function sliderValueToConfig(value: number, supportsEffort: boolean): ReasoningConfig {
	if (value === 0) {
		return { enabled: false };
	}

	const level = PRESET_LABELS[value] as Exclude<PresetLevel, "none">;

	if (supportsEffort) {
		// Effort-based models support: low, medium, high (and xhigh, minimal)
		return { enabled: true, effort: level };
	}

	// Max tokens-based models
	return {
		enabled: true,
		max_tokens: PRESET_TOKEN_VALUES[level],
	};
}

/**
 * ReasoningSettingsPopover
 *
 * A popover component for configuring reasoning settings.
 * Contains a preset slider (None/Low/Medium/High).
 */
export function ReasoningSettingsPopover({
	modelId,
	reasoningConfig,
	onReasoningConfigChange,
	disabled = false,
	children,
}: ReasoningSettingsPopoverProps) {
	const [open, setOpen] = React.useState(false);

	const supportsEffort = supportsReasoningEffort(modelId);
	const hasReasoning = hasReasoningCapability(modelId);
	const isMandatory = hasMandatoryReasoning(modelId);

	// Minimum slider value: 1 if mandatory reasoning, 0 otherwise
	const minSliderValue = isMandatory ? 1 : 0;

	// Current slider value derived from config
	const sliderValue = configToSliderValue(reasoningConfig, supportsEffort);

	// Handle slider change
	const handleSliderChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const value = parseInt(event.target.value, 10);
			const newConfig = sliderValueToConfig(value, supportsEffort);
			onReasoningConfigChange(newConfig);
		},
		[supportsEffort, onReasoningConfigChange]
	);

	// If model doesn't support reasoning, render children only (popover is a no-op)
	if (!hasReasoning) {
		return <>{children}</>;
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				{children}
			</PopoverTrigger>
			<PopoverContent
				side="top"
				align="start"
				sideOffset={8}
				className="w-72"
				onOpenAutoFocus={(e) => e.preventDefault()}
			>
				<div className="space-y-3">
					<Label htmlFor="reasoning-slider" className="text-sm font-medium">
						Reasoning effort
					</Label>

					{/* Slider */}
					<div className="pt-1">
						<input
							id="reasoning-slider"
							type="range"
							min={minSliderValue}
							max={3}
							step={1}
							value={sliderValue}
							onChange={handleSliderChange}
							disabled={disabled}
							className={cn(
								"w-full h-2 rounded-full appearance-none cursor-pointer",
								"bg-secondary",
								"[&::-webkit-slider-thumb]:appearance-none",
								"[&::-webkit-slider-thumb]:w-4",
								"[&::-webkit-slider-thumb]:h-4",
								"[&::-webkit-slider-thumb]:rounded-full",
								"[&::-webkit-slider-thumb]:bg-primary",
								"[&::-webkit-slider-thumb]:shadow-sm",
								"[&::-webkit-slider-thumb]:cursor-pointer",
								"[&::-webkit-slider-thumb]:transition-transform",
								"[&::-webkit-slider-thumb]:hover:scale-110",
								"[&::-moz-range-thumb]:w-4",
								"[&::-moz-range-thumb]:h-4",
								"[&::-moz-range-thumb]:rounded-full",
								"[&::-moz-range-thumb]:bg-primary",
								"[&::-moz-range-thumb]:border-0",
								"[&::-moz-range-thumb]:shadow-sm",
								"[&::-moz-range-thumb]:cursor-pointer",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								disabled && "opacity-50 cursor-not-allowed"
							)}
							aria-valuetext={PRESET_DISPLAY_LABELS[(PRESET_LABELS[sliderValue] ?? "medium") as PresetLevel]}
						/>

						{/* Labels below slider */}
						<div className="flex justify-between mt-1.5">
							{PRESET_LABELS.map((label, index) => {
								const isDisabled = index < minSliderValue;
								const isActive = index === sliderValue;
								return (
									<span
										key={label}
										className={cn(
											"text-xs",
											isActive
												? "text-foreground font-medium"
												: "text-muted-foreground",
											isDisabled && "opacity-40"
										)}
									>
										{PRESET_DISPLAY_LABELS[label]}
									</span>
								);
							})}
						</div>
					</div>

					{/* Mandatory reasoning note */}
					{isMandatory && (
						<p className="text-xs text-muted-foreground">
							This model requires reasoning to be enabled.
						</p>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

export default ReasoningSettingsPopover;
