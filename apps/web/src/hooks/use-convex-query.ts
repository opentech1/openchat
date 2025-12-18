import { useQuery, useMutation } from "convex/react";
import type { FunctionReference, FunctionArgs, FunctionReturnType } from "convex/server";

/**
 * Result type for useConvexQuery hook.
 * Provides a unified loading pattern across the codebase.
 */
export type ConvexQueryResult<T> = {
	/** The query data, undefined while loading or if skipped */
	data: T | undefined;
	/** True while the query is loading (data is undefined and not skipped) */
	isLoading: boolean;
	/** True if the query was skipped (args === "skip") */
	isSkipped: boolean;
};

/**
 * A wrapper around Convex's useQuery that provides a unified loading pattern.
 *
 * Unlike the native useQuery which only returns `undefined` during loading,
 * this hook provides explicit `isLoading` and `isSkipped` states for cleaner
 * conditional rendering.
 *
 * ## Error Handling
 *
 * Convex queries throw errors rather than returning them. Errors are handled
 * via React Error Boundaries. This is the standard Convex pattern - wrap your
 * components in an ErrorBoundary to catch query errors:
 *
 * ```tsx
 * <ErrorBoundary fallback={<ErrorMessage />}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 *
 * ## Understanding `undefined` vs `null` in Convex
 *
 * In Convex, `undefined` **always** means "loading". Queries should return
 * `null` for "no data found" cases. This distinction is important:
 *
 * - `data === undefined` → Query is still loading
 * - `data === null` → Query completed, no data found
 * - `data !== null && data !== undefined` → Query completed with data
 *
 * @param query - The Convex query function reference (e.g., `api.users.get`)
 * @param args - The query arguments, or "skip" to skip the query
 * @returns Object with `data`, `isLoading`, and `isSkipped` properties
 *
 * @example
 * ```tsx
 * import { useConvexQuery } from "@/hooks/use-convex-query";
 * import { api } from "@server/convex/_generated/api";
 *
 * function UserProfile({ userId }: { userId: string | null }) {
 *   const { data: user, isLoading, isSkipped } = useConvexQuery(
 *     api.users.getByExternalId,
 *     userId ? { externalId: userId } : "skip"
 *   );
 *
 *   if (isSkipped) return <LoginPrompt />;
 *   if (isLoading) return <LoadingSkeleton />;
 *   if (!user) return <UserNotFound />;
 *
 *   return <UserDetails user={user} />;
 * }
 * ```
 *
 * @example Migration from native useQuery
 * ```tsx
 * // Before (native Convex useQuery)
 * const user = useQuery(api.users.get, userId ? { id: userId } : "skip");
 * const isLoading = userId !== null && user === undefined;
 *
 * // After (useConvexQuery)
 * const { data: user, isLoading } = useConvexQuery(
 *   api.users.get,
 *   userId ? { id: userId } : "skip"
 * );
 * ```
 */
export function useConvexQuery<Query extends FunctionReference<"query">>(
	query: Query,
	args: FunctionArgs<Query> | "skip"
): ConvexQueryResult<FunctionReturnType<Query>> {
	const data = useQuery(query, args);
	const isSkipped = args === "skip";
	const isLoading = !isSkipped && data === undefined;

	return {
		data,
		isLoading,
		isSkipped,
	};
}

/**
 * Extended result type that includes common derived states.
 */
export type ConvexQueryResultExtended<T> = ConvexQueryResult<T> & {
	/** True if data has loaded and is not null/undefined */
	hasData: boolean;
	/** True if loading has finished (either loaded data, null result, or skipped) */
	isReady: boolean;
	/** True if the query returned null (item not found) */
	isNotFound: boolean;
};

/**
 * Extended version of useConvexQuery with additional derived states.
 *
 * This hook provides extra convenience properties for common conditional
 * rendering patterns:
 * - `hasData`: True when data exists (not undefined, not null)
 * - `isReady`: True when loading is complete (has result or skipped)
 * - `isNotFound`: True when query completed but returned null
 *
 * ## Error Handling
 *
 * Like `useConvexQuery`, errors are thrown and should be caught by Error
 * Boundaries. See `useConvexQuery` documentation for details.
 *
 * @param query - The Convex query function reference
 * @param args - The query arguments, or "skip" to skip the query
 * @returns Extended result object with derived states
 *
 * @example
 * ```tsx
 * function TemplateEditor({ templateId }: { templateId: string | null }) {
 *   const {
 *     data: template,
 *     isLoading,
 *     isNotFound,
 *     hasData
 *   } = useConvexQueryExtended(
 *     api.promptTemplates.get,
 *     templateId ? { templateId } : "skip"
 *   );
 *
 *   if (isLoading) return <Skeleton />;
 *   if (isNotFound) return <NotFoundMessage />;
 *   if (hasData) return <Editor template={template} />;
 *
 *   return null;
 * }
 * ```
 */
export function useConvexQueryExtended<Query extends FunctionReference<"query">>(
	query: Query,
	args: FunctionArgs<Query> | "skip"
): ConvexQueryResultExtended<FunctionReturnType<Query>> {
	const { data, isLoading, isSkipped } = useConvexQuery(query, args);

	return {
		data,
		isLoading,
		isSkipped,
		hasData: data != null,
		isReady: !isLoading,
		isNotFound: !isLoading && !isSkipped && data === null,
	};
}

/**
 * Type guard to check if a ConvexQueryResult has loaded data.
 *
 * Useful for narrowing types after checking loading state.
 *
 * Note: In Convex, `undefined` always means "loading". Queries should
 * return `null` for "no data found" cases, not `undefined`.
 *
 * @param result - The query result to check
 * @returns True if data is defined (not undefined)
 *
 * @example
 * ```tsx
 * const result = useConvexQuery(api.users.get, { id: userId });
 *
 * if (hasLoadedData(result)) {
 *   // TypeScript knows result.data is not undefined here
 *   console.log(result.data.name);
 * }
 * ```
 */
export function hasLoadedData<T>(
	result: ConvexQueryResult<T>
): result is ConvexQueryResult<T> & { data: Exclude<T, undefined> } {
	return !result.isLoading && !result.isSkipped && result.data !== undefined;
}

/**
 * Type guard to check if data exists and is not null.
 *
 * @param result - The query result to check
 * @returns True if data exists and is not null
 */
export function hasNonNullData<T>(
	result: ConvexQueryResult<T>
): result is ConvexQueryResult<T> & { data: NonNullable<T> } {
	return !result.isLoading && !result.isSkipped && result.data != null;
}

/**
 * A wrapper around Convex's useMutation for consistency with useConvexQuery.
 *
 * @param mutation - The Convex mutation function reference
 * @returns A mutation function that can be called with arguments
 */
export function useConvexMutation<Mutation extends FunctionReference<"mutation">>(
	mutation: Mutation
): (args: FunctionArgs<Mutation>) => Promise<FunctionReturnType<Mutation>> {
	return useMutation(mutation);
}
