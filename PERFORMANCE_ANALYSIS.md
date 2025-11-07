# Backend Performance Issues Analysis - OpenChat Repository

## Executive Summary
This is a comprehensive analysis of backend performance issues found in the OpenChat repository. The analysis covered API endpoints, database queries, external service calls, caching mechanisms, authentication flow, and code patterns. A total of **19 performance issues** were identified ranging from critical to low severity.

---

## 1. DATABASE PERFORMANCE ISSUES

### 1.1 CRITICAL: Soft Delete Filtering in Memory (Client-Side)
**Location:** 
- `/home/leo/openchat/apps/server/convex/messages.ts` - Lines 20-36
- `/home/leo/openchat/apps/server/convex/chats.ts` - Lines 17-30

**Issue Description:**
Database queries use `.collect()` to fetch all records and then filter out soft-deleted items in memory using `.filter((msg) => !msg.deletedAt)`. This pattern loads ALL records into memory before filtering.

**Code Example:**
```typescript
// messages.ts (lines 29-35)
const messages = await ctx.db
    .query("messages")
    .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
    .order("asc")
    .collect();
// Filter out soft-deleted messages
return messages.filter((message) => !message.deletedAt);
```

**Why It's a Performance Concern:**
- Loads ALL messages for a chat into memory, not just active ones
- For chats with thousands of deleted messages, this wastes memory and bandwidth
- Filtering happens on the server after fetching, so network cost is incurred for deleted records
- As the dataset grows, this becomes increasingly problematic
- No pagination or limits on soft-deleted queries

**Severity:** CRITICAL
**Impact:** High - Scales poorly with data growth, wastes memory and bandwidth

**Recommended Fix Pattern:**
- Add a database-level filter for soft-deleted items: `.withIndex("by_chat_active", (q) => q.eq("chatId", chatId).eq("deletedAt", undefined))`
- Or implement a sparse index strategy for deleted records

---

### 1.2 CRITICAL: N+1 Query Pattern - Message Soft Delete Cascade
**Location:** `/home/leo/openchat/apps/server/convex/chats.ts` - Lines 65-97 (remove mutation)

**Issue Description:**
When deleting a chat, the code:
1. Fetches the chat (Line 72)
2. Collects ALL messages for the chat (Line 82-85)
3. Loops through each message and patches individually (Lines 86-94)

```typescript
const messages = await ctx.db
    .query("messages")
    .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
    .collect();
await Promise.all(
    messages
        .filter((message) => !message.deletedAt)
        .map((message) =>
            ctx.db.patch(message._id, {
                deletedAt: now,
            }),
        ),
);
```

**Why It's a Performance Concern:**
- Each message is updated individually via `Promise.all()` (N+1 pattern in batches)
- For a chat with 1000 messages, this creates 1000 individual patch operations
- Even though batched with `Promise.all()`, each still requires a separate database operation
- No bulk update operation is used
- All messages are collected into memory first, then patched individually

**Severity:** CRITICAL
**Impact:** Very High - Each message delete spawns an individual database write operation

---

### 1.3 HIGH: Missing Pagination on Messages List Query
**Location:** `/home/leo/openchat/apps/server/convex/messages.ts` - Lines 20-36

**Issue Description:**
The `list` query fetches ALL messages for a chat with no pagination or limit:

```typescript
export const list = query({
    args: {
        chatId: v.id("chats"),
        userId: v.id("users"),
    },
    returns: v.array(messageDoc),
    handler: async (ctx, args) => {
        const chat = await assertOwnsChat(ctx, args.chatId, args.userId);
        if (!chat) return [];
        const messages = await ctx.db
            .query("messages")
            .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
            .order("asc")
            .collect();  // <-- No limit or pagination
        return messages.filter((message) => !message.deletedAt);
    },
});
```

**Why It's a Performance Concern:**
- Unbounded query - returns all messages regardless of count
- For a chat with 10,000 messages, loads entire dataset into memory
- Network bandwidth increases with message count
- Serialization/deserialization cost grows linearly
- Client receives massive payload for every chat load

**Severity:** HIGH
**Impact:** High - Scales linearly with chat message count

---

### 1.4 HIGH: Unbounded Chat List Query with Arbitrary Take(200) Limit
**Location:** `/home/leo/openchat/apps/server/convex/chats.ts` - Lines 17-30

**Issue Description:**
```typescript
export const list = query({
    args: {
        userId: v.id("users"),
    },
    returns: v.array(chatDoc),
    handler: async (ctx, args) => {
        const chats = await ctx.db
            .query("chats")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .order("desc")
            .take(200);  // <-- Hard-coded limit
        return chats.filter((chat) => !chat.deletedAt);
    },
});
```

**Why It's a Performance Concern:**
- Hard-coded `take(200)` limit with no pagination parameters
- Users can't load more than 200 chats without additional requests
- After filtering soft-deletes, may return fewer than expected results
- No cursor-based pagination for infinite scroll
- If user deletes 100 chats, only 100 active chats in results out of 200 fetched

**Severity:** HIGH
**Impact:** Medium - Limits functionality and wastes database calls

---

### 1.5 MEDIUM: Redundant User Lookup in assertOwnsChat
**Location:** `/home/leo/openchat/apps/server/convex/chats.ts` - Lines 99-109

**Issue Description:**
```typescript
export async function assertOwnsChat(
    ctx: MutationCtx | QueryCtx,
    chatId: Id<"chats">,
    userId: Id<"users">,
) {
    const chat = await ctx.db.get(chatId);  // <-- Always does full fetch
    if (!chat || chat.userId !== userId || chat.deletedAt) {
        return null;
    }
    return chat;
}
```

And in `messages.send()` mutation (line 62):
```typescript
const chat = await assertOwnsChat(ctx, args.chatId, args.userId);
```

Then immediately after (line 93):
```typescript
await ctx.db.patch(args.chatId, {
    updatedAt: assistantCreatedAt ?? userCreatedAt,
    lastMessageAt: assistantCreatedAt ?? userCreatedAt,
});
```

**Why It's a Performance Concern:**
- `assertOwnsChat()` fetches full chat document just for ownership check
- Chat document is fetched again to verify ownership but content not used
- Better approach would be to verify ownership at the index/query level

**Severity:** MEDIUM
**Impact:** Medium - Extra database read per mutation operation

---

## 2. API ENDPOINTS & ROUTES PERFORMANCE ISSUES

### 2.1 CRITICAL: Excessive ensureConvexUser Calls
**Location:** Multiple API routes:
- `/home/leo/openchat/apps/web/src/app/api/chats/route.ts` - Lines 7-8, 20-21
- `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` - Line 255
- `/home/leo/openchat/apps/web/src/app/api/chat/send/route.ts` - Line 37
- `/home/leo/openchat/apps/web/src/app/api/chats/[id]/prefetch/route.ts` - Line 15
- `/home/leo/openchat/apps/web/src/app/dashboard/layout.tsx` - Line 15

**Issue Description:**
Every API route and page calls `ensureConvexUser()` which:
1. Calls `getUserContext()` (fetches session from API)
2. Calls `client.mutation(api.users.ensure, ...)` (database lookup + potential insert)

In `/home/leo/openchat/apps/web/src/app/api/chats/route.ts` (POST handler):
```typescript
export async function POST(request: Request) {
    const session = await getUserContext();  // HTTP call to get session
    const userId = await ensureConvexUser({  // DB mutation (lookup/insert)
        id: session.userId,
        email: session.email,
        name: session.name,
        image: session.image,
    });
    // ...
}
```

**Why It's a Performance Concern:**
- **POST /api/chats calls it TWICE** - once in GET, once in POST (lines 8 and 20)
- Each `ensureConvexUser` triggers:
  - Network call to verify session
  - Database query to `by_external_id` index
  - Potential database write (upsert logic)
- No request-level caching of the user lookup result
- Authentication happens at API level AND application level
- For a single chat creation request: 2 session checks + 2 database lookups

**Severity:** CRITICAL
**Impact:** Very High - Doubles latency for simple operations

**Code Evidence:**
```typescript
// GET handler (line 6-16)
export async function GET() {
    const session = await getUserContext();
    const userId = await ensureConvexUser({...});  // Call 1
    const chats = await listChats(userId);
    return NextResponse.json({ chats: chats.map(serializeChat) });
}

// POST handler (line 18-30)
export async function POST(request: Request) {
    const session = await getUserContext();
    const userId = await ensureConvexUser({...});  // Call 2 - redundant
    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === "string" && body.title.trim().length > 0 ? body.title.trim() : "New Chat";
    const chat = await createChatForUser(userId, title);
    return NextResponse.json({ chat: serializeChat(chat) });
}
```

---

### 2.2 HIGH: Redundant ensureConvexUser in Chat Routes
**Location:** `/home/leo/openchat/apps/web/src/app/api/chats/route.ts`

**Issue Description:**
Both GET and POST call `ensureConvexUser()` separately instead of reusing the result.

```typescript
export async function GET() {
    const session = await getUserContext();
    const userId = await ensureConvexUser({...});  // Full upsert mutation
    // ...
}

export async function POST(request: Request) {
    const session = await getUserContext();
    const userId = await ensureConvexUser({...});  // Same lookup again
    // ...
}
```

**Why It's a Performance Concern:**
- Same operation called in both handlers
- No shared context or caching between requests
- Each HTTP request pays full cost

**Severity:** HIGH
**Impact:** High - Adds 2 extra roundtrips per chat operation

---

### 2.3 HIGH: Missing Validation Before User Content Processing
**Location:** `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` - Lines 339-366

**Issue Description:**
Extensive processing occurs before basic validation:

```typescript
const rawMessages: AnyUIMessage[] = Array.isArray(payload?.messages) 
    ? (payload.messages as AnyUIMessage[]) 
    : [];
if (rawMessages.length === 0) {
    const headers = buildCorsHeaders(request, allowOrigin);
    return new Response("Missing chat messages", { status: 400, headers });
}

const safeMessages = rawMessages.map(clampUserText);  // Process before validation
const userMessageIndex = [...rawMessages].reverse().findIndex((msg) => msg.role === "user");
if (userMessageIndex === -1) {
    const headers = buildCorsHeaders(request, allowOrigin);
    return new Response("Missing user message", { status: 400, headers });
}
```

**Why It's a Performance Concern:**
- Message processing happens before all validation
- `clampUserText()` called on all messages even if some might be invalid
- Array copying and sorting for validation
- Message extraction happens after length validation but before message role validation

**Severity:** HIGH
**Impact:** Medium - CPU wasted on invalid requests

---

### 2.4 HIGH: Single Database Connection Pool for All Requests
**Location:** `/home/leo/openchat/apps/web/src/lib/convex-server.ts` - Lines 12-27

**Issue Description:**
```typescript
let cachedClient: ConvexHttpClient | null = null;

function getClient() {
    if (!cachedClient) {
        const url = getConvexUrl();
        if (!url) {
            throw new Error("CONVEX_URL is not configured...");
        }
        cachedClient = new ConvexHttpClient(url);
    }
    return cachedClient;
}
```

**Why It's a Performance Concern:**
- Single global Convex HTTP client shared across all requests
- No connection pooling or request queuing mechanism visible
- All API requests share same underlying connection
- No timeout configuration for HTTP client
- If one request is slow, all subsequent requests queue

**Severity:** HIGH
**Impact:** Medium - Can cause cascading timeouts under load

---

### 2.5 MEDIUM: No Timeout on External OpenRouter API Calls
**Location:** `/home/leo/openchat/apps/web/src/app/api/openrouter/models/route.ts` - Line 37

**Issue Description:**
```typescript
const response = await fetch(`${OPENROUTER_BASE_URL}/models`, {
    headers: {
        Authorization: `Bearer ${apiKey}`,
    },
    // No timeout configuration
});
```

**Why It's a Performance Concern:**
- Unbounded fetch request with no timeout
- If OpenRouter API hangs, endpoint hangs indefinitely
- Client request can timeout or fill up connection pool waiting
- No AbortController or signal to cancel request

**Severity:** MEDIUM
**Impact:** Medium - Can cause connection exhaustion

---

## 3. CACHING & REQUEST OPTIMIZATION ISSUES

### 3.1 HIGH: No Request-Level Caching for getUserContext
**Location:** `/home/leo/openchat/apps/web/src/lib/auth-server.ts` - Lines 13-59

**Issue Description:**
```typescript
const resolveUserContext = cache(async (): Promise<UserContext> => {
    const cookieStore = await cookies();
    // ... makes HTTP call to /api/auth/get-session
    const response = await fetch(`${baseUrl}/api/auth/get-session`, {
        headers: {
            Cookie: `${cookieName}=${sessionCookie.value}`,
        },
        cache: "no-store",  // <-- Cache disabled
    });
});
```

The function uses React's `cache()` wrapper BUT:
1. The wrapped function disables HTTP caching with `cache: "no-store"`
2. React request cache only works within a single request scope
3. Every API route that calls `getUserContext()` makes a fresh HTTP call

**Why It's a Performance Concern:**
- `cache: "no-store"` prevents HTTP caching
- React `cache()` doesn't persist across requests
- Same session lookup repeated for every API call
- For a page that renders 3 components, makes 3 session HTTP calls

**Severity:** HIGH
**Impact:** High - Session lookups repeated unnecessarily

---

### 3.2 HIGH: No Server-Level Cache for Chat List
**Location:** `/home/leo/openchat/apps/web/src/app/dashboard/layout.tsx` - Line 21

**Issue Description:**
```typescript
const rawChats = await listChats(convexUserId);
const chats = rawChats.map((chat) => ({
    id: chat._id,
    title: chat.title,
    updatedAt: new Date(chat.updatedAt).toISOString(),
    lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt).toISOString() : null,
}));
```

The chat list is fetched fresh on every layout render, with no caching mechanism.

**Why It's a Performance Concern:**
- Layout component renders on every navigation change
- No cache headers or ETag validation
- Chat list fetched even if unchanged
- Sidebar component also fetches same data separately

**Severity:** HIGH
**Impact:** High - Repeated database queries for same data

---

### 3.3 MEDIUM: Client-Side Prefetch Cache Has Short TTL
**Location:** `/home/leo/openchat/apps/web/src/lib/chat-prefetch-cache.ts` - Line 16

**Issue Description:**
```typescript
const DEFAULT_TTL_MS = Number(process.env.NEXT_PUBLIC_CHAT_PREFETCH_TTL_MS ?? 60_000);
```

Default cache TTL is 60 seconds (1 minute), which is very short for stable data like messages.

**Why It's a Performance Concern:**
- Messages don't change once written (only soft deleted, not modified)
- 60 second cache means cache miss likely on next view
- Repeated prefetch calls for recently viewed chats
- Client-side only cache, no server-side backup

**Severity:** MEDIUM
**Impact:** Medium - Cache misses cause repeated network calls

---

## 4. AUTHENTICATION & MIDDLEWARE PERFORMANCE

### 4.1 HIGH: Redundant Session Verification on Every Route
**Location:** Multiple routes call `getUserContext()` which makes HTTP call to `/api/auth/get-session`
- `/home/leo/openchat/apps/web/src/app/api/chats/route.ts`
- `/home/leo/openchat/apps/web/src/app/api/chat/send/route.ts`
- `/home/leo/openchat/apps/web/src/app/api/chats/[id]/route.ts`
- `/home/leo/openchat/apps/web/src/app/api/chats/[id]/prefetch/route.ts`
- `/home/leo/openchat/apps/web/src/app/dashboard/layout.tsx`

**Issue Description:**
Each route independently calls `getUserContext()` which:
```typescript
const response = await fetch(`${baseUrl}/api/auth/get-session`, {
    headers: {
        Cookie: `${cookieName}=${sessionCookie.value}`,
    },
    cache: "no-store",
});
```

**Why It's a Performance Concern:**
- Same session data fetched multiple times per user action
- Session endpoint hit on every API call
- `cache: "no-store"` prevents any caching benefit
- No session token validation done at middleware level
- Better Auth handler for `/api/auth/[...all]` doesn't provide pre-validated context

**Severity:** HIGH
**Impact:** High - 3-4 session lookups per complex action (load + create + fetch)

---

### 4.2 MEDIUM: No Middleware-Level Authentication Caching
**Location:** `/home/leo/openchat/apps/web/src/app/api/auth/[...all]/route.ts`

**Issue Description:**
```typescript
import { nextJsHandler } from "@convex-dev/better-auth/nextjs";
export const { GET, POST } = nextJsHandler();
```

The better-auth handler is at `[...all]` which means session checks can't be cached or short-circuited at middleware.

**Why It's a Performance Concern:**
- No caching strategy visible at middleware level
- Every request must hit the better-auth handler
- Session validation can't be skipped for public endpoints
- No edge-level caching for session data

**Severity:** MEDIUM
**Impact:** Medium - Session checks not optimized

---

## 5. EXTERNAL SERVICES & I/O PERFORMANCE

### 5.1 CRITICAL: No Timeout on OpenRouter Chat Stream
**Location:** `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` - Lines 499-527

**Issue Description:**
```typescript
try {
    const model = config.provider.chat(config.modelId);
    const result = await streamTextImpl({
        model,
        messages: convertToCoreMessagesImpl(safeMessages),
        maxOutputTokens: MAX_TOKENS,
        experimental_transform: smoothStream({
            delayInMs: STREAM_SMOOTH_DELAY_MS,
            chunking: "word",
        }),
        onChunk: async ({ chunk }) => {
            if (chunk.type === "text-delta" && chunk.text.length > 0) {
                assistantText += chunk.text;
                scheduleStreamFlush();  // Schedules a flush to database
            }
        },
        // ... no timeout configuration
    });
}
```

**Why It's a Performance Concern:**
- `streamText()` has no timeout parameter visible
- If OpenRouter API hangs on response, request hangs indefinitely
- Database writes (`scheduleStreamFlush`) continue to be queued
- Client connection stays open consuming resources
- No abort/cancel mechanism for slow streams

**Severity:** CRITICAL
**Impact:** Very High - Can exhaust connection pool if OpenRouter API is slow

---

### 5.2 HIGH: Sequential Message Persistence During Streaming
**Location:** `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` - Lines 368-404

**Issue Description:**
```typescript
// User message persisted first
const userResult = await persistMessageImpl({
    userId: convexUserId,
    chatId,
    clientMessageId: userMessageId,
    role: "user",
    content: userContent,
    createdAt: userCreatedAtIso,
    status: "completed",
});
if (!userResult.ok) {
    throw new Error("user streamUpsert rejected");
}

// Then assistant message bootstrap
const assistantBootstrap = await persistMessageImpl({
    userId: convexUserId,
    chatId,
    clientMessageId: assistantMessageId,
    role: "assistant",
    content: "",
    createdAt: assistantCreatedAtIso,
    status: "streaming",
});
```

**Why It's a Performance Concern:**
- Two sequential database writes before stream starts
- User and assistant message written separately instead of batched
- Delays stream start time while waiting for database
- Could use `Promise.all()` for parallel writes

**Severity:** HIGH
**Impact:** High - Adds 2 database roundtrips before streaming begins

---

### 5.3 HIGH: No Batch Updates for Stream Flushing
**Location:** `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` - Lines 416-439

**Issue Description:**
```typescript
const persistAssistant = async (status: "streaming" | "completed", force = false) => {
    const pendingLength = assistantText.length;
    const delta = pendingLength - lastPersistedLength;
    if (!force && status === "streaming") {
        if (delta <= 0) return;
        if (delta < STREAM_MIN_CHARS_PER_FLUSH) return;
    }
    if (delta <= 0 && !force) {
        return;
    }
    lastPersistedLength = pendingLength;
    const response = await persistMessageImpl({  // Single message update
        userId: convexUserId,
        chatId,
        clientMessageId: assistantMessageId,
        role: "assistant",
        content: assistantText,  // Full content updated
        createdAt: assistantCreatedAtIso,
        status,
    });
};
```

**Why It's a Performance Concern:**
- Each stream flush updates the entire message content in database
- For a 5000 character response streamed, could be 50+ updates
- Full content sent on each flush, not just delta
- No bulk or delta-based update API used
- Database writes full document on each patch

**Severity:** HIGH
**Impact:** High - Excessive database writes during streaming

---

## 6. CODE PATTERNS & INEFFICIENCIES

### 6.1 HIGH: Inefficient Memory Usage in Message Filtering
**Location:** `/home/leo/openchat/apps/server/convex/messages.ts` - Lines 29-35

**Issue Description:**
```typescript
const messages = await ctx.db
    .query("messages")
    .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
    .order("asc")
    .collect();  // Loads ALL into memory
// Filter out soft-deleted messages
return messages.filter((message) => !message.deletedAt);
```

For a chat with 1000 messages (100 deleted), this:
1. Loads all 1000 messages into memory
2. Filters to 900 active ones
3. Returns 900 messages

**Why It's a Performance Concern:**
- Loads deleted messages into memory unnecessarily
- Array scan required for filtering
- Memory grows linearly with total messages
- Should use database-level filtering

**Severity:** HIGH
**Impact:** High - O(n) memory usage where n = total messages

---

### 6.2 MEDIUM: Unnecessary Date Serialization on Every Request
**Location:** `/home/leo/openchat/apps/web/src/app/dashboard/layout.tsx` - Lines 22-27

**Issue Description:**
```typescript
const chats = rawChats.map((chat) => ({
    id: chat._id,
    title: chat.title,
    updatedAt: new Date(chat.updatedAt).toISOString(),  // Serialize every time
    lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt).toISOString() : null,
}));
```

Same conversion happens in:
- `/home/leo/openchat/apps/web/src/app/api/chats/[id]/prefetch/route.ts` - Lines 26-31
- `/home/leo/openchat/apps/web/src/app/dashboard/chat/[id]/page.tsx` - Lines 17-22

**Why It's a Performance Concern:**
- Multiple date serializations for same data
- CPU cycles spent on string conversion
- Should be cached or done once at source
- ISO strings could be cached if data is immutable

**Severity:** MEDIUM
**Impact:** Low-Medium - CPU wasted on repeated conversions

---

### 6.3 MEDIUM: Heavy Client-Side Deduplication Logic
**Location:** `/home/leo/openchat/apps/web/src/components/app-sidebar.tsx` - Lines 104-116

**Issue Description:**
```typescript
function dedupeChats(list: ChatListItem[]) {
    const map = new Map<string, ChatListItem>();
    for (const chat of list) {
        const normalized = ensureNormalizedChat(chat);  // Normalize each chat
        const existing = map.get(normalized.id);
        map.set(normalized.id, mergeChat(existing, normalized));  // Complex merge
    }
    return sortChats(Array.from(map.values()));  // Sort after dedupe
}
```

Called with `initialChats` on component mount and when `initialChats` changes.

**Why It's a Performance Concern:**
- Complex normalization and merging logic runs on client
- Should be done server-side once
- Runs on every layout render
- Multiple utility functions called per chat

**Severity:** MEDIUM
**Impact:** Medium - Unnecessary client-side computation

---

### 6.4 MEDIUM: Synchronous String Hashing on Request Path
**Location:** `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` - Lines 148-154

**Issue Description:**
```typescript
function hashClientIp(ip: string): string {
    try {
        return createHash("sha256").update(ip).digest("hex").slice(0, 16);
    } catch {
        return "unknown";
    }
}
```

Called on every chat request:
```typescript
const ipHash = hashClientIp(clientIp);
```

**Why It's a Performance Concern:**
- Synchronous hashing on request path
- Creates hash object and computation per request
- Used only for analytics/logging
- Could be cached per IP or done asynchronously

**Severity:** MEDIUM
**Impact:** Low-Medium - CPU overhead on request path

---

## 7. CONFIGURATION & MISSING OPTIMIZATIONS

### 7.1 MEDIUM: No Connection Pool Configuration
**Location:** `/home/leo/openchat/apps/web/src/lib/convex-server.ts`

**Issue Description:**
ConvexHttpClient is created without any configuration:
```typescript
cachedClient = new ConvexHttpClient(url);
```

**Why It's a Performance Concern:**
- No visible connection pooling settings
- No request timeout configuration
- No retry strategy configuration
- Default settings may not be optimized for this app

**Severity:** MEDIUM
**Impact:** Medium - Default settings may be suboptimal

---

### 7.2 MEDIUM: Hard-Coded Pagination Limit Without Configuration
**Location:** `/home/leo/openchat/apps/server/convex/chats.ts` - Line 27

**Issue Description:**
```typescript
.take(200);
```

No configuration option, hard-coded limit.

**Why It's a Performance Concern:**
- No ability to tune for different user populations
- Not configurable per user or team
- 200 may be too high or too low depending on use case

**Severity:** MEDIUM
**Impact:** Medium - Inflexible pagination

---

## 8. SUMMARY TABLE

| Issue ID | Severity | Type | Component | Issue | Impact |
|----------|----------|------|-----------|-------|--------|
| 1.1 | CRITICAL | Database | Convex Queries | Soft delete filtering in memory | Unbounded memory growth |
| 1.2 | CRITICAL | Database | Chat Deletion | N+1 message updates | 1000s of individual writes |
| 1.3 | HIGH | Database | Messages Query | No pagination on full list | Memory/bandwidth proportional to message count |
| 1.4 | HIGH | Database | Chat Listing | Hard-coded 200 limit | Arbitrary limit reduces functionality |
| 1.5 | MEDIUM | Database | Chat Ownership | Redundant document fetch | Extra database read per mutation |
| 2.1 | CRITICAL | API Routes | User Ensure | Excessive ensureConvexUser calls | Doubles latency per operation |
| 2.2 | HIGH | API Routes | Chat Routes | Redundant user lookup | 2 extra DB roundtrips |
| 2.3 | HIGH | API Routes | Chat Handler | Missing early validation | CPU wasted on invalid requests |
| 2.4 | HIGH | API Routes | Convex Client | No connection pooling visible | Cascading timeouts under load |
| 2.5 | MEDIUM | External API | OpenRouter Models | No timeout on fetch | Connection exhaustion risk |
| 3.1 | HIGH | Caching | Auth Server | No request-level caching | Session lookups repeated |
| 3.2 | HIGH | Caching | Dashboard Layout | No server cache for chat list | Repeated DB queries |
| 3.3 | MEDIUM | Caching | Prefetch Cache | Short 60s TTL | Frequent cache misses |
| 4.1 | HIGH | Auth | All Routes | Redundant session verification | 3-4 session lookups per action |
| 4.2 | MEDIUM | Auth | Middleware | No caching at middleware level | Unoptimized session checks |
| 5.1 | CRITICAL | External IO | Chat Stream | No timeout on OpenRouter | Connection pool exhaustion |
| 5.2 | HIGH | External IO | Chat Stream | Sequential message persistence | 2 roundtrips before streaming |
| 5.3 | HIGH | External IO | Chat Stream | No batch updates during stream | 50+ individual updates per response |
| 6.1 | HIGH | Code Pattern | Message Filtering | Memory-intensive soft delete filtering | O(n) memory usage |
| 6.2 | MEDIUM | Code Pattern | Serialization | Repeated date conversions | CPU overhead on serialization |
| 6.3 | MEDIUM | Code Pattern | Client-Side | Heavy deduplication logic | Unnecessary client computation |
| 6.4 | MEDIUM | Code Pattern | Rate Limiting | Synchronous hashing on request path | CPU overhead |
| 7.1 | MEDIUM | Config | Convex Client | No connection pool configuration | Suboptimal defaults |
| 7.2 | MEDIUM | Config | Pagination | Hard-coded pagination limit | Inflexible pagination |

---

## 9. CRITICAL PATH ANALYSIS

### Typical Chat Load Flow:
1. User navigates to `/dashboard`
2. `DashboardLayout` calls:
   - `getUserContext()` → HTTP to `/api/auth/get-session`
   - `ensureConvexUser()` → DB mutation (users.ensure)
   - `listChats()` → DB query (collect all chats, filter in memory)
3. User clicks on a chat at `/dashboard/chat/[id]`
4. ChatPage calls:
   - `getUserContext()` → HTTP call again
   - `ensureConvexUser()` → DB mutation again
   - `listMessagesForChat()` → DB query (collect all messages, filter in memory)
5. User sends a message to `/api/chat`
6. Handler calls:
   - `getUserContext()` → HTTP call again
   - `ensureConvexUser()` → DB mutation again
   - Persists user message → 1 DB write
   - Persists assistant message → 1 DB write
   - Streams response from OpenRouter
   - Updates message content 50+ times → 50+ DB writes

**Total for one message exchange:**
- 3 session HTTP calls
- 3 user ensure mutations
- 1 chat list query
- 1 message list query
- 2 message writes
- 50+ message updates

**Opportunities:**
- Cache `ensureConvexUser` result per request
- Cache session for duration of request
- Use batch message updates instead of 50+ individual ones
- Implement database-level soft delete filtering

---

## 10. RECOMMENDATIONS BY PRIORITY

### Critical (Fix Immediately):
1. Implement database-level soft delete filtering
2. Batch message updates during soft delete cascade
3. Add timeouts to OpenRouter API calls
4. Cache `ensureConvexUser` result at request level

### High (Fix Soon):
1. Implement pagination for messages and chats
2. Add batch updates for stream flushing
3. Move session verification to middleware with caching
4. Sequential → parallel message persistence

### Medium (Fix when possible):
1. Remove redundant date serializations
2. Configure connection pooling for Convex
3. Increase prefetch cache TTL
4. Move client-side deduplication to server

---

## FILES ANALYZED

**Convex Backend:**
- `/home/leo/openchat/apps/server/convex/schema.ts` (37 lines)
- `/home/leo/openchat/apps/server/convex/chats.ts` (109 lines)
- `/home/leo/openchat/apps/server/convex/messages.ts` (206 lines)
- `/home/leo/openchat/apps/server/convex/users.ts` (68 lines)

**API Routes:**
- `/home/leo/openchat/apps/web/src/app/api/chats/route.ts` (31 lines)
- `/home/leo/openchat/apps/web/src/app/api/chats/[id]/route.ts` (19 lines)
- `/home/leo/openchat/apps/web/src/app/api/chats/[id]/prefetch/route.ts` (38 lines)
- `/home/leo/openchat/apps/web/src/app/api/chat/route.ts` (8 lines)
- `/home/leo/openchat/apps/web/src/app/api/chat/send/route.ts` (70 lines)
- `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` (617 lines)
- `/home/leo/openchat/apps/web/src/app/api/openrouter/models/route.ts` (94 lines)
- `/home/leo/openchat/apps/web/src/app/api/auth/[...all]/route.ts` (7 lines)

**Server-Side Utilities:**
- `/home/leo/openchat/apps/web/src/lib/convex-server.ts` (112 lines)
- `/home/leo/openchat/apps/web/src/lib/auth-server.ts` (68 lines)
- `/home/leo/openchat/apps/web/src/lib/chat-prefetch-cache.ts` (108 lines)
- `/home/leo/openchat/apps/web/src/lib/openrouter-model-cache.ts` (63 lines)

**Client Components:**
- `/home/leo/openchat/apps/web/src/components/app-sidebar.tsx` (270+ lines)

**Pages:**
- `/home/leo/openchat/apps/web/src/app/dashboard/layout.tsx` (55 lines)
- `/home/leo/openchat/apps/web/src/app/dashboard/chat/[id]/page.tsx` (30 lines)

