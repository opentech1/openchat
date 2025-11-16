/**
 * Unit Tests for Validation Schemas
 *
 * Tests input validation logic to ensure:
 * - Valid inputs are accepted
 * - Invalid inputs are rejected
 * - Edge cases are handled correctly
 * - Error messages are helpful
 *
 * These tests document the expected behavior of validation schemas
 * and catch regressions when schemas are modified.
 */

import { describe, test, expect } from "vitest";
import {
	convexIdSchema,
	chatTitleSchema,
	messageContentSchema,
	modelIdSchema,
	apiKeySchema,
	createChatSchema,
	sendMessageSchema,
	paginationSchema,
	safeValidate,
	createValidationErrorResponse,
} from "@/lib/validation";

describe("convexIdSchema", () => {
	test("should accept valid Convex ID", () => {
		const validIds = [
			"abc123",
			"user_123",
			"chat-456",
			"ABC_123-xyz",
		];

		for (const id of validIds) {
			const result = convexIdSchema.safeParse(id);
			expect(result.success).toBe(true);
		}
	});

	test("should reject empty string", () => {
		const result = convexIdSchema.safeParse("");
		expect(result.success).toBe(false);
	});

	test("should reject ID that is too long", () => {
		const longId = "a".repeat(101);
		const result = convexIdSchema.safeParse(longId);
		expect(result.success).toBe(false);
	});

	test("should reject ID with invalid characters", () => {
		const invalidIds = [
			"id with spaces",
			"id@email.com",
			"id/slash",
			"id\\backslash",
		];

		for (const id of invalidIds) {
			const result = convexIdSchema.safeParse(id);
			expect(result.success).toBe(false);
		}
	});
});

describe("chatTitleSchema", () => {
	test("should accept valid title", () => {
		const result = chatTitleSchema.safeParse("My Chat");
		expect(result.success).toBe(true);
		expect(result.data).toBe("My Chat");
	});

	test("should trim whitespace", () => {
		const result = chatTitleSchema.safeParse("  Trimmed Title  ");
		expect(result.success).toBe(true);
		expect(result.data).toBe("Trimmed Title");
	});

	test("should reject empty title", () => {
		const result = chatTitleSchema.safeParse("");
		expect(result.success).toBe(false);
	});

	test("should reject title that is too long", () => {
		const longTitle = "a".repeat(201);
		const result = chatTitleSchema.safeParse(longTitle);
		expect(result.success).toBe(false);
	});

	test("should accept special characters", () => {
		const specialTitles = [
			"Chat #1",
			"Q&A Session",
			"测试聊天", // Chinese characters
			"Чат тест", // Cyrillic
			"🔥 Hot Chat 🔥", // Emojis
		];

		for (const title of specialTitles) {
			const result = chatTitleSchema.safeParse(title);
			expect(result.success).toBe(true);
		}
	});
});

describe("messageContentSchema", () => {
	test("should accept valid message", () => {
		const result = messageContentSchema.safeParse("Hello, world!");
		expect(result.success).toBe(true);
	});

	test("should reject empty message", () => {
		const result = messageContentSchema.safeParse("");
		expect(result.success).toBe(false);
	});

	test("should accept long message up to limit", () => {
		const maxLength = 50_000;
		const longMessage = "a".repeat(maxLength);
		const result = messageContentSchema.safeParse(longMessage);
		expect(result.success).toBe(true);
	});

	test("should reject message exceeding limit", () => {
		const tooLong = "a".repeat(50_001);
		const result = messageContentSchema.safeParse(tooLong);
		expect(result.success).toBe(false);
	});

	test("should accept multiline messages", () => {
		const multiline = "Line 1\nLine 2\nLine 3";
		const result = messageContentSchema.safeParse(multiline);
		expect(result.success).toBe(true);
	});
});

describe("modelIdSchema", () => {
	test("should accept valid model IDs", () => {
		const validModels = [
			"gpt-4",
			"claude-3-opus",
			"mistral-large",
			"anthropic/claude-3.5-sonnet",
			"openai/gpt-4-turbo",
		];

		for (const modelId of validModels) {
			const result = modelIdSchema.safeParse(modelId);
			expect(result.success).toBe(true);
		}
	});

	test("should reject model ID with invalid characters", () => {
		const invalidModels = [
			"model with spaces",
			"model<script>",
			"model;alert()",
		];

		for (const modelId of invalidModels) {
			const result = modelIdSchema.safeParse(modelId);
			expect(result.success).toBe(false);
		}
	});
});

describe("apiKeySchema", () => {
	test("should accept valid API key", () => {
		const validKeys = [
			"sk-1234567890abcdef",
			"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
			"api_key_12345",
		];

		for (const key of validKeys) {
			const result = apiKeySchema.safeParse(key);
			expect(result.success).toBe(true);
		}
	});

	test("should reject key that is too short", () => {
		const shortKey = "short";
		const result = apiKeySchema.safeParse(shortKey);
		expect(result.success).toBe(false);
	});

	test("should reject key that is too long", () => {
		const longKey = "a".repeat(501);
		const result = apiKeySchema.safeParse(longKey);
		expect(result.success).toBe(false);
	});
});

describe("createChatSchema", () => {
	test("should accept valid chat creation", () => {
		const result = createChatSchema.safeParse({ title: "New Chat" });
		expect(result.success).toBe(true);
		expect(result.data?.title).toBe("New Chat");
	});

	test("should use default title when not provided", () => {
		const result = createChatSchema.safeParse({});
		expect(result.success).toBe(true);
		expect(result.data?.title).toBe("New Chat");
	});

	test("should reject invalid title", () => {
		const result = createChatSchema.safeParse({ title: "" });
		expect(result.success).toBe(false);
	});
});

describe("sendMessageSchema", () => {
	test("should accept valid message with all fields", () => {
		const validMessage = {
			chatId: "chat_123",
			userMessage: {
				id: "msg_user_1",
				content: "Hello!",
				createdAt: new Date().toISOString(),
			},
			assistantMessage: {
				id: "msg_assistant_1",
				content: "Hi there!",
				createdAt: new Date().toISOString(),
			},
		};

		const result = sendMessageSchema.safeParse(validMessage);
		expect(result.success).toBe(true);
	});

	test("should accept message without assistant message", () => {
		const validMessage = {
			chatId: "chat_123",
			userMessage: {
				content: "Hello!",
			},
		};

		const result = sendMessageSchema.safeParse(validMessage);
		expect(result.success).toBe(true);
	});

	test("should reject message with invalid chat ID", () => {
		const invalidMessage = {
			chatId: "invalid id with spaces",
			userMessage: {
				content: "Hello!",
			},
		};

		const result = sendMessageSchema.safeParse(invalidMessage);
		expect(result.success).toBe(false);
	});

	test("should reject message with empty content", () => {
		const invalidMessage = {
			chatId: "chat_123",
			userMessage: {
				content: "",
			},
		};

		const result = sendMessageSchema.safeParse(invalidMessage);
		expect(result.success).toBe(false);
	});
});

describe("paginationSchema", () => {
	test("should accept valid pagination", () => {
		const result = paginationSchema.safeParse({
			cursor: "abc123",
			limit: 25,
		});

		expect(result.success).toBe(true);
		expect(result.data?.limit).toBe(25);
	});

	test("should use default limit when not provided", () => {
		const result = paginationSchema.safeParse({});
		expect(result.success).toBe(true);
		expect(result.data?.limit).toBe(50);
	});

	test("should reject negative limit", () => {
		const result = paginationSchema.safeParse({ limit: -1 });
		expect(result.success).toBe(false);
	});

	test("should reject limit exceeding maximum", () => {
		const result = paginationSchema.safeParse({ limit: 101 });
		expect(result.success).toBe(false);
	});

	test("should reject non-integer limit", () => {
		const result = paginationSchema.safeParse({ limit: 10.5 });
		expect(result.success).toBe(false);
	});
});

describe("safeValidate", () => {
	test("should return success for valid data", () => {
		const result = safeValidate(chatTitleSchema, "Valid Title");

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toBe("Valid Title");
		}
	});

	test("should return error for invalid data", () => {
		const result = safeValidate(chatTitleSchema, "");

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error).toBeDefined();
			expect(result.error.issues.length).toBeGreaterThan(0);
		}
	});
});

describe("createValidationErrorResponse", () => {
	test("should return 400 status", () => {
		const validation = chatTitleSchema.safeParse("");

		if (!validation.success) {
			const response = createValidationErrorResponse(validation.error);

			expect(response.status).toBe(400);
			expect(response.headers.get("Content-Type")).toBe("application/json");
		}
	});

	test("should include error details in development", () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "development";

		const validation = chatTitleSchema.safeParse("");

		if (!validation.success) {
			const response = createValidationErrorResponse(validation.error);
			const body = response.json();

			body.then((data) => {
				expect(data).toHaveProperty("issues");
				expect(Array.isArray(data.issues)).toBe(true);
			});
		}

		process.env.NODE_ENV = originalEnv;
	});

	test("should return generic error in production", () => {
		const originalEnv = process.env.NODE_ENV;
		process.env.NODE_ENV = "production";

		const validation = chatTitleSchema.safeParse("");

		if (!validation.success) {
			const response = createValidationErrorResponse(validation.error);
			const body = response.json();

			body.then((data) => {
				expect(data).toHaveProperty("error", "Invalid input");
				expect(data).not.toHaveProperty("issues");
			});
		}

		process.env.NODE_ENV = originalEnv;
	});
});
