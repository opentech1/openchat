/**
 * Helper types and type guards for working with Convex data structures.
 *
 * This module provides common type patterns and runtime validation utilities
 * for Convex entities, making it easier to work with data from the database
 * in a type-safe manner.
 *
 * @module convex-types
 */

import type { Id, Doc, TableNames } from "@server/convex/_generated/dataModel";

/**
 * Represents a file attachment stored in Convex.
 * This is the standard shape used across the application for file references.
 */
export type ConvexFileAttachment = {
  /** Storage ID reference to the file in Convex _storage */
  storageId: Id<"_storage">;
  /** Original filename */
  filename: string;
  /** MIME type of the file */
  contentType: string;
  /** File size in bytes */
  size: number;
  /** Timestamp when the file was uploaded (milliseconds since epoch) */
  uploadedAt: number;
  /** Optional pre-signed URL for accessing the file (temporary) */
  url?: string;
};

/**
 * Represents a chat message with optional attachments.
 * Extends the base Convex message document with typed attachment field.
 */
export type MessageWithAttachments = Doc<"messages"> & {
  attachments?: ConvexFileAttachment[];
};

/**
 * Helper type for partial updates to Convex documents.
 * Useful when updating only specific fields of a document.
 *
 * @template T - The table name
 */
export type PartialDoc<T extends TableNames> = Partial<Omit<Doc<T>, "_id" | "_creationTime">>;

/**
 * Helper type for creating new Convex documents.
 * Excludes system fields that are auto-generated.
 *
 * @template T - The table name
 */
export type NewDoc<T extends TableNames> = Omit<Doc<T>, "_id" | "_creationTime">;

/**
 * Type guard to check if a value is a valid Convex document ID.
 * Checks both the type and the ID format.
 *
 * @param value - The value to check
 * @returns True if value is a valid Convex ID string
 *
 * @example
 * ```typescript
 * if (isDocumentId(someValue)) {
 *   // someValue is narrowed to string and validated
 *   const doc = await db.get(someValue as Id<"users">);
 * }
 * ```
 */
export function isDocumentId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && /^[a-z0-9]+$/i.test(value);
}

/**
 * Type guard to check if a value is a valid file attachment object.
 *
 * @param value - The value to check
 * @returns True if value matches ConvexFileAttachment structure
 *
 * @example
 * ```typescript
 * if (isFileAttachment(attachment)) {
 *   // attachment is typed as ConvexFileAttachment
 *   console.log(attachment.filename);
 * }
 * ```
 */
export function isFileAttachment(value: unknown): value is ConvexFileAttachment {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    typeof obj.storageId === "string" &&
    typeof obj.filename === "string" &&
    typeof obj.contentType === "string" &&
    typeof obj.size === "number" &&
    typeof obj.uploadedAt === "number" &&
    (obj.url === undefined || typeof obj.url === "string")
  );
}

/**
 * Type guard to check if an array contains only file attachments.
 *
 * @param value - The array to check
 * @returns True if all elements are valid file attachments
 *
 * @example
 * ```typescript
 * if (isFileAttachmentArray(attachments)) {
 *   // attachments is ConvexFileAttachment[]
 *   attachments.forEach(a => console.log(a.filename));
 * }
 * ```
 */
export function isFileAttachmentArray(
  value: unknown
): value is ConvexFileAttachment[] {
  return Array.isArray(value) && value.every(isFileAttachment);
}

/**
 * Helper to safely extract an ID from a document or ID value.
 * Useful when you might receive either a full document or just an ID.
 *
 * @template T - The table name
 * @param docOrId - Either a document or an ID
 * @returns The ID
 *
 * @example
 * ```typescript
 * const userId = extractId(userDocOrId);
 * ```
 */
export function extractId<T extends TableNames>(
  docOrId: Doc<T> | Id<T>
): Id<T> {
  if (typeof docOrId === "string") {
    return docOrId;
  }
  return docOrId._id;
}

/**
 * Helper to safely get a document ID if it exists.
 * Returns null if the value is not a valid document.
 *
 * @template T - The table name
 * @param doc - Optional document
 * @returns The ID or null
 *
 * @example
 * ```typescript
 * const userId = getDocumentId(maybeUser);
 * if (userId) {
 *   // Use userId safely
 * }
 * ```
 */
export function getDocumentId<T extends TableNames>(
  doc: Doc<T> | null | undefined
): Id<T> | null {
  return doc?._id ?? null;
}

/**
 * Type guard to check if a message has attachments.
 * Narrows the type to include the attachments array.
 *
 * @param message - The message to check
 * @returns True if message has valid attachments array
 *
 * @example
 * ```typescript
 * if (hasAttachments(message)) {
 *   // message.attachments is ConvexFileAttachment[]
 *   message.attachments.forEach(a => console.log(a.filename));
 * }
 * ```
 */
export function hasAttachments(
  message: Doc<"messages">
): message is MessageWithAttachments {
  const msg = message as MessageWithAttachments;
  return (
    msg.attachments !== undefined &&
    Array.isArray(msg.attachments) &&
    msg.attachments.length > 0
  );
}

/**
 * Common status values for messages.
 * These represent the lifecycle of a message in the system.
 */
export type MessageStatus = "pending" | "streaming" | "completed" | "error";

/**
 * Type guard to check if a string is a valid message status.
 *
 * @param value - The value to check
 * @returns True if value is a valid MessageStatus
 *
 * @example
 * ```typescript
 * if (isMessageStatus(status)) {
 *   // status is narrowed to MessageStatus
 * }
 * ```
 */
export function isMessageStatus(value: unknown): value is MessageStatus {
  return (
    typeof value === "string" &&
    ["pending", "streaming", "completed", "error"].includes(value)
  );
}

/**
 * Common role values for messages.
 */
export type MessageRole = "user" | "assistant" | "system";

/**
 * Type guard to check if a string is a valid message role.
 *
 * @param value - The value to check
 * @returns True if value is a valid MessageRole
 *
 * @example
 * ```typescript
 * if (isMessageRole(role)) {
 *   // role is narrowed to MessageRole
 * }
 * ```
 */
export function isMessageRole(value: unknown): value is MessageRole {
  return typeof value === "string" && ["user", "assistant", "system"].includes(value);
}

/**
 * Helper to create a file attachment object with validation.
 * Ensures all required fields are present and properly typed.
 *
 * @param params - Attachment parameters
 * @returns Validated file attachment
 * @throws {Error} If required fields are missing or invalid
 *
 * @example
 * ```typescript
 * const attachment = createFileAttachment({
 *   storageId: "js7abc...",
 *   filename: "document.pdf",
 *   contentType: "application/pdf",
 *   size: 1024,
 *   uploadedAt: Date.now()
 * });
 * ```
 */
export function createFileAttachment(
  params: ConvexFileAttachment
): ConvexFileAttachment {
  if (!isFileAttachment(params)) {
    throw new Error("Invalid file attachment parameters");
  }
  return params;
}

/**
 * Helper to safely extract attachments from a message.
 * Returns an empty array if no attachments exist.
 *
 * @param message - The message to extract attachments from
 * @returns Array of attachments (may be empty)
 *
 * @example
 * ```typescript
 * const attachments = getMessageAttachments(message);
 * attachments.forEach(a => console.log(a.filename));
 * ```
 */
export function getMessageAttachments(
  message: Doc<"messages"> | MessageWithAttachments
): ConvexFileAttachment[] {
  const msg = message as MessageWithAttachments;
  return msg.attachments ?? [];
}
