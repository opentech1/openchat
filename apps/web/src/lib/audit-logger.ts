/**
 * Audit Logger
 *
 * Logs security-relevant actions for compliance, forensics, and monitoring.
 * Audit logs should be immutable, tamper-evident, and retained according to policy.
 *
 * Events logged:
 * - Chat deletion
 * - User account changes (creation, deletion, email change)
 * - API key changes (creation, rotation, deletion)
 * - Authentication events (login, logout, failed attempts)
 * - Authorization failures
 *
 * For production:
 * - Store logs in a separate, secured database or service
 * - Implement log rotation and retention policies
 * - Set up alerts for suspicious patterns
 * - Consider using a SIEM (Security Information and Event Management) system
 */

import { logInfo, logWarn, logError } from "./logger-server";

export type AuditEventType =
	| "chat.delete"
	| "chat.create"
	| "user.create"
	| "user.delete"
	| "user.update"
	| "apikey.create"
	| "apikey.delete"
	| "apikey.rotate"
	| "auth.login"
	| "auth.logout"
	| "auth.failed"
	| "authz.denied";

export type AuditEventStatus = "success" | "failure" | "denied";

export interface AuditEvent {
	/** Type of event */
	event: AuditEventType;
	/** User ID performing the action (if authenticated) */
	userId?: string;
	/** Target user ID (for admin actions on other users) */
	targetUserId?: string;
	/** Resource ID (chat ID, API key ID, etc.) */
	resourceId?: string;
	/** IP address of the client */
	ipAddress?: string;
	/** User agent string */
	userAgent?: string;
	/** Event status */
	status: AuditEventStatus;
	/** Additional contextual metadata (non-PII) */
	metadata?: Record<string, unknown>;
	/** Error message if status is failure */
	error?: string;
	/** Timestamp (ISO 8601) */
	timestamp: string;
}

/**
 * Audit log storage interface
 * Default implementation logs to console/file, but can be extended to use:
 * - Database (PostgreSQL, MongoDB)
 * - Cloud logging (CloudWatch, Stackdriver, Azure Monitor)
 * - SIEM systems (Splunk, ELK Stack)
 * - Audit log services (AWS CloudTrail, Azure Activity Log)
 */
interface AuditLogStore {
	write(event: AuditEvent): Promise<void> | void;
}

/**
 * Console-based audit log store (default)
 * Logs to structured JSON for easy parsing by log aggregators
 */
class ConsoleAuditLogStore implements AuditLogStore {
	write(event: AuditEvent): void {
		// Use structured logging with a clear prefix for filtering
		const logEntry = {
			type: "AUDIT",
			...event,
		};

		// Log at appropriate level based on status
		switch (event.status) {
			case "failure":
			case "denied":
				logWarn("Audit event", logEntry);
				break;
			case "success":
				logInfo("Audit event", logEntry);
				break;
			default:
				logInfo("Audit event", logEntry);
		}
	}
}

// Singleton store instance
let auditStore: AuditLogStore = new ConsoleAuditLogStore();

/**
 * Set custom audit log store
 * Use this to configure database or cloud logging
 */
export function setAuditLogStore(store: AuditLogStore): void {
	auditStore = store;
}

/**
 * Log an audit event
 *
 * @param params - Audit event parameters
 *
 * @example
 * ```typescript
 * await auditLog({
 *   event: "chat.delete",
 *   userId: "user_123",
 *   resourceId: "chat_456",
 *   ipAddress: "192.168.1.1",
 *   status: "success"
 * });
 * ```
 */
export async function auditLog(params: {
	event: AuditEventType;
	userId?: string;
	targetUserId?: string;
	resourceId?: string;
	ipAddress?: string;
	userAgent?: string;
	status: AuditEventStatus;
	metadata?: Record<string, unknown>;
	error?: string;
}): Promise<void> {
	const event: AuditEvent = {
		event: params.event,
		userId: params.userId,
		targetUserId: params.targetUserId,
		resourceId: params.resourceId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: params.status,
		metadata: params.metadata,
		error: params.error,
		timestamp: new Date().toISOString(),
	};

	try {
		await auditStore.write(event);
	} catch (error) {
		// Never let audit logging break the application
		// But log the error so we know audit logging is broken
		logError("Failed to write audit log", error);
	}
}

/**
 * Helper to extract IP and user agent from request
 */
export function getRequestMetadata(request: Request): {
	ipAddress: string;
	userAgent?: string;
} {
	// Extract IP (prefer x-forwarded-for if behind proxy)
	let ipAddress = "unknown";
	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		ipAddress = forwarded.split(",")[0]!.trim();
	} else {
		const realIp = request.headers.get("x-real-ip");
		if (realIp) {
			ipAddress = realIp.trim();
		} else {
			try {
				const url = new URL(request.url);
				ipAddress = url.hostname;
			} catch {
				ipAddress = "unknown";
			}
		}
	}

	const userAgent = request.headers.get("user-agent") ?? undefined;

	return { ipAddress, userAgent };
}

/**
 * Convenience functions for common audit events
 */

export async function auditChatDelete(params: {
	userId: string;
	chatId: string;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	await auditLog({
		event: "chat.delete",
		userId: params.userId,
		resourceId: params.chatId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: "success",
	});
}

export async function auditChatCreate(params: {
	userId: string;
	chatId: string;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	await auditLog({
		event: "chat.create",
		userId: params.userId,
		resourceId: params.chatId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: "success",
	});
}

export async function auditUserCreate(params: {
	userId: string;
	ipAddress?: string;
	userAgent?: string;
	email?: string;
}): Promise<void> {
	await auditLog({
		event: "user.create",
		userId: params.userId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: "success",
		metadata: params.email ? { email: params.email } : undefined,
	});
}

export async function auditUserUpdate(params: {
	userId: string;
	targetUserId: string;
	ipAddress?: string;
	userAgent?: string;
	changes?: string[];
}): Promise<void> {
	await auditLog({
		event: "user.update",
		userId: params.userId,
		targetUserId: params.targetUserId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: "success",
		metadata: params.changes ? { changes: params.changes } : undefined,
	});
}

export async function auditApiKeyCreate(params: {
	userId: string;
	keyId: string;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	await auditLog({
		event: "apikey.create",
		userId: params.userId,
		resourceId: params.keyId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: "success",
	});
}

export async function auditApiKeyDelete(params: {
	userId: string;
	keyId: string;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	await auditLog({
		event: "apikey.delete",
		userId: params.userId,
		resourceId: params.keyId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: "success",
	});
}

export async function auditAuthFailure(params: {
	userId?: string;
	ipAddress?: string;
	userAgent?: string;
	reason: string;
}): Promise<void> {
	await auditLog({
		event: "auth.failed",
		userId: params.userId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: "failure",
		error: params.reason,
	});
}

export async function auditAuthzDenied(params: {
	userId: string;
	resource: string;
	action: string;
	ipAddress?: string;
	userAgent?: string;
}): Promise<void> {
	await auditLog({
		event: "authz.denied",
		userId: params.userId,
		ipAddress: params.ipAddress,
		userAgent: params.userAgent,
		status: "denied",
		metadata: {
			resource: params.resource,
			action: params.action,
		},
	});
}
