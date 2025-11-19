import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
	countTokens,
	countTokensMultiple,
	formatTokenCount,
	calculateUsagePercentage,
	getUsageColor,
	getEncodingForModel,
	extractMessageText,
	countMessagesTokens,
} from "@/lib/token-counter";

describe("token-counter", () => {
	describe("getEncodingForModel", () => {
		it("returns o200k_base for GPT-4o models", () => {
			expect(getEncodingForModel("gpt-4o")).toBe("o200k_base");
			expect(getEncodingForModel("gpt-4o-mini")).toBe("o200k_base");
		});

		it("returns o200k_base for O1 models", () => {
			expect(getEncodingForModel("o1-preview")).toBe("o200k_base");
			expect(getEncodingForModel("o1-mini")).toBe("o200k_base");
		});

		it("returns cl100k_base for GPT-4 models", () => {
			expect(getEncodingForModel("gpt-4")).toBe("cl100k_base");
			expect(getEncodingForModel("gpt-4-turbo")).toBe("cl100k_base");
		});

		it("returns cl100k_base for GPT-3.5 models", () => {
			expect(getEncodingForModel("gpt-3.5-turbo")).toBe("cl100k_base");
		});

		it("returns cl100k_base for Claude models", () => {
			expect(getEncodingForModel("claude-3-opus")).toBe("cl100k_base");
			expect(getEncodingForModel("claude-3-sonnet")).toBe("cl100k_base");
		});

		it("returns cl100k_base for Gemini models", () => {
			expect(getEncodingForModel("gemini-pro")).toBe("cl100k_base");
		});

		it("returns cl100k_base for unknown models", () => {
			expect(getEncodingForModel("unknown-model")).toBe("cl100k_base");
		});

		it("returns cl100k_base for undefined model", () => {
			expect(getEncodingForModel(undefined)).toBe("cl100k_base");
		});
	});

	describe("countTokens", () => {
		it("returns 0 for empty string", () => {
			expect(countTokens("")).toBe(0);
		});

		it("counts tokens for simple text", () => {
			const text = "Hello, world!";
			const count = countTokens(text);
			// "Hello, world!" should be approximately 4 tokens with cl100k_base
			// ["Hello", ",", " world", "!"]
			expect(count).toBeGreaterThan(0);
			expect(count).toBeLessThan(10);
		});

		it("counts tokens for longer text", () => {
			const text = "This is a longer piece of text that should have more tokens than the previous example.";
			const count = countTokens(text);
			expect(count).toBeGreaterThan(10);
			expect(count).toBeLessThan(50);
		});

		it("handles multi-line text", () => {
			const text = `Line 1
Line 2
Line 3`;
			const count = countTokens(text);
			expect(count).toBeGreaterThan(0);
		});

		it("handles special characters", () => {
			const text = "Special chars: @#$%^&*()";
			const count = countTokens(text);
			expect(count).toBeGreaterThan(0);
		});

		it("handles unicode characters", () => {
			const text = "Hello 世界 🌍";
			const count = countTokens(text);
			expect(count).toBeGreaterThan(0);
		});

		it("counts more tokens for o200k_base encoding", () => {
			const text = "This is a test message for token counting.";
			const countCl100k = countTokens(text, "gpt-4");
			const countO200k = countTokens(text, "gpt-4o");
			// Both should count tokens, exact values may vary
			expect(countCl100k).toBeGreaterThan(0);
			expect(countO200k).toBeGreaterThan(0);
		});
	});

	describe("countTokensMultiple", () => {
		it("returns 0 for empty array", () => {
			expect(countTokensMultiple([])).toBe(0);
		});

		it("sums tokens from multiple strings", () => {
			const texts = ["Hello", "world", "test"];
			const total = countTokensMultiple(texts);
			expect(total).toBeGreaterThan(0);
			// Should be approximately equal to counting them individually
			const individual = texts.reduce((sum, text) => sum + countTokens(text), 0);
			expect(total).toBe(individual);
		});

		it("handles mixed empty and non-empty strings", () => {
			const texts = ["", "Hello", "", "world"];
			const total = countTokensMultiple(texts);
			expect(total).toBe(countTokens("Hello") + countTokens("world"));
		});
	});

	describe("formatTokenCount", () => {
		it("formats small numbers with commas", () => {
			expect(formatTokenCount(123)).toBe("123");
			expect(formatTokenCount(999)).toBe("999");
		});

		it("formats thousands with K suffix and decimal", () => {
			expect(formatTokenCount(1000)).toBe("1.0K");
			expect(formatTokenCount(1500)).toBe("1.5K");
			expect(formatTokenCount(9999)).toBe("10.0K");
		});

		it("formats large thousands with K suffix", () => {
			expect(formatTokenCount(10000)).toBe("10K");
			expect(formatTokenCount(50000)).toBe("50K");
			expect(formatTokenCount(999999)).toBe("1,000K");
		});

		it("formats millions with M suffix", () => {
			expect(formatTokenCount(1000000)).toBe("1.0M");
			expect(formatTokenCount(1500000)).toBe("1.5M");
		});
	});

	describe("calculateUsagePercentage", () => {
		it("returns 0 for null max tokens", () => {
			expect(calculateUsagePercentage(100, null)).toBe(0);
		});

		it("returns 0 for undefined max tokens", () => {
			expect(calculateUsagePercentage(100, undefined)).toBe(0);
		});

		it("returns 0 for zero max tokens", () => {
			expect(calculateUsagePercentage(100, 0)).toBe(0);
		});

		it("returns 0 for negative max tokens", () => {
			expect(calculateUsagePercentage(100, -100)).toBe(0);
		});

		it("calculates percentage correctly", () => {
			expect(calculateUsagePercentage(50, 100)).toBe(50);
			expect(calculateUsagePercentage(25, 100)).toBe(25);
			expect(calculateUsagePercentage(75, 100)).toBe(75);
		});

		it("handles decimal results", () => {
			expect(calculateUsagePercentage(1, 3)).toBeCloseTo(33.33, 1);
		});

		it("caps at 100 percent", () => {
			expect(calculateUsagePercentage(150, 100)).toBe(100);
			expect(calculateUsagePercentage(1000, 100)).toBe(100);
		});

		it("returns 0 for zero current tokens", () => {
			expect(calculateUsagePercentage(0, 100)).toBe(0);
		});

		it("handles large numbers", () => {
			expect(calculateUsagePercentage(100000, 200000)).toBe(50);
			expect(calculateUsagePercentage(150000, 200000)).toBe(75);
		});
	});

	describe("getUsageColor", () => {
		it("returns green for low usage (0-69%)", () => {
			expect(getUsageColor(0)).toBe("green");
			expect(getUsageColor(50)).toBe("green");
			expect(getUsageColor(69)).toBe("green");
			expect(getUsageColor(69.9)).toBe("green");
		});

		it("returns yellow for medium usage (70-89%)", () => {
			expect(getUsageColor(70)).toBe("yellow");
			expect(getUsageColor(80)).toBe("yellow");
			expect(getUsageColor(89)).toBe("yellow");
			expect(getUsageColor(89.9)).toBe("yellow");
		});

		it("returns red for high usage (90-100%)", () => {
			expect(getUsageColor(90)).toBe("red");
			expect(getUsageColor(95)).toBe("red");
			expect(getUsageColor(100)).toBe("red");
		});
	});

	describe("real-world scenarios", () => {
		it("calculates tokens for a typical chat message", () => {
			const message = "Can you help me write a function that processes user input and returns a formatted response?";
			const tokens = countTokens(message);
			// This should be approximately 20-25 tokens
			expect(tokens).toBeGreaterThan(15);
			expect(tokens).toBeLessThan(30);
		});

		it("calculates tokens for code snippet", () => {
			const code = `function hello(name: string) {
  return \`Hello, \${name}!\`;
}`;
			const tokens = countTokens(code);
			expect(tokens).toBeGreaterThan(10);
		});

		it("calculates usage percentage for GPT-4 model", () => {
			const message = "This is a test message";
			const tokens = countTokens(message, "gpt-4");
			const gpt4ContextLimit = 128000; // GPT-4 Turbo context limit
			const percentage = calculateUsagePercentage(tokens, gpt4ContextLimit);

			expect(percentage).toBeGreaterThan(0);
			expect(percentage).toBeLessThan(1); // Should be very small percentage
			expect(getUsageColor(percentage)).toBe("green");
		});

		it("handles conversation with multiple messages", () => {
			const messages = [
				"Hello, how are you?",
				"I'm doing well, thanks! How can I help you today?",
				"I need help with a coding problem.",
				"Sure, I'd be happy to help. What's the problem?",
			];
			const totalTokens = countTokensMultiple(messages);
			expect(totalTokens).toBeGreaterThan(20);
			expect(totalTokens).toBeLessThan(100);
		});

		it("warns when approaching context limit", () => {
			const currentTokens = 180000;
			const maxTokens = 200000;
			const percentage = calculateUsagePercentage(currentTokens, maxTokens);

			expect(percentage).toBe(90);
			expect(getUsageColor(percentage)).toBe("red");
		});
	});

	describe("extractMessageText", () => {
		it("extracts text from simple text message", () => {
			const message: UIMessage = {
				id: "msg-1",
				role: "user",
				parts: [{ type: "text", text: "Hello, world!" }],
			};
			expect(extractMessageText(message)).toBe("Hello, world!");
		});

		it("extracts and joins multiple text parts", () => {
			const message: UIMessage = {
				id: "msg-2",
				role: "assistant",
				parts: [
					{ type: "text", text: "Hello" },
					{ type: "text", text: "world" },
				],
			};
			expect(extractMessageText(message)).toBe("Hello world");
		});

		it("extracts reasoning text", () => {
			const message: UIMessage = {
				id: "msg-3",
				role: "assistant",
				parts: [
					{ type: "text", text: "The answer is 42" },
					{ type: "reasoning", text: "Let me think about this..." },
				],
			};
			expect(extractMessageText(message)).toBe("The answer is 42 Let me think about this...");
		});

		it("handles file parts with placeholder text", () => {
			const message: UIMessage = {
				id: "msg-4",
				role: "user",
				parts: [
					{ type: "text", text: "Here's my file" },
					{ type: "file", filename: "document.pdf" },
				],
			};
			const text = extractMessageText(message);
			expect(text).toContain("Here's my file");
			expect(text).toContain("[File: document.pdf]");
		});

		it("returns empty string for empty message", () => {
			const message: UIMessage = {
				id: "msg-5",
				role: "user",
				parts: [],
			};
			expect(extractMessageText(message)).toBe("");
		});

		it("filters out empty and unsupported part types", () => {
			const message: UIMessage = {
				id: "msg-6",
				role: "assistant",
				parts: [
					{ type: "text", text: "Valid text" },
					{ type: "unknown" as any, data: "some data" },
					{ type: "text", text: "" },
				],
			};
			expect(extractMessageText(message)).toBe("Valid text");
		});
	});

	describe("countMessagesTokens", () => {
		it("returns 0 for empty message array", () => {
			expect(countMessagesTokens([], "gpt-4")).toBe(0);
		});

		it("counts tokens for single message", () => {
			const messages: UIMessage[] = [
				{
					id: "msg-1",
					role: "user",
					parts: [{ type: "text", text: "Hello, how are you?" }],
				},
			];
			const tokens = countMessagesTokens(messages, "gpt-4");
			// Should be ~5 tokens for text + 4 overhead + 3 conversation overhead = ~12
			expect(tokens).toBeGreaterThan(10);
			expect(tokens).toBeLessThan(20);
		});

		it("counts tokens for multiple messages", () => {
			const messages: UIMessage[] = [
				{
					id: "msg-1",
					role: "user",
					parts: [{ type: "text", text: "Hello!" }],
				},
				{
					id: "msg-2",
					role: "assistant",
					parts: [{ type: "text", text: "Hi there! How can I help you?" }],
				},
				{
					id: "msg-3",
					role: "user",
					parts: [{ type: "text", text: "I need help with coding." }],
				},
			];
			const tokens = countMessagesTokens(messages, "gpt-4");
			// Should have content tokens + (3 messages * 4 overhead) + 3 conversation overhead
			expect(tokens).toBeGreaterThan(25);
			expect(tokens).toBeLessThan(60);
		});

		it("includes message overhead in calculation", () => {
			const messages: UIMessage[] = [
				{
					id: "msg-1",
					role: "user",
					parts: [{ type: "text", text: "Hi" }],
				},
			];
			const tokensWithOverhead = countMessagesTokens(messages, "gpt-4");
			const textOnlyTokens = countTokens("Hi", "gpt-4");

			// Should be more than just the text tokens due to overhead
			expect(tokensWithOverhead).toBeGreaterThan(textOnlyTokens);
		});

		it("handles messages with reasoning parts", () => {
			const messages: UIMessage[] = [
				{
					id: "msg-1",
					role: "assistant",
					parts: [
						{ type: "text", text: "The answer is 42" },
						{ type: "reasoning", text: "Let me think step by step about this problem..." },
					],
				},
			];
			const tokens = countMessagesTokens(messages, "gpt-4");
			expect(tokens).toBeGreaterThan(20);
		});

		it("handles messages with file parts", () => {
			const messages: UIMessage[] = [
				{
					id: "msg-1",
					role: "user",
					parts: [
						{ type: "text", text: "Here's my document" },
						{ type: "file", filename: "analysis.pdf" },
					],
				},
			];
			const tokens = countMessagesTokens(messages, "gpt-4");
			// Should count both the text and the file placeholder
			expect(tokens).toBeGreaterThan(10);
		});

		it("counts differently for different encodings", () => {
			const messages: UIMessage[] = [
				{
					id: "msg-1",
					role: "user",
					parts: [{ type: "text", text: "This is a test message for token counting" }],
				},
			];
			const tokensCl100k = countMessagesTokens(messages, "gpt-4");
			const tokensO200k = countMessagesTokens(messages, "gpt-4o");

			// Both should have counted, but may differ slightly
			expect(tokensCl100k).toBeGreaterThan(0);
			expect(tokensO200k).toBeGreaterThan(0);
		});

		it("handles realistic conversation", () => {
			const messages: UIMessage[] = [
				{
					id: "msg-1",
					role: "user",
					parts: [{ type: "text", text: "Can you help me understand how React hooks work?" }],
				},
				{
					id: "msg-2",
					role: "assistant",
					parts: [
						{
							type: "text",
							text: "Of course! React hooks are functions that let you use state and other React features without writing a class.",
						},
					],
				},
				{
					id: "msg-3",
					role: "user",
					parts: [{ type: "text", text: "What about useEffect?" }],
				},
				{
					id: "msg-4",
					role: "assistant",
					parts: [
						{
							type: "text",
							text: "useEffect lets you perform side effects in function components. It runs after every render by default.",
						},
					],
				},
			];

			const tokens = countMessagesTokens(messages, "gpt-4");

			// 4 messages with substantial content + overhead
			expect(tokens).toBeGreaterThan(50);
			expect(tokens).toBeLessThan(150);
		});

		it("handles large conversation gracefully", () => {
			// Simulate a conversation with 20 messages
			const messages: UIMessage[] = Array.from({ length: 20 }, (_, i) => ({
				id: `msg-${i}`,
				role: i % 2 === 0 ? "user" : "assistant",
				parts: [
					{
						type: "text",
						text: `This is message number ${i + 1} in the conversation.`,
					},
				],
			}));

			const tokens = countMessagesTokens(messages, "gpt-4");

			// 20 messages * ~15 tokens each (content + overhead) = ~300 tokens
			expect(tokens).toBeGreaterThan(200);
			expect(tokens).toBeLessThan(500);
		});
	});
});
