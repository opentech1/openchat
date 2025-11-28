/**
 * Type-safe converter utilities for Convex ID types.
 *
 * This module provides runtime-validated type converters to eliminate unsafe
 * `as any` casts when working with Convex IDs. All converters validate the
 * ID format before conversion and throw descriptive errors on invalid input.
 *
 * @module type-converters
 */

import type { Id, TableNames } from "@server/convex/_generated/dataModel";

/**
 * Regular expression pattern for valid Convex ID format.
 * Convex IDs are base32-encoded strings with a specific format.
 *
 * Pattern breakdown:
 * - Starts with table-specific prefix (e.g., 'jd7', 'jh7')
 * - Followed by alphanumeric characters (base32 encoded)
 * - Typically 15-20 characters in length
 */
const CONVEX_ID_PATTERN = /^[a-z0-9]{15,32}$/i;

/**
 * Error thrown when an invalid Convex ID is encountered.
 */
export class InvalidConvexIdError extends Error {
  constructor(
    public readonly invalidId: string,
    public readonly tableName?: string,
    message?: string
  ) {
    super(
      message ||
        `Invalid Convex ID format: "${invalidId}"${tableName ? ` for table "${tableName}"` : ""}`
    );
    this.name = "InvalidConvexIdError";
  }
}

/**
 * Validates whether a string matches the expected Convex ID format.
 *
 * @param id - The string to validate
 * @returns True if the string is a valid Convex ID format, false otherwise
 *
 * @example
 * ```typescript
 * isValidConvexId("jd7abc123def456"); // true
 * isValidConvexId("invalid-id");      // false
 * isValidConvexId("");                // false
 * ```
 */
export function isValidConvexId(id: string): boolean {
  if (typeof id !== "string" || id.length === 0) {
    return false;
  }
  return CONVEX_ID_PATTERN.test(id);
}

/**
 * Type-safe converter that throws an error if the ID is invalid.
 * Use this when you expect the ID to always be valid.
 *
 * @template T - The table name type
 * @param id - The string ID to convert
 * @param tableName - The target table name (for better error messages)
 * @returns The validated ID typed for the specified table
 * @throws {InvalidConvexIdError} If the ID format is invalid
 *
 * @example
 * ```typescript
 * const userId = toConvexId("jd7abc123def456", "users");
 * // userId is typed as Id<"users">
 *
 * toConvexId("invalid", "users"); // throws InvalidConvexIdError
 * ```
 */
export function toConvexId<T extends TableNames>(
  id: string,
  tableName: T
): Id<T> {
  if (!isValidConvexId(id)) {
    throw new InvalidConvexIdError(id, tableName);
  }
  return id as Id<T>;
}

/**
 * Safe converter that returns null if the ID is invalid.
 * Use this when the ID might be invalid and you want to handle it gracefully.
 *
 * @template T - The table name type
 * @param id - The string ID to convert
 * @param tableName - The target table name (for validation)
 * @returns The validated ID or null if invalid
 *
 * @example
 * ```typescript
 * const userId = safeToConvexId("jd7abc123def456", "users");
 * // userId is Id<"users"> | null
 *
 * if (userId) {
 *   // Safe to use userId here
 * }
 * ```
 */
export function safeToConvexId<T extends TableNames>(
  id: string,
  _tableName: T
): Id<T> | null {
  if (!isValidConvexId(id)) {
    return null;
  }
  return id as Id<T>;
}

/**
 * Converts a string to a users table ID with validation.
 *
 * @param id - The string ID to convert
 * @returns The validated users table ID
 * @throws {InvalidConvexIdError} If the ID format is invalid
 *
 * @example
 * ```typescript
 * const userId = toConvexUserId("jd7abc123def456");
 * ```
 */
export function toConvexUserId(id: string): Id<"users"> {
  return toConvexId(id, "users");
}

/**
 * Converts a string to a chats table ID with validation.
 *
 * @param id - The string ID to convert
 * @returns The validated chats table ID
 * @throws {InvalidConvexIdError} If the ID format is invalid
 *
 * @example
 * ```typescript
 * const chatId = toConvexChatId("jh7xyz789ghi012");
 * ```
 */
export function toConvexChatId(id: string): Id<"chats"> {
  return toConvexId(id, "chats");
}

/**
 * Converts a string to a messages table ID with validation.
 *
 * @param id - The string ID to convert
 * @returns The validated messages table ID
 * @throws {InvalidConvexIdError} If the ID format is invalid
 *
 * @example
 * ```typescript
 * const messageId = toConvexMessageId("jm7pqr345stu678");
 * ```
 */
export function toConvexMessageId(id: string): Id<"messages"> {
  return toConvexId(id, "messages");
}

/**
 * Converts a string to a storage table ID with validation.
 * Storage IDs use the special "_storage" system table.
 *
 * @param id - The string ID to convert
 * @returns The validated storage table ID
 * @throws {InvalidConvexIdError} If the ID format is invalid
 *
 * @example
 * ```typescript
 * const storageId = toConvexStorageId("js7mno901vwx234");
 * ```
 */
export function toConvexStorageId(id: string): Id<"_storage"> {
  if (!isValidConvexId(id)) {
    throw new InvalidConvexIdError(id, "_storage");
  }
  return id as Id<"_storage">;
}

/**
 * Batch converter for arrays of IDs.
 * Validates all IDs and returns a typed array, or throws on the first invalid ID.
 *
 * @template T - The table name type
 * @param ids - Array of string IDs to convert
 * @param tableName - The target table name
 * @returns Array of validated IDs
 * @throws {InvalidConvexIdError} If any ID format is invalid
 *
 * @example
 * ```typescript
 * const userIds = toConvexIds(["jd7abc", "jd7def", "jd7ghi"], "users");
 * ```
 */
export function toConvexIds<T extends TableNames>(
  ids: string[],
  tableName: T
): Id<T>[] {
  return ids.map((id) => toConvexId(id, tableName));
}

/**
 * Safe batch converter that filters out invalid IDs.
 * Returns only valid IDs, skipping any that don't pass validation.
 *
 * @template T - The table name type
 * @param ids - Array of string IDs to convert
 * @param tableName - The target table name
 * @returns Array of validated IDs (may be shorter than input)
 *
 * @example
 * ```typescript
 * const userIds = safeToConvexIds(
 *   ["jd7valid", "invalid", "jd7alsovalid"],
 *   "users"
 * );
 * // Returns only ["jd7valid", "jd7alsovalid"]
 * ```
 */
export function safeToConvexIds<T extends TableNames>(
  ids: string[],
  tableName: T
): Id<T>[] {
  return ids
    .map((id) => safeToConvexId(id, tableName))
    .filter((id): id is Id<T> => id !== null);
}

/**
 * Type guard to check if a value is a valid Convex ID at runtime.
 * Useful for narrowing types in conditional logic.
 *
 * @template T - The table name type
 * @param value - The value to check
 * @param tableName - Optional table name for additional context
 * @returns True if value is a valid Convex ID
 *
 * @example
 * ```typescript
 * function processId(id: string | Id<"users">) {
 *   if (isConvexId(id, "users")) {
 *     // id is narrowed to Id<"users">
 *     return id;
 *   }
 * }
 * ```
 */
export function isConvexId<T extends TableNames>(
  value: unknown,
  _tableName?: T
): value is Id<T> {
  return typeof value === "string" && isValidConvexId(value);
}
