/**
 * Command parsing hook for chat composer
 * Handles slash command detection, parsing, and template expansion
 */

import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@server/convex/_generated/api";
import type { Id } from "@server/convex/_generated/dataModel";
import {
	isCommandStart,
	extractPartialCommand,
	parseCommand,
	applyTemplate,
} from "@/lib/template-parser";
import { useConvexUser } from "@/contexts/convex-user-context";

export interface UseCommandParserParams {
	value: string;
	onValueChange: (value: string) => void;
}

export interface UseCommandParserResult {
	// State
	showCommandAutocomplete: boolean;
	partialCommand: string | null;
	isCommandValid: boolean;
	templates: Array<{ _id: string; name: string; command: string; template: string; }>;

	// Actions
	handleTemplateSelect: (template: { _id: string; name: string; command: string; template: string }) => void;
	closeAutocomplete: () => void;
	expandCommandIfNeeded: (text: string) => string;
	clearCommandState: () => void;
}

/**
 * Hook to manage command parsing and autocomplete in chat composer
 */
export function useCommandParser({ value, onValueChange }: UseCommandParserParams): UseCommandParserResult {
	const [showCommandAutocomplete, setShowCommandAutocomplete] = useState(false);
	const [partialCommand, setPartialCommand] = useState<string | null>(null);
	const [isCommandValid, setIsCommandValid] = useState(false);

	// Fetch user's prompt templates for command autocomplete
	const { convexUser } = useConvexUser();
	const templatesResult = useQuery(
		api.promptTemplates.list,
		convexUser?._id ? { userId: convexUser._id } : "skip"
	);
	const incrementTemplateUsage = useMutation(api.promptTemplates.incrementUsage);

	const templates = templatesResult?.templates || [];

	// Update command state when value changes
	useEffect(() => {
		// Check if user is typing a command
		if (isCommandStart(value)) {
			const partial = extractPartialCommand(value);

			// If there's a space in the input, user is typing arguments - hide autocomplete
			const hasSpace = value.trim().includes(" ");

			if (hasSpace) {
				// User is typing arguments after command
				setShowCommandAutocomplete(false);
				if (partial) {
					setPartialCommand(partial); // Keep the command for reference
					// Check if the command is valid (matches a template)
					const isValid = templates.some(t => t.command === partial);
					setIsCommandValid(isValid);
				}
			} else if (partial && partial !== partialCommand) {
				// User is typing the command itself
				setPartialCommand(partial);
				setShowCommandAutocomplete(true);
				// Check if the command is valid
				const isValid = templates.some(t => t.command === partial);
				setIsCommandValid(isValid);
			} else if (!partial) {
				setShowCommandAutocomplete(false);
				setIsCommandValid(false);
			}
		} else {
			setShowCommandAutocomplete(false);
			setPartialCommand(null);
			setIsCommandValid(false);
		}
	}, [value, partialCommand, templates]);

	// Handle template selection from autocomplete
	const handleTemplateSelect = useCallback(
		(template: { _id: string; command: string; template: string }) => {
			// Insert the command with a space for arguments (Claude Code style)
			onValueChange(`${template.command} `);

			// Note: Usage count is incremented when message is sent, not on selection
			// This prevents double-counting and ensures accurate analytics

			setShowCommandAutocomplete(false);
			setPartialCommand(template.command);
			setIsCommandValid(true);
		},
		[onValueChange]
	);

	// Close autocomplete
	const closeAutocomplete = useCallback(() => {
		setShowCommandAutocomplete(false);
		setPartialCommand(null);
	}, []);

	// Expand command to template if it's a valid command
	const expandCommandIfNeeded = useCallback(
		(text: string): string => {
			const trimmed = text.trim();
			if (!isCommandStart(trimmed)) {
				return trimmed;
			}

			const parsed = parseCommand(trimmed);
			if (!parsed || !templates) {
				return trimmed;
			}

			// Find matching template
			const matchingTemplate = templates.find(t => t.command === parsed.command);
			if (!matchingTemplate) {
				return trimmed;
			}

			// Increment usage count for manual command typing
			if (convexUser?._id) {
				void incrementTemplateUsage({
					templateId: matchingTemplate._id as Id<"promptTemplates">,
					userId: convexUser._id,
				});
			}

			// Expand the template with arguments
			return applyTemplate(matchingTemplate.template, parsed);
		},
		[templates, convexUser, incrementTemplateUsage]
	);

	// Clear command state
	const clearCommandState = useCallback(() => {
		setPartialCommand(null);
		setIsCommandValid(false);
		setShowCommandAutocomplete(false);
	}, []);

	return {
		showCommandAutocomplete,
		partialCommand,
		isCommandValid,
		templates,
		handleTemplateSelect,
		closeAutocomplete,
		expandCommandIfNeeded,
		clearCommandState,
	};
}
