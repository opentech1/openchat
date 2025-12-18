"use client";

import { memo, useMemo } from "react";
import {
	ChainOfThought,
	ChainOfThoughtHeader,
	ChainOfThoughtContent,
	ChainOfThoughtStep,
	ChainOfThoughtSearchResults,
	ChainOfThoughtSearchResult,
} from "./chain-of-thought";
import { BrainIcon, SearchIcon, ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";

export type SearchResult = {
	title: string;
	url: string;
	content: string;
	description?: string;
};

type ToolInvocationState =
	| "input-streaming"
	| "input-available"
	| "output-available"
	| "output-error";

export type ToolInvocationData = {
	toolCallId: string;
	toolName: string;
	state: ToolInvocationState;
	input?: unknown;
	output?: unknown;
	errorText?: string;
};

export type ThinkingProcessProps = {
	/** The reasoning text from the model */
	reasoningText?: string;
	/** Whether reasoning is currently streaming */
	isReasoningStreaming?: boolean;
	/** Duration of thinking in seconds (from server) */
	thinkingDuration?: number;
	/** Whether reasoning was requested but redacted by provider */
	reasoningRedacted?: boolean;
	/** Tool invocations to display */
	toolInvocations?: ToolInvocationData[];
	/** Whether the component should be open by default */
	defaultOpen?: boolean;
	/** Additional className */
	className?: string;
};

const ThinkingDots = () => (
	<span className="inline-flex gap-0.5 ml-1">
		<span className="size-1 rounded-full bg-current animate-pulse" />
		<span className="size-1 rounded-full bg-current animate-pulse [animation-delay:150ms]" />
		<span className="size-1 rounded-full bg-current animate-pulse [animation-delay:300ms]" />
	</span>
);

/**
 * Extract domain from URL for display
 */
function extractDomain(url: string): string {
	try {
		return new URL(url).hostname.replace("www.", "");
	} catch {
		return url;
	}
}

/**
 * Get the header text based on current state
 */
function getHeaderText(
	isReasoningStreaming: boolean,
	hasActiveTools: boolean,
	thinkingDuration?: number,
	reasoningRedacted?: boolean
): string {
	if (isReasoningStreaming) return "Thinking";
	if (hasActiveTools) return "Working";
	if (reasoningRedacted) return "Reasoned";
	if (thinkingDuration === undefined) return "Thought process";
	if (thinkingDuration === 0) return "Thought for <1s";
	if (thinkingDuration === 1) return "Thought for 1s";
	return `Thought for ${thinkingDuration}s`;
}

/**
 * ThinkingProcess - A unified component that displays reasoning and tool invocations
 * within a single collapsible Chain of Thought interface.
 */
export const ThinkingProcess = memo(function ThinkingProcess({
	reasoningText,
	isReasoningStreaming = false,
	thinkingDuration,
	reasoningRedacted = false,
	toolInvocations = [],
	defaultOpen = true,
	className,
}: ThinkingProcessProps) {
	// Determine if any tools are currently running
	const hasActiveTools = useMemo(
		() =>
			toolInvocations.some(
				(t) => t.state === "input-streaming" || t.state === "input-available"
			),
		[toolInvocations]
	);

	// Build steps for the chain of thought
	const steps = useMemo(() => {
		const result: Array<{
			id: string;
			type: "reasoning" | "search";
			status: "complete" | "active" | "pending";
			label: string;
			description?: string;
			query?: string;
			searchResults?: SearchResult[];
		}> = [];

		// Add reasoning step if we have reasoning content or it was redacted
		if (reasoningText || reasoningRedacted) {
			result.push({
				id: "reasoning",
				type: "reasoning",
				status: isReasoningStreaming ? "active" : "complete",
				label: isReasoningStreaming ? "Thinking..." : "Analyzed the question",
				description: reasoningRedacted
					? "Reasoning data not available from provider."
					: reasoningText,
			});
		}

		// Add tool invocation steps
		for (const tool of toolInvocations) {
			if (tool.toolName === "search") {
				const query =
					tool.input && typeof tool.input === "object"
						? (tool.input as { query?: string }).query
						: undefined;

				const outputResults =
					tool.output && typeof tool.output === "object" && "results" in tool.output
						? (tool.output as { results?: SearchResult[] }).results
						: undefined;

				let status: "complete" | "active" | "pending" = "pending";
				if (tool.state === "output-available" || tool.state === "output-error") {
					status = "complete";
				} else if (
					tool.state === "input-streaming" ||
					tool.state === "input-available"
				) {
					status = "active";
				}

				// Always include the query in the label for context
				let label = "Searching the web";
				if (query) {
					const truncatedQuery = query.length > 50 ? query.slice(0, 50) + "..." : query;
					if (status === "active") {
						label = `Searching for "${truncatedQuery}"`;
					} else if (status === "complete") {
						const count = outputResults?.length ?? 0;
						label = `Searched "${truncatedQuery}" · ${count} ${count === 1 ? "result" : "results"}`;
					}
				} else if (status === "complete") {
					const count = outputResults?.length ?? 0;
					label = `Found ${count} ${count === 1 ? "result" : "results"}`;
				}

				result.push({
					id: tool.toolCallId,
					type: "search",
					status,
					label,
					query,
					searchResults: outputResults,
				});
			}
		}

		return result;
	}, [reasoningText, reasoningRedacted, isReasoningStreaming, toolInvocations]);

	// Don't render if there's nothing to show
	if (steps.length === 0) {
		return null;
	}

	const headerText = getHeaderText(
		isReasoningStreaming,
		hasActiveTools,
		thinkingDuration,
		reasoningRedacted
	);

	const isActive = isReasoningStreaming || hasActiveTools;

	return (
		<ChainOfThought
			defaultOpen={defaultOpen}
			className={cn("mb-4", className)}
		>
			<ChainOfThoughtHeader>
				{headerText}
				{isActive && <ThinkingDots />}
			</ChainOfThoughtHeader>
			<ChainOfThoughtContent>
				{steps.map((step, index) => (
					<ChainOfThoughtStep
						key={step.id}
						icon={step.type === "reasoning" ? BrainIcon : SearchIcon}
						label={step.label}
						status={step.status}
						className={index === steps.length - 1 ? "[&>div:first-child>div]:hidden" : ""}
					>
						{/* Show full reasoning text with markdown rendering */}
						{step.type === "reasoning" && step.description && (
							<div className="text-xs text-muted-foreground/80 mt-2 leading-relaxed">
								<Streamdown>{step.description}</Streamdown>
							</div>
						)}
						{/* Show search results as badges */}
						{step.type === "search" &&
							step.status === "complete" &&
							step.searchResults &&
							step.searchResults.length > 0 && (
								<ChainOfThoughtSearchResults className="mt-2">
									{step.searchResults.slice(0, 5).map((result, idx) => (
										<a
											key={`${result.url}-${idx}`}
											href={result.url}
											target="_blank"
											rel="noopener noreferrer"
											className="no-underline"
										>
											<ChainOfThoughtSearchResult className="hover:bg-muted cursor-pointer transition-colors">
												<ExternalLinkIcon className="size-3" />
												{extractDomain(result.url)}
											</ChainOfThoughtSearchResult>
										</a>
									))}
									{step.searchResults.length > 5 && (
										<ChainOfThoughtSearchResult className="text-muted-foreground/60">
											+{step.searchResults.length - 5} more
										</ChainOfThoughtSearchResult>
									)}
								</ChainOfThoughtSearchResults>
							)}
					</ChainOfThoughtStep>
				))}
			</ChainOfThoughtContent>
		</ChainOfThought>
	);
});

ThinkingProcess.displayName = "ThinkingProcess";
