/**
 * Unit Tests for Audit Logger
 *
 * Tests audit event logging, request metadata extraction, and convenience functions.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	auditLog,
	setAuditLogStore,
	getRequestMetadata,
	auditChatDelete,
	auditChatCreate,
	auditUserCreate,
	auditUserUpdate,
	auditApiKeyCreate,
	auditApiKeyDelete,
	auditAuthFailure,
	auditAuthzDenied,
	type AuditEvent,
} from "../audit-logger";

describe("auditLog", () => {
	let capturedEvents: AuditEvent[] = [];

	beforeEach(() => {
		capturedEvents = [];
		setAuditLogStore({
			write: (event: AuditEvent) => {
				capturedEvents.push(event);
			},
		});
	});

	it("should log audit event with all fields", async () => {
		// Arrange & Act
		await auditLog({
			event: "chat.delete",
			userId: "user_123",
			resourceId: "chat_456",
			ipAddress: "192.168.1.1",
			userAgent: "Mozilla/5.0",
			status: "success",
		});

		// Assert
		expect(capturedEvents).toHaveLength(1);
		expect(capturedEvents[0]).toMatchObject({
			event: "chat.delete",
			userId: "user_123",
			resourceId: "chat_456",
			ipAddress: "192.168.1.1",
			userAgent: "Mozilla/5.0",
			status: "success",
		});
		expect(capturedEvents[0]!.timestamp).toBeDefined();
	});

	it("should log event without optional fields", async () => {
		// Arrange & Act
		await auditLog({
			event: "auth.login",
			status: "success",
		});

		// Assert
		expect(capturedEvents).toHaveLength(1);
		expect(capturedEvents[0]).toMatchObject({
			event: "auth.login",
			status: "success",
		});
		expect(capturedEvents[0]!.userId).toBeUndefined();
		expect(capturedEvents[0]!.ipAddress).toBeUndefined();
	});

	it("should include metadata when provided", async () => {
		// Arrange & Act
		await auditLog({
			event: "user.update",
			userId: "user_123",
			targetUserId: "user_456",
			status: "success",
			metadata: {
				changes: ["email", "name"],
				reason: "user request",
			},
		});

		// Assert
		expect(capturedEvents[0]!.metadata).toEqual({
			changes: ["email", "name"],
			reason: "user request",
		});
	});

	it("should include error message for failures", async () => {
		// Arrange & Act
		await auditLog({
			event: "auth.failed",
			userId: "user_123",
			status: "failure",
			error: "Invalid password",
		});

		// Assert
		expect(capturedEvents[0]).toMatchObject({
			event: "auth.failed",
			status: "failure",
			error: "Invalid password",
		});
	});

	it("should generate ISO 8601 timestamp", async () => {
		// Arrange & Act
		await auditLog({
			event: "chat.create",
			userId: "user_123",
			status: "success",
		});

		// Assert
		expect(capturedEvents[0]!.timestamp).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
		);
	});

	it("should handle store write errors gracefully", async () => {
		// Arrange
		setAuditLogStore({
			write: () => {
				throw new Error("Store error");
			},
		});

		// Act & Assert - Should not throw
		await expect(
			auditLog({
				event: "chat.create",
				userId: "user_123",
				status: "success",
			}),
		).resolves.toBeUndefined();
	});

	it("should handle async store implementations", async () => {
		// Arrange
		let resolved = false;
		setAuditLogStore({
			write: async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				resolved = true;
			},
		});

		// Act
		await auditLog({
			event: "chat.create",
			userId: "user_123",
			status: "success",
		});

		// Assert
		expect(resolved).toBe(true);
	});

	it("should include targetUserId for admin actions", async () => {
		// Arrange & Act
		await auditLog({
			event: "user.update",
			userId: "admin_123",
			targetUserId: "user_456",
			status: "success",
		});

		// Assert
		expect(capturedEvents[0]).toMatchObject({
			userId: "admin_123",
			targetUserId: "user_456",
		});
	});
});

describe("getRequestMetadata", () => {
	it("should extract IP from x-forwarded-for", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-forwarded-for": "192.168.1.1, 10.0.0.1",
				"user-agent": "Mozilla/5.0",
			},
		});

		// Act
		const metadata = getRequestMetadata(request);

		// Assert
		expect(metadata.ipAddress).toBe("192.168.1.1");
		expect(metadata.userAgent).toBe("Mozilla/5.0");
	});

	it("should extract IP from x-real-ip when x-forwarded-for missing", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-real-ip": "192.168.1.1",
			},
		});

		// Act
		const metadata = getRequestMetadata(request);

		// Assert
		expect(metadata.ipAddress).toBe("192.168.1.1");
	});

	it("should use hostname as fallback", () => {
		// Arrange
		const request = new Request("http://example.com:3000");

		// Act
		const metadata = getRequestMetadata(request);

		// Assert
		expect(metadata.ipAddress).toBe("example.com");
	});

	it("should return unknown for invalid URL", () => {
		// Arrange
		const request = new Request("http://localhost:3000");

		// Act
		const metadata = getRequestMetadata(request);

		// Assert
		expect(metadata.ipAddress).toBeDefined();
	});

	it("should handle missing user-agent", () => {
		// Arrange
		const request = new Request("http://localhost:3000");

		// Act
		const metadata = getRequestMetadata(request);

		// Assert
		expect(metadata.userAgent).toBeUndefined();
	});

	it("should trim whitespace from IPs", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-forwarded-for": "  192.168.1.1  , 10.0.0.1",
			},
		});

		// Act
		const metadata = getRequestMetadata(request);

		// Assert
		expect(metadata.ipAddress).toBe("192.168.1.1");
	});

	it("should prefer x-forwarded-for over x-real-ip", () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			headers: {
				"x-forwarded-for": "192.168.1.1",
				"x-real-ip": "10.0.0.1",
			},
		});

		// Act
		const metadata = getRequestMetadata(request);

		// Assert
		expect(metadata.ipAddress).toBe("192.168.1.1");
	});
});

describe("Convenience Functions", () => {
	let capturedEvents: AuditEvent[] = [];

	beforeEach(() => {
		capturedEvents = [];
		setAuditLogStore({
			write: (event: AuditEvent) => {
				capturedEvents.push(event);
			},
		});
	});

	describe("auditChatDelete", () => {
		it("should log chat deletion", async () => {
			// Arrange & Act
			await auditChatDelete({
				userId: "user_123",
				chatId: "chat_456",
				ipAddress: "192.168.1.1",
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "chat.delete",
				userId: "user_123",
				resourceId: "chat_456",
				ipAddress: "192.168.1.1",
				status: "success",
			});
		});
	});

	describe("auditChatCreate", () => {
		it("should log chat creation", async () => {
			// Arrange & Act
			await auditChatCreate({
				userId: "user_123",
				chatId: "chat_456",
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "chat.create",
				userId: "user_123",
				resourceId: "chat_456",
				status: "success",
			});
		});
	});

	describe("auditUserCreate", () => {
		it("should log user creation", async () => {
			// Arrange & Act
			await auditUserCreate({
				userId: "user_123",
				email: "user@example.com",
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "user.create",
				userId: "user_123",
				status: "success",
			});
			expect(capturedEvents[0]!.metadata?.email).toBe("user@example.com");
		});

		it("should work without email", async () => {
			// Arrange & Act
			await auditUserCreate({
				userId: "user_123",
			});

			// Assert
			expect(capturedEvents[0]!.metadata).toBeUndefined();
		});
	});

	describe("auditUserUpdate", () => {
		it("should log user update", async () => {
			// Arrange & Act
			await auditUserUpdate({
				userId: "admin_123",
				targetUserId: "user_456",
				changes: ["email", "name"],
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "user.update",
				userId: "admin_123",
				targetUserId: "user_456",
				status: "success",
			});
			expect(capturedEvents[0]!.metadata?.changes).toEqual(["email", "name"]);
		});
	});

	describe("auditApiKeyCreate", () => {
		it("should log API key creation", async () => {
			// Arrange & Act
			await auditApiKeyCreate({
				userId: "user_123",
				keyId: "key_456",
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "apikey.create",
				userId: "user_123",
				resourceId: "key_456",
				status: "success",
			});
		});
	});

	describe("auditApiKeyDelete", () => {
		it("should log API key deletion", async () => {
			// Arrange & Act
			await auditApiKeyDelete({
				userId: "user_123",
				keyId: "key_456",
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "apikey.delete",
				userId: "user_123",
				resourceId: "key_456",
				status: "success",
			});
		});
	});

	describe("auditAuthFailure", () => {
		it("should log authentication failure", async () => {
			// Arrange & Act
			await auditAuthFailure({
				userId: "user_123",
				ipAddress: "192.168.1.1",
				reason: "Invalid password",
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "auth.failed",
				userId: "user_123",
				ipAddress: "192.168.1.1",
				status: "failure",
				error: "Invalid password",
			});
		});

		it("should work without userId", async () => {
			// Arrange & Act
			await auditAuthFailure({
				reason: "Account not found",
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "auth.failed",
				status: "failure",
				error: "Account not found",
			});
			expect(capturedEvents[0]!.userId).toBeUndefined();
		});
	});

	describe("auditAuthzDenied", () => {
		it("should log authorization denial", async () => {
			// Arrange & Act
			await auditAuthzDenied({
				userId: "user_123",
				resource: "admin_panel",
				action: "view",
			});

			// Assert
			expect(capturedEvents[0]).toMatchObject({
				event: "authz.denied",
				userId: "user_123",
				status: "denied",
			});
			expect(capturedEvents[0]!.metadata).toEqual({
				resource: "admin_panel",
				action: "view",
			});
		});
	});
});

describe("Custom Audit Store", () => {
	it("should allow custom store implementation", async () => {
		// Arrange
		const events: AuditEvent[] = [];
		const customStore = {
			write: (event: AuditEvent) => {
				events.push(event);
			},
		};
		setAuditLogStore(customStore);

		// Act
		await auditLog({
			event: "chat.create",
			userId: "user_123",
			status: "success",
		});

		// Assert
		expect(events).toHaveLength(1);
	});

	it("should work with async custom store", async () => {
		// Arrange
		const events: AuditEvent[] = [];
		const customStore = {
			write: async (event: AuditEvent) => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				events.push(event);
			},
		};
		setAuditLogStore(customStore);

		// Act
		await auditLog({
			event: "chat.create",
			userId: "user_123",
			status: "success",
		});

		// Assert
		expect(events).toHaveLength(1);
	});
});
