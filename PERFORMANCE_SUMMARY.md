# Backend Performance Issues - Quick Summary

## Critical Issues (4 items) - FIX IMMEDIATELY

1. **Soft Delete Filtering in Memory** (DB - 1.1)
   - Loading ALL messages into memory, filtering in-app
   - File: `/home/leo/openchat/apps/server/convex/messages.ts` lines 20-36
   - Impact: Unbounded memory growth, bandwidth waste

2. **N+1 Message Delete Cascade** (DB - 1.2)
   - 1000+ individual database patches when deleting a chat
   - File: `/home/leo/openchat/apps/server/convex/chats.ts` lines 65-97
   - Impact: 1000s of database write operations per delete

3. **Excessive ensureConvexUser Calls** (API - 2.1)
   - Repeated user lookups/creation on every request
   - Files: Multiple API routes call this twice
   - Impact: Doubles latency per operation

4. **No Timeout on OpenRouter Stream** (IO - 5.1)
   - Unbounded streaming with no timeout mechanism
   - File: `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` line 499
   - Impact: Connection pool exhaustion if API hangs

---

## High Priority Issues (12 items)

### Database (3)
- Missing pagination on messages query (1.3)
- Unbounded chat list with hard-coded 200 limit (1.4)

### API Routes (3)
- Redundant user lookups in chat routes (2.2)
- Missing early validation before processing (2.3)
- No visible connection pooling (2.4)

### Caching (2)
- No request-level caching for session (3.1)
- No server-level cache for chat list (3.2)

### Authentication (2)
- Redundant session verification every route (4.1)

### External IO (2)
- Sequential message persistence before streaming (5.2)
- No batch updates during stream flushing (5.3)

### Code Patterns (1)
- Inefficient memory usage in soft delete filtering (6.1)

---

## Key Metrics

- **Total Issues Found:** 25
- **Critical Severity:** 4
- **High Severity:** 12
- **Medium Severity:** 9

---

## Impact Summary

### Latency Impact
- Chat creation: **2x slower** due to duplicate `ensureConvexUser` calls
- Session lookups: **3-4x per user action** instead of 1x
- Stream start: **Delayed 2 DB roundtrips** due to sequential writes

### Memory Impact
- Message filtering: **O(n) memory** where n = total messages in chat
- For 10K messages: Loads 10K into memory even if only 1K shown

### Bandwidth Impact
- Message list: **Unbounded size**, transmits all messages including deleted ones
- Chat soft-delete filtering: Loads deleted records just to filter them

### Scalability
- Will degrade significantly as:
  - Users have more chats (pagination issue)
  - Chats have more messages (unbounded list + filtering)
  - Chats deleted with many messages (N+1 pattern)

---

## Recommended Fix Priority

### Week 1 (Critical)
1. Add database-level soft delete filtering
2. Implement batch message updates for delete cascade
3. Cache ensureConvexUser result at request level
4. Add timeouts to OpenRouter calls

### Week 2 (High)
1. Implement pagination for messages and chats
2. Batch stream message updates instead of 50+ individual ones
3. Move session verification to middleware with caching
4. Parallelize message persistence

### Week 3 (Medium)
1. Remove redundant date serializations
2. Configure Convex connection pooling
3. Increase prefetch cache TTL
4. Move deduplication logic to server

---

## Files to Review in Priority Order

1. `/home/leo/openchat/apps/server/convex/messages.ts` - Soft delete filtering
2. `/home/leo/openchat/apps/server/convex/chats.ts` - N+1 pattern
3. `/home/leo/openchat/apps/web/src/lib/convex-server.ts` - Connection pooling
4. `/home/leo/openchat/apps/web/src/app/api/chat/chat-handler.ts` - Stream handling
5. `/home/leo/openchat/apps/web/src/lib/auth-server.ts` - Session caching

---

## See Also

Full analysis with code examples: **PERFORMANCE_ANALYSIS.md**
