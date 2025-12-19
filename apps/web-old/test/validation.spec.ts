import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { z, ZodError } from "zod";
import {
	convexIdSchema,
	chatIdSchema,
	messageIdSchema,
	chatTitleSchema,
	messageContentSchema,
	modelIdSchema,
	apiKeySchema,
	timestampSchema,
	createChatSchema,
	deleteChatSchema,
	sendMessageSchema,
	paginationSchema,
	safeValidate,
	createValidationErrorResponse,
} from "@/lib/validation";

describe("validation", () => {
	// =============================================================================
	// Convex ID Schema Tests
	// =============================================================================

	describe("convexIdSchema", () => {
		it("accepts valid Convex ID format", () => {
			const validIds = [
				"abc123",
				"ABC123",
				"abc_123",
				"abc-123",
				"a1b2c3",
				"_underscore",
				"-dash",
			];

			for (const id of validIds) {
				expect(() => convexIdSchema.parse(id)).not.toThrow();
			}
		});

		it("rejects empty string", () => {
			expect(() => convexIdSchema.parse("")).toThrow(ZodError);
			expect(() => convexIdSchema.parse("")).toThrow("ID cannot be empty");
		});

		it("rejects IDs that are too long", () => {
			const longId = "a".repeat(101);
			expect(() => convexIdSchema.parse(longId)).toThrow(ZodError);
			expect(() => convexIdSchema.parse(longId)).toThrow("ID too long");
		});

		it("rejects invalid characters", () => {
			const invalidIds = [
				"abc#123",
				"abc@123",
				"abc!123",
				"abc$123",
				"abc%123",
				"abc&123",
				"abc*123",
				"abc(123)",
				"abc[123]",
				"abc{123}",
				"abc/123",
				"abc\\123",
				"abc.123",
				"abc,123",
				"abc;123",
				"abc:123",
				"abc'123",
				"abc\"123",
				"abc 123", // space
			];

			for (const id of invalidIds) {
				expect(() => convexIdSchema.parse(id)).toThrow(ZodError);
			}
		});

		it("accepts ID at max length", () => {
			const maxId = "a".repeat(100);
			expect(() => convexIdSchema.parse(maxId)).not.toThrow();
		});
	});

	describe("chatIdSchema", () => {
		it("is identical to convexIdSchema", () => {
			expect(chatIdSchema).toBe(convexIdSchema);
		});

		it("validates chat IDs correctly", () => {
			expect(() => chatIdSchema.parse("chat_abc123")).not.toThrow();
			expect(() => chatIdSchema.parse("")).toThrow();
		});
	});

	describe("messageIdSchema", () => {
		it("accepts non-empty message IDs", () => {
			const validIds = [
				"msg-123",
				"message_abc",
				"12345",
				"m",
			];

			for (const id of validIds) {
				expect(() => messageIdSchema.parse(id)).not.toThrow();
			}
		});

		it("rejects empty string", () => {
			expect(() => messageIdSchema.parse("")).toThrow("Message ID cannot be empty");
		});

		it("rejects IDs that are too long", () => {
			const longId = "m".repeat(201);
			expect(() => messageIdSchema.parse(longId)).toThrow("Message ID too long");
		});

		it("accepts ID at max length", () => {
			const maxId = "m".repeat(200);
			expect(() => messageIdSchema.parse(maxId)).not.toThrow();
		});
	});

	// =============================================================================
	// Chat Title Schema Tests
	// =============================================================================

	describe("chatTitleSchema", () => {
		it("accepts valid chat titles", () => {
			const validTitles = [
				"My Chat",
				"Chat 123",
				"A",
				"New conversation about AI",
			];

			for (const title of validTitles) {
				expect(() => chatTitleSchema.parse(title)).not.toThrow();
			}
		});

		it("trims whitespace", () => {
			expect(chatTitleSchema.parse("  title  ")).toBe("title");
			expect(chatTitleSchema.parse("\ttitle\t")).toBe("title");
			expect(chatTitleSchema.parse("\ntitle\n")).toBe("title");
		});

		it("rejects empty string", () => {
			expect(() => chatTitleSchema.parse("")).toThrow("Title cannot be empty");
		});

		it("trims and accepts whitespace-wrapped strings", () => {
			// Zod's trim() happens as transformation after validation passes
			// So "   a   " is valid (length > 1), then gets trimmed to "a"
			const result = chatTitleSchema.parse("   valid   ");
			expect(result).toBe("valid");
		});

		it("rejects titles that are too long", () => {
			const longTitle = "a".repeat(201);
			expect(() => chatTitleSchema.parse(longTitle)).toThrow("Title too long");
		});

		it("accepts title at max length", () => {
			const maxTitle = "a".repeat(200);
			expect(() => chatTitleSchema.parse(maxTitle)).not.toThrow();
		});

		it("accepts special characters", () => {
			const specialTitles = [
				"Chat: AI Discussion",
				"Q&A Session",
				"Review #1",
				"Meeting @ 3pm",
				"Project [Draft]",
			];

			for (const title of specialTitles) {
				expect(() => chatTitleSchema.parse(title)).not.toThrow();
			}
		});
	});

	// =============================================================================
	// Message Content Schema Tests
	// =============================================================================

	describe("messageContentSchema", () => {
		it("accepts valid message content", () => {
			const validMessages = [
				"Hello",
				"How are you?",
				"Can you help me with coding?",
				"A".repeat(1000),
			];

			for (const message of validMessages) {
				expect(() => messageContentSchema.parse(message)).not.toThrow();
			}
		});

		it("rejects empty string", () => {
			expect(() => messageContentSchema.parse("")).toThrow("Message content cannot be empty");
		});

		it("rejects content that is too long", () => {
			const longContent = "a".repeat(50001);
			expect(() => messageContentSchema.parse(longContent)).toThrow("Message content too long");
		});

		it("accepts content at max length", () => {
			const maxContent = "a".repeat(50000);
			expect(() => messageContentSchema.parse(maxContent)).not.toThrow();
		});

		it("accepts multiline content", () => {
			const multiline = "Line 1\nLine 2\nLine 3";
			expect(() => messageContentSchema.parse(multiline)).not.toThrow();
		});

		it("accepts content with special characters", () => {
			const special = "Hello! @user #tag $price 100% valid 特殊文字 émoji 🔥";
			expect(() => messageContentSchema.parse(special)).not.toThrow();
		});
	});

	// =============================================================================
	// Model ID Schema Tests
	// =============================================================================

	describe("modelIdSchema", () => {
		it("accepts valid OpenRouter model IDs", () => {
			const validModels = [
				"openai/gpt-4",
				"anthropic/claude-3-opus",
				"google/gemini-pro",
				"meta-llama/llama-3-70b",
				"mistralai/mixtral-8x7b",
			];

			for (const model of validModels) {
				expect(() => modelIdSchema.parse(model)).not.toThrow();
			}
		});

		it("accepts model IDs with version numbers", () => {
			const versioned = [
				"openai/gpt-4-turbo-2024-04-09",
				"anthropic/claude-3.5-sonnet",
				"model:v1.0",
				"provider/model@latest",
			];

			for (const model of versioned) {
				expect(() => modelIdSchema.parse(model)).not.toThrow();
			}
		});

		it("rejects empty string", () => {
			expect(() => modelIdSchema.parse("")).toThrow("Model ID cannot be empty");
		});

		it("rejects model IDs that are too long", () => {
			const longModel = "a".repeat(201);
			expect(() => modelIdSchema.parse(longModel)).toThrow("Model ID too long");
		});

		it("rejects invalid characters", () => {
			const invalid = [
				"model with spaces",
				"model!invalid",
				"model#invalid",
				"model$invalid",
				"model%invalid",
				"model&invalid",
				"model*invalid",
				"model(invalid)",
				"model[invalid]",
				"model{invalid}",
				"model\\invalid",
				"model;invalid",
				"model,invalid",
			];

			for (const model of invalid) {
				expect(() => modelIdSchema.parse(model)).toThrow("Model ID contains invalid characters");
			}
		});

		it("accepts all allowed special characters", () => {
			const allowed = [
				"model_name",
				"model-name",
				"model/name",
				"model:name",
				"model@name",
				"model.name",
			];

			for (const model of allowed) {
				expect(() => modelIdSchema.parse(model)).not.toThrow();
			}
		});
	});

	// =============================================================================
	// API Key Schema Tests
	// =============================================================================

	describe("apiKeySchema", () => {
		it("accepts valid API keys", () => {
			const validKeys = [
				"sk_test_1234567890",
				"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
				"a".repeat(50),
			];

			for (const key of validKeys) {
				expect(() => apiKeySchema.parse(key)).not.toThrow();
			}
		});

		it("rejects API keys that are too short", () => {
			expect(() => apiKeySchema.parse("short")).toThrow("API key too short");
			expect(() => apiKeySchema.parse("123456789")).toThrow("API key too short");
		});

		it("rejects API keys that are too long", () => {
			const longKey = "a".repeat(501);
			expect(() => apiKeySchema.parse(longKey)).toThrow("API key too long");
		});

		it("accepts key at min length", () => {
			const minKey = "a".repeat(10);
			expect(() => apiKeySchema.parse(minKey)).not.toThrow();
		});

		it("accepts key at max length", () => {
			const maxKey = "a".repeat(500);
			expect(() => apiKeySchema.parse(maxKey)).not.toThrow();
		});
	});

	// =============================================================================
	// Timestamp Schema Tests
	// =============================================================================

	describe("timestampSchema", () => {
		it("accepts ISO datetime strings", () => {
			const validTimestamps = [
				"2024-01-01T00:00:00Z",
				"2024-01-01T12:34:56.789Z",
				"2024-12-31T23:59:59Z",
			];

			for (const timestamp of validTimestamps) {
				expect(() => timestampSchema.parse(timestamp)).not.toThrow();
			}
		});

		it("accepts Date objects", () => {
			const date = new Date();
			expect(() => timestampSchema.parse(date)).not.toThrow();
		});

		it("accepts positive numbers (Unix timestamps)", () => {
			expect(() => timestampSchema.parse(1234567890)).not.toThrow();
			expect(() => timestampSchema.parse(Date.now())).not.toThrow();
		});

		it("rejects negative numbers", () => {
			expect(() => timestampSchema.parse(-1)).toThrow();
		});

		it("rejects zero", () => {
			expect(() => timestampSchema.parse(0)).toThrow();
		});

		it("rejects invalid datetime strings", () => {
			const invalid = [
				"2024-13-01", // Invalid month
				"2024-01-32", // Invalid day
				"not a date",
				"",
			];

			for (const timestamp of invalid) {
				expect(() => timestampSchema.parse(timestamp)).toThrow();
			}
		});
	});

	// =============================================================================
	// Create Chat Schema Tests
	// =============================================================================

	describe("createChatSchema", () => {
		it("accepts valid chat creation data", () => {
			const validData = [
				{ title: "My Chat" },
				{ title: "New conversation" },
			];

			for (const data of validData) {
				expect(() => createChatSchema.parse(data)).not.toThrow();
			}
		});

		it("uses default title when not provided", () => {
			const result = createChatSchema.parse({});
			expect(result.title).toBe("New Chat");
		});

		it("uses provided title", () => {
			const result = createChatSchema.parse({ title: "Custom Title" });
			expect(result.title).toBe("Custom Title");
		});

		it("validates title according to chatTitleSchema", () => {
			expect(() => createChatSchema.parse({ title: "" })).toThrow();
			expect(() => createChatSchema.parse({ title: "a".repeat(201) })).toThrow();
		});
	});

	// =============================================================================
	// Delete Chat Schema Tests
	// =============================================================================

	describe("deleteChatSchema", () => {
		it("accepts valid delete data", () => {
			const validData = [
				{ id: "chat_123" },
				{ id: "abc-def-123" },
			];

			for (const data of validData) {
				expect(() => deleteChatSchema.parse(data)).not.toThrow();
			}
		});

		it("requires id field", () => {
			expect(() => deleteChatSchema.parse({})).toThrow();
		});

		it("validates id according to chatIdSchema", () => {
			expect(() => deleteChatSchema.parse({ id: "" })).toThrow();
			expect(() => deleteChatSchema.parse({ id: "invalid!id" })).toThrow();
		});
	});

	// =============================================================================
	// Send Message Schema Tests
	// =============================================================================

	describe("sendMessageSchema", () => {
		it("accepts valid message send data", () => {
			const validData = {
				chatId: "chat_123",
				userMessage: {
					content: "Hello, AI!",
				},
			};

			expect(() => sendMessageSchema.parse(validData)).not.toThrow();
		});

		it("accepts message with all optional fields", () => {
			const fullData = {
				chatId: "chat_123",
				userMessage: {
					id: "msg_user_123",
					content: "Hello, AI!",
					createdAt: new Date(),
				},
				assistantMessage: {
					id: "msg_asst_123",
					content: "Hello, human!",
					createdAt: new Date(),
				},
			};

			expect(() => sendMessageSchema.parse(fullData)).not.toThrow();
		});

		it("requires chatId", () => {
			const data = {
				userMessage: { content: "Hello" },
			};

			expect(() => sendMessageSchema.parse(data)).toThrow();
		});

		it("requires userMessage", () => {
			const data = {
				chatId: "chat_123",
			};

			expect(() => sendMessageSchema.parse(data)).toThrow();
		});

		it("requires userMessage.content", () => {
			const data = {
				chatId: "chat_123",
				userMessage: {},
			};

			expect(() => sendMessageSchema.parse(data)).toThrow();
		});

		it("assistantMessage is optional", () => {
			const data = {
				chatId: "chat_123",
				userMessage: { content: "Hello" },
			};

			expect(() => sendMessageSchema.parse(data)).not.toThrow();
		});

		it("validates nested schemas", () => {
			const invalidData = {
				chatId: "", // Invalid
				userMessage: {
					content: "", // Invalid
				},
			};

			expect(() => sendMessageSchema.parse(invalidData)).toThrow();
		});
	});

	// =============================================================================
	// Pagination Schema Tests
	// =============================================================================

	describe("paginationSchema", () => {
		it("accepts valid pagination data", () => {
			const validData = [
				{ cursor: "abc123", limit: 10 },
				{ limit: 50 },
				{},
			];

			for (const data of validData) {
				expect(() => paginationSchema.parse(data)).not.toThrow();
			}
		});

		it("uses default limit of 50", () => {
			const result = paginationSchema.parse({});
			expect(result.limit).toBe(50);
		});

		it("accepts custom limit", () => {
			const result = paginationSchema.parse({ limit: 25 });
			expect(result.limit).toBe(25);
		});

		it("rejects negative limit", () => {
			expect(() => paginationSchema.parse({ limit: -1 })).toThrow();
		});

		it("rejects zero limit", () => {
			expect(() => paginationSchema.parse({ limit: 0 })).toThrow();
		});

		it("rejects limit over 100", () => {
			expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
		});

		it("accepts limit at max", () => {
			const result = paginationSchema.parse({ limit: 100 });
			expect(result.limit).toBe(100);
		});

		it("rejects non-integer limit", () => {
			expect(() => paginationSchema.parse({ limit: 10.5 })).toThrow();
		});

		it("cursor is optional", () => {
			const result = paginationSchema.parse({ limit: 10 });
			expect(result.cursor).toBeUndefined();
		});
	});

	// =============================================================================
	// Safe Validate Tests
	// =============================================================================

	describe("safeValidate", () => {
		it("returns success for valid data", () => {
			const result = safeValidate(chatTitleSchema, "Valid Title");

			expect(result.success).toBe(true);
			if (result.success) {
				expect(result.data).toBe("Valid Title");
			}
		});

		it("returns error for invalid data", () => {
			const result = safeValidate(chatTitleSchema, "");

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error).toBeInstanceOf(ZodError);
			}
		});

		it("preserves type information", () => {
			const schema = z.object({
				name: z.string(),
				age: z.number(),
			});

			const result = safeValidate(schema, { name: "John", age: 30 });

			if (result.success) {
				expect(result.data.name).toBe("John");
				expect(result.data.age).toBe(30);
			}
		});

		it("handles complex schemas", () => {
			const result = safeValidate(sendMessageSchema, {
				chatId: "chat_123",
				userMessage: { content: "Hello" },
			});

			expect(result.success).toBe(true);
		});
	});

	// =============================================================================
	// Validation Error Response Tests
	// =============================================================================

	describe("createValidationErrorResponse", () => {
		const originalEnv = process.env.NODE_ENV;

		afterEach(() => {
			process.env.NODE_ENV = originalEnv;
		});

		it("returns generic error in production", async () => {
			process.env.NODE_ENV = "production";

			const schema = z.object({ email: z.string().email() });
			let error: ZodError;
			try {
				schema.parse({ email: "invalid" });
			} catch (e) {
				error = e as ZodError;
			}

			const response = createValidationErrorResponse(error!);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.error).toBe("Invalid input");
			expect(body.message).toContain("invalid data");
			expect(body.issues).toBeUndefined();
		});

		it("returns detailed errors in development", async () => {
			process.env.NODE_ENV = "development";

			const schema = z.object({ email: z.string().email() });
			let error: ZodError;
			try {
				schema.parse({ email: "invalid" });
			} catch (e) {
				error = e as ZodError;
			}

			const response = createValidationErrorResponse(error!);
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.error).toBe("Validation failed");
			expect(body.issues).toBeDefined();
			expect(Array.isArray(body.issues)).toBe(true);
		});

		it("includes custom headers", async () => {
			const schema = z.object({ test: z.string() });
			let error: ZodError;
			try {
				schema.parse({});
			} catch (e) {
				error = e as ZodError;
			}

			const response = createValidationErrorResponse(error!, {
				"X-Custom-Header": "test-value",
			});

			expect(response.headers.get("X-Custom-Header")).toBe("test-value");
			expect(response.headers.get("Content-Type")).toBe("application/json");
		});

		it("formats issue details correctly in development", async () => {
			process.env.NODE_ENV = "development";

			const schema = z.object({
				email: z.string().email(),
				age: z.number().min(18),
			});

			let error: ZodError;
			try {
				schema.parse({ email: "invalid", age: 10 });
			} catch (e) {
				error = e as ZodError;
			}

			const response = createValidationErrorResponse(error!);
			const body = await response.json();

			expect(body.issues).toHaveLength(2);
			expect(body.issues[0]).toHaveProperty("path");
			expect(body.issues[0]).toHaveProperty("message");
			expect(body.issues[0]).toHaveProperty("code");
		});
	});

	// =============================================================================
	// XSS Prevention Tests
	// =============================================================================

	describe("XSS prevention", () => {
		it("accepts and preserves HTML-like content in messages", () => {
			// Note: Zod doesn't sanitize by default, it validates format
			// XSS prevention happens at render time, not validation time
			const content = "<script>alert('xss')</script>";
			const result = messageContentSchema.parse(content);

			// Validation passes (content is stored as-is)
			expect(result).toBe(content);
			// Note: Sanitization should happen during rendering, not validation
		});

		it("accepts HTML entities", () => {
			const content = "&lt;div&gt;Hello&lt;/div&gt;";
			expect(() => messageContentSchema.parse(content)).not.toThrow();
		});

		it("accepts markdown with potential XSS", () => {
			const malicious = [
				"[Click me](javascript:alert('xss'))",
				"![image](onerror=alert('xss'))",
				"<img src=x onerror=alert('xss')>",
			];

			for (const content of malicious) {
				// Validation should pass - sanitization happens at render time
				expect(() => messageContentSchema.parse(content)).not.toThrow();
			}
		});

		it("validates chat titles with HTML-like content", () => {
			const titles = [
				"<Chat> Title",
				"Title & Description",
				"Title > Description",
			];

			for (const title of titles) {
				expect(() => chatTitleSchema.parse(title)).not.toThrow();
			}
		});
	});

	// =============================================================================
	// SQL Injection Prevention Tests
	// =============================================================================

	describe("SQL injection prevention", () => {
		it("accepts SQL-like strings in content", () => {
			// Note: Convex is schemaless and doesn't use SQL
			// These are just valid strings that should be accepted
			const sqlInjections = [
				"'; DROP TABLE users; --",
				"1' OR '1'='1",
				"admin'--",
				"' UNION SELECT * FROM passwords--",
			];

			for (const content of sqlInjections) {
				expect(() => messageContentSchema.parse(content)).not.toThrow();
			}
		});

		it("validates IDs don't contain SQL injection patterns", () => {
			const maliciousIds = [
				"id'; DROP TABLE--",
				"1' OR '1'='1",
				"admin'--",
			];

			// These should fail because of invalid characters, not SQL injection
			for (const id of maliciousIds) {
				expect(() => convexIdSchema.parse(id)).toThrow("Invalid ID format");
			}
		});
	});

	// =============================================================================
	// Edge Cases Tests
	// =============================================================================

	describe("edge cases", () => {
		it("handles Unicode characters in titles", () => {
			const unicodeTitles = [
				"日本語のタイトル",
				"Título en español",
				"Название на русском",
				"عنوان بالعربية",
				"中文标题",
			];

			for (const title of unicodeTitles) {
				expect(() => chatTitleSchema.parse(title)).not.toThrow();
			}
		});

		it("handles emojis in content", () => {
			const emojiContent = "Hello 👋 World 🌍 How are you? 😊";
			expect(() => messageContentSchema.parse(emojiContent)).not.toThrow();
		});

		it("handles zero-width characters", () => {
			const content = "Hello\u200B\u200C\u200DWorld";
			expect(() => messageContentSchema.parse(content)).not.toThrow();
		});

		it("handles RTL text", () => {
			const rtl = "مرحبا بك في المحادثة";
			expect(() => messageContentSchema.parse(rtl)).not.toThrow();
		});

		it("handles mixed direction text", () => {
			const mixed = "English text with עברית and العربية";
			expect(() => messageContentSchema.parse(mixed)).not.toThrow();
		});

		it("handles control characters", () => {
			const withControls = "Line1\nLine2\tTabbed\rCarriage";
			expect(() => messageContentSchema.parse(withControls)).not.toThrow();
		});
	});

	// =============================================================================
	// Complex Validation Scenarios
	// =============================================================================

	describe("complex validation scenarios", () => {
		it("validates complete message send with all fields", () => {
			const data = {
				chatId: "chat_abc123",
				userMessage: {
					id: "msg_user_123",
					content: "What is the meaning of life?",
					createdAt: "2024-01-01T12:00:00Z",
				},
				assistantMessage: {
					id: "msg_asst_456",
					content: "42",
					createdAt: 1704110400000,
				},
			};

			expect(() => sendMessageSchema.parse(data)).not.toThrow();
		});

		it("handles nested validation errors", () => {
			const data = {
				chatId: "invalid!id",
				userMessage: {
					content: "", // Invalid
				},
			};

			const result = safeValidate(sendMessageSchema, data);
			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.length).toBeGreaterThan(0);
			}
		});

		it("transforms data correctly", () => {
			const input = { title: "  Trimmed Title  " };
			const result = createChatSchema.parse(input);
			expect(result.title).toBe("Trimmed Title");
		});

		it("applies defaults correctly", () => {
			const result1 = createChatSchema.parse({});
			expect(result1.title).toBe("New Chat");

			const result2 = paginationSchema.parse({});
			expect(result2.limit).toBe(50);
		});
	});

	// =============================================================================
	// Type Safety Tests
	// =============================================================================

	describe("type safety", () => {
		it("infers correct types from schemas", () => {
			const chatData = createChatSchema.parse({ title: "Test" });
			// TypeScript ensures chatData has correct type
			expect(chatData).toHaveProperty("title");

			const paginationData = paginationSchema.parse({ limit: 10 });
			expect(paginationData).toHaveProperty("limit");
		});

		it("validates discriminated unions correctly", () => {
			const result = safeValidate(timestampSchema, new Date());
			if (result.success) {
				// TypeScript knows result.data is string | Date | number
				expect(result.data).toBeInstanceOf(Date);
			}
		});
	});

	// =============================================================================
	// Real-world Integration Tests
	// =============================================================================

	describe("real-world scenarios", () => {
		it("validates typical chat creation flow", () => {
			const step1 = createChatSchema.parse({});
			expect(step1.title).toBe("New Chat");

			const step2 = sendMessageSchema.parse({
				chatId: "new_chat_123",
				userMessage: {
					content: "Hello, this is my first message!",
				},
			});
			expect(step2.chatId).toBe("new_chat_123");
		});

		it("validates pagination through multiple pages", () => {
			const page1 = paginationSchema.parse({ limit: 25 });
			expect(page1.limit).toBe(25);

			const page2 = paginationSchema.parse({
				cursor: "cursor_from_page1",
				limit: 25,
			});
			expect(page2.cursor).toBe("cursor_from_page1");
		});

		it("validates complete message exchange", () => {
			const messages = [
				{
					chatId: "chat_123",
					userMessage: { content: "Hello!" },
				},
				{
					chatId: "chat_123",
					userMessage: { content: "How are you?" },
					assistantMessage: { content: "I'm doing well, thanks!" },
				},
			];

			for (const msg of messages) {
				expect(() => sendMessageSchema.parse(msg)).not.toThrow();
			}
		});
	});
});
