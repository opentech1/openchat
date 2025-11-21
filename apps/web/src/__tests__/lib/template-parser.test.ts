/**
 * Unit Tests for Template Parser
 *
 * Tests template parsing and substitution:
 * - Parse template variables
 * - Replace template placeholders
 * - Handle nested templates
 * - Validate template syntax
 * - Error handling for invalid templates
 */

import { describe, test, expect } from "vitest";
import {
	parseCommand,
	applyTemplate,
	extractPlaceholders,
	generateArgumentHint,
	validateCommandArguments,
	isCommandStart,
	extractPartialCommand,
	type ParsedCommand,
} from "@/lib/template-parser";

describe("parseCommand", () => {
	test("should parse simple command without arguments", () => {
		const result = parseCommand("/review");

		expect(result).not.toBeNull();
		expect(result?.command).toBe("/review");
		expect(result?.args).toEqual([]);
		expect(result?.rawArgs).toBe("");
	});

	test("should parse command with single argument", () => {
		const result = parseCommand("/review src/app.ts");

		expect(result).not.toBeNull();
		expect(result?.command).toBe("/review");
		expect(result?.args).toEqual(["src/app.ts"]);
		expect(result?.rawArgs).toBe("src/app.ts");
	});

	test("should parse command with multiple arguments", () => {
		const result = parseCommand("/translate Hello Spanish");

		expect(result).not.toBeNull();
		expect(result?.command).toBe("/translate");
		expect(result?.args).toEqual(["Hello", "Spanish"]);
	});

	test("should handle quoted arguments", () => {
		const result = parseCommand("/translate 'Hello World' Spanish");

		expect(result).not.toBeNull();
		expect(result?.args).toEqual(["Hello World", "Spanish"]);
	});

	test("should handle double quoted arguments", () => {
		const result = parseCommand('/translate "Hello World" Spanish');

		expect(result).not.toBeNull();
		expect(result?.args).toEqual(["Hello World", "Spanish"]);
	});

	test("should handle mixed quotes", () => {
		const result = parseCommand('/test "arg1" \'arg2\' arg3');

		expect(result).not.toBeNull();
		expect(result?.args).toEqual(["arg1", "arg2", "arg3"]);
	});

	test("should return null for non-command input", () => {
		const result = parseCommand("regular text");

		expect(result).toBeNull();
	});

	test("should lowercase the command", () => {
		const result = parseCommand("/REVIEW");

		expect(result?.command).toBe("/review");
	});

	test("should preserve case in arguments", () => {
		const result = parseCommand("/test CamelCase");

		expect(result?.args).toEqual(["CamelCase"]);
	});

	test("should handle extra whitespace", () => {
		const result = parseCommand("/review    arg1    arg2");

		expect(result?.args).toEqual(["arg1", "arg2"]);
	});

	test("should preserve originalInput", () => {
		const input = "/review  test.ts  ";
		const result = parseCommand(input);

		expect(result?.originalInput).toBe(input);
	});

	test("should handle empty quotes", () => {
		const result = parseCommand('/test "" arg2');

		expect(result?.args).toEqual(["arg2"]);
	});

	test("should handle command with trailing spaces", () => {
		const result = parseCommand("/review   ");

		expect(result?.command).toBe("/review");
		expect(result?.args).toEqual([]);
	});

	test("should handle nested quotes", () => {
		const result = parseCommand('/test "arg with \'quotes\'"');

		expect(result?.args).toEqual(["arg with 'quotes'"]);
	});

	test("should handle special characters in arguments", () => {
		const result = parseCommand("/test @#$%^&*()");

		expect(result?.args).toEqual(["@#$%^&*()"]);
	});
});

describe("applyTemplate", () => {
	test("should replace $ARGUMENTS with all arguments", () => {
		const parsed = parseCommand("/review src/app.ts for bugs") as ParsedCommand;
		const result = applyTemplate("Review this code: $ARGUMENTS", parsed);

		expect(result).toBe("Review this code: src/app.ts for bugs");
	});

	test("should replace $1 with first argument", () => {
		const parsed = parseCommand("/translate Hello Spanish") as ParsedCommand;
		const result = applyTemplate("Translate $1 to $2", parsed);

		expect(result).toBe("Translate Hello to Spanish");
	});

	test("should handle multiple positional arguments", () => {
		const parsed = parseCommand("/test arg1 arg2 arg3") as ParsedCommand;
		const result = applyTemplate("$1 - $2 - $3", parsed);

		expect(result).toBe("arg1 - arg2 - arg3");
	});

	test("should handle missing arguments gracefully", () => {
		const parsed = parseCommand("/test arg1") as ParsedCommand;
		const result = applyTemplate("$1 - $2 - $3", parsed);

		// Only replaces placeholders for existing args, leaves others untouched
		expect(result).toBe("arg1 - $2 - $3");
	});

	test("should not replace $10 when only $1 exists", () => {
		const parsed = parseCommand("/test arg1") as ParsedCommand;
		const result = applyTemplate("$10 test", parsed);

		expect(result).toBe("$10 test");
	});

	test("should handle $ARGUMENTS when empty", () => {
		const parsed = parseCommand("/test") as ParsedCommand;
		const result = applyTemplate("Args: $ARGUMENTS", parsed);

		expect(result).toBe("Args: ");
	});

	test("should handle template with no placeholders", () => {
		const parsed = parseCommand("/test arg") as ParsedCommand;
		const result = applyTemplate("No placeholders here", parsed);

		expect(result).toBe("No placeholders here");
	});

	test("should handle mixed placeholders", () => {
		const parsed = parseCommand("/test a b c d") as ParsedCommand;
		const result = applyTemplate("$1 and $2, all: $ARGUMENTS", parsed);

		expect(result).toBe("a and b, all: a b c d");
	});

	test("should preserve quoted arguments in $ARGUMENTS", () => {
		const parsed = parseCommand('/test "hello world" test') as ParsedCommand;
		const result = applyTemplate("$ARGUMENTS", parsed);

		expect(result).toBe('"hello world" test');
	});

	test("should handle $1 through $9", () => {
		const parsed = parseCommand("/test a b c d e f g h i") as ParsedCommand;
		const result = applyTemplate("$1$2$3$4$5$6$7$8$9", parsed);

		expect(result).toBe("abcdefghi");
	});

	test("should handle $10 and higher", () => {
		const args = Array.from({ length: 15 }, (_, i) => `arg${i + 1}`).join(" ");
		const parsed = parseCommand(`/test ${args}`) as ParsedCommand;
		const result = applyTemplate("$10 $11 $15", parsed);

		expect(result).toBe("arg10 arg11 arg15");
	});

	test("should not confuse $1 with $10", () => {
		const args = Array.from({ length: 10 }, (_, i) => `arg${i + 1}`).join(" ");
		const parsed = parseCommand(`/test ${args}`) as ParsedCommand;
		const result = applyTemplate("$1, $10", parsed);

		expect(result).toBe("arg1, arg10");
	});

	test("should handle dollar signs in template text", () => {
		const parsed = parseCommand("/test value") as ParsedCommand;
		const result = applyTemplate("Price: $100, Item: $1", parsed);

		expect(result).toBe("Price: $100, Item: value");
	});

	test("should handle placeholders with punctuation", () => {
		const parsed = parseCommand("/test hello world") as ParsedCommand;
		const result = applyTemplate("$1. $2!", parsed);

		expect(result).toBe("hello. world!");
	});
});

describe("extractPlaceholders", () => {
	test("should extract $ARGUMENTS placeholder", () => {
		const result = extractPlaceholders("Review: $ARGUMENTS");

		expect(result).toContain("$ARGUMENTS");
	});

	test("should extract positional placeholders", () => {
		const result = extractPlaceholders("$1 to $2");

		expect(result).toEqual(["$1", "$2"]);
	});

	test("should extract mixed placeholders", () => {
		const result = extractPlaceholders("$1, $2, $ARGUMENTS");

		expect(result).toContain("$ARGUMENTS");
		expect(result).toContain("$1");
		expect(result).toContain("$2");
	});

	test("should return empty array for no placeholders", () => {
		const result = extractPlaceholders("No placeholders here");

		expect(result).toEqual([]);
	});

	test("should sort placeholders correctly", () => {
		const result = extractPlaceholders("$3 $1 $2 $ARGUMENTS");

		expect(result[0]).toBe("$ARGUMENTS");
		expect(result[1]).toBe("$1");
		expect(result[2]).toBe("$2");
		expect(result[3]).toBe("$3");
	});

	test("should handle duplicate placeholders", () => {
		const result = extractPlaceholders("$1 $1 $2 $2");

		expect(result).toEqual(["$1", "$2"]);
	});

	test("should extract high number placeholders", () => {
		const result = extractPlaceholders("$10 $20 $100");

		expect(result).toContain("$10");
		expect(result).toContain("$20");
		expect(result).toContain("$100");
	});

	test("should extract $0 and higher", () => {
		const result = extractPlaceholders("$0 $1");

		// The regex matches $0 and higher (any digit)
		expect(result).toContain("$0");
		expect(result).toContain("$1");
	});

	test("should handle placeholders with punctuation", () => {
		const result = extractPlaceholders("$1. $2! $3?");

		expect(result).toEqual(["$1", "$2", "$3"]);
	});
});

describe("generateArgumentHint", () => {
	test("should generate hint for $ARGUMENTS", () => {
		const result = generateArgumentHint("$ARGUMENTS");

		expect(result).toBe("[arguments...]");
	});

	test("should generate hints for positional arguments", () => {
		const result = generateArgumentHint("$1 $2");

		expect(result).toBe("[arg1] [arg2]");
	});

	test("should return empty string for no placeholders", () => {
		const result = generateArgumentHint("No placeholders");

		expect(result).toBe("");
	});

	test("should handle multiple positional arguments", () => {
		const result = generateArgumentHint("$1 $2 $3");

		expect(result).toBe("[arg1] [arg2] [arg3]");
	});

	test("should prioritize $ARGUMENTS over positional", () => {
		const result = generateArgumentHint("$1 $ARGUMENTS");

		expect(result).toBe("[arguments...]");
	});
});

describe("validateCommandArguments", () => {
	test("should validate command with correct arguments", () => {
		const parsed = parseCommand("/test arg1 arg2") as ParsedCommand;
		const error = validateCommandArguments("$1 $2", parsed);

		expect(error).toBeNull();
	});

	test("should return error for missing arguments", () => {
		const parsed = parseCommand("/test arg1") as ParsedCommand;
		const error = validateCommandArguments("$1 $2 $3", parsed);

		expect(error).not.toBeNull();
		expect(error).toContain("Expected 3");
	});

	test("should allow extra arguments", () => {
		const parsed = parseCommand("/test arg1 arg2 arg3") as ParsedCommand;
		const error = validateCommandArguments("$1 $2", parsed);

		expect(error).toBeNull();
	});

	test("should accept any arguments with $ARGUMENTS", () => {
		const parsed = parseCommand("/test") as ParsedCommand;
		const error = validateCommandArguments("$ARGUMENTS", parsed);

		expect(error).toBeNull();
	});

	test("should error when no arguments expected but provided", () => {
		const parsed = parseCommand("/test arg1") as ParsedCommand;
		const error = validateCommandArguments("No placeholders", parsed);

		expect(error).not.toBeNull();
		expect(error).toContain("does not accept arguments");
	});

	test("should validate command with no placeholders and no args", () => {
		const parsed = parseCommand("/test") as ParsedCommand;
		const error = validateCommandArguments("No placeholders", parsed);

		expect(error).toBeNull();
	});

	test("should include hint in error message", () => {
		const parsed = parseCommand("/test") as ParsedCommand;
		const error = validateCommandArguments("$1 $2", parsed);

		expect(error).toContain("[arg1] [arg2]");
	});
});

describe("isCommandStart", () => {
	test("should detect command start", () => {
		const result = isCommandStart("/rev");

		expect(result).toBe(true);
	});

	test("should detect complete command", () => {
		const result = isCommandStart("/review src/app.ts");

		expect(result).toBe(true);
	});

	test("should reject non-command", () => {
		const result = isCommandStart("not a command");

		expect(result).toBe(false);
	});

	test("should reject multiline input", () => {
		const result = isCommandStart("/review\nsecond line");

		expect(result).toBe(false);
	});

	test("should handle empty string", () => {
		const result = isCommandStart("");

		expect(result).toBe(false);
	});

	test("should handle slash alone", () => {
		const result = isCommandStart("/");

		expect(result).toBe(true);
	});

	test("should trim whitespace", () => {
		const result = isCommandStart("  /review  ");

		expect(result).toBe(true);
	});
});

describe("extractPartialCommand", () => {
	test("should extract partial command", () => {
		const result = extractPartialCommand("/rev");

		expect(result).toBe("/rev");
	});

	test("should extract command without arguments", () => {
		const result = extractPartialCommand("/review src/app.ts");

		expect(result).toBe("/review");
	});

	test("should return null for non-command", () => {
		const result = extractPartialCommand("not a command");

		expect(result).toBeNull();
	});

	test("should lowercase command", () => {
		const result = extractPartialCommand("/REVIEW");

		expect(result).toBe("/review");
	});

	test("should handle command with spaces", () => {
		const result = extractPartialCommand("/review   arg");

		expect(result).toBe("/review");
	});

	test("should handle slash alone", () => {
		const result = extractPartialCommand("/");

		expect(result).toBe("/");
	});

	test("should trim input", () => {
		const result = extractPartialCommand("  /review  ");

		expect(result).toBe("/review");
	});

	test("should handle empty string", () => {
		const result = extractPartialCommand("");

		expect(result).toBeNull();
	});
});

describe("edge cases and integration", () => {
	test("should handle complex template with all features", () => {
		const parsed = parseCommand('/complex "arg 1" arg2 arg3') as ParsedCommand;
		const template = "First: $1, Second: $2, All: $ARGUMENTS";
		const result = applyTemplate(template, parsed);

		expect(result).toBe('First: arg 1, Second: arg2, All: "arg 1" arg2 arg3');
	});

	test("should handle Unicode in commands and templates", () => {
		const parsed = parseCommand("/test 你好 世界") as ParsedCommand;
		const result = applyTemplate("Greet: $1 $2", parsed);

		expect(result).toBe("Greet: 你好 世界");
	});

	test("should handle special regex characters in arguments", () => {
		const parsed = parseCommand("/test $100 (test)") as ParsedCommand;
		const result = applyTemplate("Price: $1, Note: $2", parsed);

		expect(result).toBe("Price: $100, Note: (test)");
	});

	test("should validate and apply template together", () => {
		const parsed = parseCommand("/test arg1 arg2") as ParsedCommand;
		const template = "$1 and $2";
		const error = validateCommandArguments(template, parsed);

		expect(error).toBeNull();

		const result = applyTemplate(template, parsed);
		expect(result).toBe("arg1 and arg2");
	});

	test("should handle empty command gracefully", () => {
		const parsed = parseCommand("/");

		expect(parsed?.command).toBe("/");
		expect(parsed?.args).toEqual([]);
	});

	test("should parse command with escaped quotes", () => {
		const parsed = parseCommand('/test "escaped\\"quote"');

		expect(parsed?.rawArgs).toContain('escaped\\"quote');
	});

	test("should handle very long argument lists", () => {
		const args = Array.from({ length: 100 }, (_, i) => `arg${i}`).join(" ");
		const parsed = parseCommand(`/test ${args}`) as ParsedCommand;

		expect(parsed.args.length).toBe(100);
	});

	test("should handle templates with no variables", () => {
		const parsed = parseCommand("/test arg") as ParsedCommand;
		const template = "Static template text";
		const result = applyTemplate(template, parsed);

		expect(result).toBe("Static template text");
	});
});
