/**
 * Convex client mocks for testing
 *
 * This module provides mock implementations of Convex hooks and client functions.
 * Use these mocks to test components that interact with Convex without making real database calls.
 *
 * @module mocks/convex
 */

import { vi, type Mock } from "vitest";
import type { FunctionReference, FunctionReturnType } from "convex/server";
import type { Id } from "@server/convex/_generated/dataModel";

/**
 * Type for mocked query hook return value
 */
export type MockQueryResult<T> = T | undefined | null;

/**
 * Type for mocked mutation function
 */
export type MockMutationFn<Args = any, Return = any> = Mock<[Args], Promise<Return>>;

/**
 * Type for mocked action function
 */
export type MockActionFn<Args = any, Return = any> = Mock<[Args], Promise<Return>>;

/**
 * Mock data store for Convex queries
 * Stores mock data that can be returned by mocked queries
 */
export class MockConvexDataStore {
  private data = new Map<string, any>();

  /**
   * Set mock data for a specific query
   *
   * @param key - Query identifier (e.g., "users.getByExternalId")
   * @param value - Data to return
   *
   * @example
   * ```typescript
   * store.setQueryData("users.list", [mockUser1, mockUser2]);
   * ```
   */
  setQueryData(key: string, value: any): void {
    this.data.set(key, value);
  }

  /**
   * Get mock data for a specific query
   *
   * @param key - Query identifier
   * @returns Stored mock data or undefined
   */
  getQueryData(key: string): any {
    return this.data.get(key);
  }

  /**
   * Clear all mock data
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Check if query has mock data
   *
   * @param key - Query identifier
   * @returns True if data exists
   */
  hasQueryData(key: string): boolean {
    return this.data.has(key);
  }
}

/**
 * Global mock data store instance
 */
export const mockConvexStore = new MockConvexDataStore();

/**
 * Mock implementation of Convex useQuery hook
 *
 * @param query - Query reference (can be any FunctionReference)
 * @param args - Query arguments
 * @returns Mock query result from the store or undefined
 *
 * @example
 * ```typescript
 * vi.mock("convex/react", () => ({
 *   useQuery: mockUseQuery,
 * }));
 *
 * mockConvexStore.setQueryData("api.users.list", [mockUser]);
 * const users = useQuery(api.users.list);
 * ```
 */
export function mockUseQuery<Query extends FunctionReference<"query">>(
  query: Query | "skip",
  args?: any
): MockQueryResult<FunctionReturnType<Query>> {
  if (query === "skip") {
    return undefined;
  }

  // Extract query name from function reference
  const queryName = typeof query === "object" && "_functionName" in query
    ? String((query as any)._functionName)
    : String(query);

  // Check if we have mock data for this query
  if (mockConvexStore.hasQueryData(queryName)) {
    const data = mockConvexStore.getQueryData(queryName);

    // If data is a function, call it with args
    if (typeof data === "function") {
      return data(args);
    }

    return data;
  }

  // Return undefined by default (loading state)
  return undefined;
}

/**
 * Mock implementation of Convex useMutation hook
 *
 * @param mutation - Mutation reference
 * @returns Mock mutation function
 *
 * @example
 * ```typescript
 * vi.mock("convex/react", () => ({
 *   useMutation: mockUseMutation,
 * }));
 *
 * const createChat = useMutation(api.chats.create);
 * await createChat({ title: "Test" });
 * ```
 */
export function mockUseMutation<Mutation extends FunctionReference<"mutation">>(
  mutation: Mutation
): MockMutationFn<any, FunctionReturnType<Mutation>> {
  const mutationFn = vi.fn(async (args: any) => {
    // Extract mutation name
    const mutationName = typeof mutation === "object" && "_functionName" in mutation
      ? String((mutation as any)._functionName)
      : String(mutation);

    // Check if we have a mock handler
    const handler = mockConvexStore.getQueryData(`mutation:${mutationName}`);
    if (typeof handler === "function") {
      return handler(args);
    }

    // Return a mock ID by default for create operations
    if (mutationName.includes("create") || mutationName.includes("insert")) {
      return `jd7mock${Math.random().toString(36).substring(2, 15)}` as Id<any>;
    }

    // Return null for other operations
    return null;
  });

  return mutationFn;
}

/**
 * Mock implementation of Convex useAction hook
 *
 * @param action - Action reference
 * @returns Mock action function
 *
 * @example
 * ```typescript
 * vi.mock("convex/react", () => ({
 *   useAction: mockUseAction,
 * }));
 *
 * const generateResponse = useAction(api.chat.generate);
 * await generateResponse({ message: "Hello" });
 * ```
 */
export function mockUseAction<Action extends FunctionReference<"action">>(
  action: Action
): MockActionFn<any, FunctionReturnType<Action>> {
  const actionFn = vi.fn(async (args: any) => {
    // Extract action name
    const actionName = typeof action === "object" && "_functionName" in action
      ? String((action as any)._functionName)
      : String(action);

    // Check if we have a mock handler
    const handler = mockConvexStore.getQueryData(`action:${actionName}`);
    if (typeof handler === "function") {
      return handler(args);
    }

    // Return null by default
    return null;
  });

  return actionFn;
}

/**
 * Mock Convex client for testing
 */
export class MockConvexClient {
  private queries = new Map<string, any>();
  private mutations = new Map<string, Mock>();
  private actions = new Map<string, Mock>();

  /**
   * Mock query method
   */
  query = vi.fn(async (query: FunctionReference<"query">, args?: any) => {
    const queryName = String((query as any)._functionName ?? query);

    if (mockConvexStore.hasQueryData(queryName)) {
      const data = mockConvexStore.getQueryData(queryName);
      return typeof data === "function" ? data(args) : data;
    }

    return null;
  });

  /**
   * Mock mutation method
   */
  mutation = vi.fn(async (mutation: FunctionReference<"mutation">, args?: any) => {
    const mutationName = String((mutation as any)._functionName ?? mutation);

    const handler = mockConvexStore.getQueryData(`mutation:${mutationName}`);
    if (typeof handler === "function") {
      return handler(args);
    }

    return null;
  });

  /**
   * Mock action method
   */
  action = vi.fn(async (action: FunctionReference<"action">, args?: any) => {
    const actionName = String((action as any)._functionName ?? action);

    const handler = mockConvexStore.getQueryData(`action:${actionName}`);
    if (typeof handler === "function") {
      return handler(args);
    }

    return null;
  });

  /**
   * Clear all mocks
   */
  clear(): void {
    this.queries.clear();
    this.mutations.clear();
    this.actions.clear();
    this.query.mockClear();
    this.mutation.mockClear();
    this.action.mockClear();
  }
}

/**
 * Create a new mock Convex client
 *
 * @returns Mock Convex client instance
 *
 * @example
 * ```typescript
 * const client = createMockConvexClient();
 * const result = await client.query(api.users.list);
 * ```
 */
export function createMockConvexClient(): MockConvexClient {
  return new MockConvexClient();
}

/**
 * Mock ConvexProvider for testing
 *
 * @param children - React children
 * @returns Mock provider component
 *
 * @example
 * ```typescript
 * render(
 *   <MockConvexProvider>
 *     <YourComponent />
 *   </MockConvexProvider>
 * );
 * ```
 */
export function MockConvexProvider({ children }: { children: React.ReactNode }) {
  return children;
}

/**
 * Helper to setup Convex mocks for a test suite
 *
 * @example
 * ```typescript
 * import { setupConvexMocks } from "./mocks/convex";
 *
 * describe("MyComponent", () => {
 *   setupConvexMocks();
 *
 *   it("loads data", () => {
 *     mockConvexStore.setQueryData("api.users.list", [mockUser]);
 *     // ... test code
 *   });
 * });
 * ```
 */
export function setupConvexMocks() {
  beforeEach(() => {
    mockConvexStore.clear();
  });

  afterEach(() => {
    mockConvexStore.clear();
    vi.clearAllMocks();
  });
}

/**
 * Helper to create a mock query that returns data based on arguments
 *
 * @param queryName - Name of the query
 * @param handler - Function that takes args and returns data
 *
 * @example
 * ```typescript
 * createMockQueryWithArgs("users.getByExternalId", (args) => {
 *   if (args.externalId === "user123") return mockUser;
 *   return null;
 * });
 * ```
 */
export function createMockQueryWithArgs(
  queryName: string,
  handler: (args: any) => any
): void {
  mockConvexStore.setQueryData(queryName, handler);
}

/**
 * Helper to create a mock mutation with custom behavior
 *
 * @param mutationName - Name of the mutation
 * @param handler - Function that takes args and returns result
 *
 * @example
 * ```typescript
 * createMockMutation("chats.create", async (args) => {
 *   return { _id: "jd7newchat123", title: args.title };
 * });
 * ```
 */
export function createMockMutation(
  mutationName: string,
  handler: (args: any) => any
): void {
  mockConvexStore.setQueryData(`mutation:${mutationName}`, handler);
}

/**
 * Helper to create a mock action with custom behavior
 *
 * @param actionName - Name of the action
 * @param handler - Function that takes args and returns result
 *
 * @example
 * ```typescript
 * createMockAction("ai.generate", async (args) => {
 *   return { response: "Mock AI response" };
 * });
 * ```
 */
export function createMockAction(
  actionName: string,
  handler: (args: any) => any
): void {
  mockConvexStore.setQueryData(`action:${actionName}`, handler);
}

/**
 * Mock Convex authentication session
 */
export const mockConvexAuth = {
  isLoading: false,
  isAuthenticated: true,
  fetchAccessToken: vi.fn(async () => "mock-access-token"),
};

/**
 * Mock useConvexAuth hook
 *
 * @returns Mock auth state
 *
 * @example
 * ```typescript
 * vi.mock("convex/react", () => ({
 *   useConvexAuth: mockUseConvexAuth,
 * }));
 * ```
 */
export function mockUseConvexAuth() {
  return mockConvexAuth;
}
