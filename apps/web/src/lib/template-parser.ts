/**
 * Template Parser
 *
 * Parses slash commands and applies template substitution with argument support.
 * Implements Claude Code-style argument placeholders:
 * - $ARGUMENTS: All arguments as a single string
 * - $1, $2, $3, etc.: Individual positional arguments
 */

export interface ParsedCommand {
	command: string; // The command name (e.g., "/review")
	rawArgs: string; // Raw argument string
	args: string[]; // Array of parsed arguments
	originalInput: string; // Original input string
}

/**
 * Parse a command input string
 * Examples:
 *   "/review src/app.ts" -> { command: "/review", args: ["src/app.ts"] }
 *   "/translate 'Hello World' Spanish" -> { command: "/translate", args: ["Hello World", "Spanish"] }
 *   "/fix" -> { command: "/fix", args: [] }
 */
export function parseCommand(input: string): ParsedCommand | null {
	const trimmed = input.trim();

	// Check if input starts with /
	if (!trimmed.startsWith("/")) {
		return null;
	}

	// Find the first space to separate command from arguments
	const firstSpaceIndex = trimmed.indexOf(" ");

	if (firstSpaceIndex === -1) {
		// No arguments, just the command
		return {
			command: trimmed.toLowerCase(),
			rawArgs: "",
			args: [],
			originalInput: input,
		};
	}

	const command = trimmed.slice(0, firstSpaceIndex).toLowerCase();
	const rawArgs = trimmed.slice(firstSpaceIndex + 1).trim();
	const args = parseArguments(rawArgs);

	return {
		command,
		rawArgs,
		args,
		originalInput: input,
	};
}

/**
 * Parse arguments from a string, respecting quotes
 * Examples:
 *   "arg1 arg2 arg3" -> ["arg1", "arg2", "arg3"]
 *   "'arg with spaces' arg2" -> ["arg with spaces", "arg2"]
 *   '"quoted" arg2' -> ["quoted", "arg2"]
 */
function parseArguments(argsString: string): string[] {
	const args: string[] = [];
	let currentArg = "";
	let inQuote = false;
	let quoteChar = "";

	for (let i = 0; i < argsString.length; i++) {
		const char = argsString[i];
		const nextChar = argsString[i + 1];

		if ((char === '"' || char === "'") && !inQuote) {
			// Start of quoted string
			inQuote = true;
			quoteChar = char;
		} else if (char === quoteChar && inQuote) {
			// End of quoted string
			inQuote = false;
			quoteChar = "";
			// Add the argument if we're at end or next char is space
			if (!nextChar || nextChar === " ") {
				if (currentArg) {
					args.push(currentArg);
					currentArg = "";
				}
			}
		} else if (char === " " && !inQuote) {
			// Space outside quotes - end current argument
			if (currentArg) {
				args.push(currentArg);
				currentArg = "";
			}
		} else {
			// Regular character, add to current argument
			currentArg += char;
		}
	}

	// Add any remaining argument
	if (currentArg) {
		args.push(currentArg);
	}

	return args;
}

/**
 * Apply template substitution with parsed command arguments
 * Supports:
 * - $ARGUMENTS: All arguments joined by space
 * - $1, $2, $3, etc.: Individual positional arguments
 *
 * Example:
 *   template: "Review this code: $ARGUMENTS"
 *   args: ["src/app.ts", "for bugs"]
 *   result: "Review this code: src/app.ts for bugs"
 *
 *   template: "Translate $1 to $2"
 *   args: ["Hello", "Spanish"]
 *   result: "Translate Hello to Spanish"
 */
export function applyTemplate(template: string, parsedCommand: ParsedCommand): string {
	let result = template;

	// Replace $ARGUMENTS with all arguments
	if (result.includes("$ARGUMENTS")) {
		const allArgs = parsedCommand.rawArgs || "";
		result = result.replace(/\$ARGUMENTS/g, allArgs);
	}

	// Replace positional arguments $1, $2, $3, etc.
	// Replace in reverse order to avoid issues with $1 being replaced before $10
	for (let i = parsedCommand.args.length; i >= 1; i--) {
		const placeholder = `$${i}`;
		if (result.includes(placeholder)) {
			const arg = parsedCommand.args[i - 1] || "";
			result = result.replace(new RegExp(`\\$${i}\\b`, "g"), arg);
		}
	}

	return result;
}

/**
 * Extract all argument placeholders from a template
 * Returns both $ARGUMENTS and positional placeholders like $1, $2, etc.
 *
 * Example:
 *   template: "Translate $1 to $2 with $3 style"
 *   result: ["$1", "$2", "$3"]
 *
 *   template: "Fix this: $ARGUMENTS"
 *   result: ["$ARGUMENTS"]
 */
export function extractPlaceholders(template: string): string[] {
	const placeholders = new Set<string>();

	// Check for $ARGUMENTS
	if (template.includes("$ARGUMENTS")) {
		placeholders.add("$ARGUMENTS");
	}

	// Find all positional placeholders ($1, $2, etc.)
	const positionalRegex = /\$(\d+)\b/g;
	let match;
	while ((match = positionalRegex.exec(template)) !== null) {
		placeholders.add(match[0]);
	}

	return Array.from(placeholders).sort((a, b) => {
		// Sort $ARGUMENTS first, then numerical order
		if (a === "$ARGUMENTS") return -1;
		if (b === "$ARGUMENTS") return 1;
		const numA = parseInt(a.slice(1));
		const numB = parseInt(b.slice(1));
		return numA - numB;
	});
}

/**
 * Generate a hint string for the expected arguments based on template
 *
 * Example:
 *   template: "Translate $1 to $2"
 *   result: "[text] [language]"
 *
 *   template: "Review this: $ARGUMENTS"
 *   result: "[arguments]"
 */
export function generateArgumentHint(template: string): string {
	const placeholders = extractPlaceholders(template);

	if (placeholders.length === 0) {
		return "";
	}

	if (placeholders.includes("$ARGUMENTS")) {
		return "[arguments...]";
	}

	// Generate generic hints for positional arguments
	return placeholders
		.map((p) => {
			const num = parseInt(p.slice(1));
			return `[arg${num}]`;
		})
		.join(" ");
}

/**
 * Validate that a command input has the correct number of arguments
 * Returns an error message if validation fails, null if valid
 */
export function validateCommandArguments(
	template: string,
	parsedCommand: ParsedCommand
): string | null {
	const placeholders = extractPlaceholders(template);

	// If using $ARGUMENTS, any number of arguments is valid
	if (placeholders.includes("$ARGUMENTS")) {
		return null;
	}

	// Find the highest positional argument number
	const highestArg = placeholders.reduce((max, p) => {
		if (p.startsWith("$") && p !== "$ARGUMENTS") {
			const num = parseInt(p.slice(1));
			return Math.max(max, num);
		}
		return max;
	}, 0);

	if (highestArg === 0) {
		// No arguments expected
		if (parsedCommand.args.length > 0) {
			return "This command does not accept arguments";
		}
		return null;
	}

	// Check if we have enough arguments
	if (parsedCommand.args.length < highestArg) {
		const hint = generateArgumentHint(template);
		return `Expected ${highestArg} argument${highestArg > 1 ? "s" : ""}: ${hint}`;
	}

	return null;
}

/**
 * Check if a string looks like it might be starting a command
 * Used for triggering autocomplete
 */
export function isCommandStart(input: string): boolean {
	const trimmed = input.trim();
	return trimmed.startsWith("/") && !trimmed.includes("\n");
}

/**
 * Extract the partial command being typed (for autocomplete)
 * Returns the command portion only, without arguments
 *
 * Example:
 *   "/rev" -> "/rev"
 *   "/review some" -> "/review"
 *   "not a command" -> null
 */
export function extractPartialCommand(input: string): string | null {
	const trimmed = input.trim();

	if (!trimmed.startsWith("/")) {
		return null;
	}

	const firstSpaceIndex = trimmed.indexOf(" ");
	if (firstSpaceIndex === -1) {
		return trimmed.toLowerCase();
	}

	return trimmed.slice(0, firstSpaceIndex).toLowerCase();
}
