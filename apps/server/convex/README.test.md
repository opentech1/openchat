# Convex Function Tests

This directory contains comprehensive test suites for Convex backend functions.

## Test Files

### chats.test.ts (44 tests)

Comprehensive tests for chat management functions:

**chats.create mutation (18 tests)**
- Title sanitization (trimming, control characters, newlines, multiple spaces)
- Title truncation (200 char max)
- Default title handling for invalid input
- Timestamp initialization (createdAt, updatedAt, lastMessageAt)
- Message count initialization
- Unicode and emoji support
- Multiple chats per user
- Duplicate titles allowed

**chats.list query (11 tests)**
- Basic listing with pagination
- Empty result handling
- User ownership filtering
- Soft-deleted chat filtering
- Custom and default limits (50 default, 200 max)
- Invalid limit handling (negative, zero, NaN, Infinity)
- Field exclusion for bandwidth optimization
- Descending order by update time
- Pagination cursor support

**chats.get query (5 tests)**
- Ownership verification
- Non-existent chat handling
- Soft-deleted chat filtering
- Complete field inclusion

**chats.remove mutation (soft delete) (8 tests)**
- Soft delete with ownership check
- Cascading message soft delete
- Non-existent chat handling
- Already deleted chat handling
- Message count reset
- Deletion with no messages
- List/get exclusion after deletion

**chats.checkExportRateLimit mutation (2 tests)**
- Rate limit checking
- Multiple checks within limit

## messages.test.ts (33 tests)

Comprehensive tests for message management functions:

**messages.list query (8 tests)**
- Basic message listing
- Empty chat handling
- User ownership verification
- Soft-deleted message filtering
- Chronological ordering (ascending)
- Field exclusion for bandwidth optimization
- Reasoning content inclusion
- Client message ID support

**messages.send mutation (6 tests)**
- User message sending
- User + assistant message pair sending
- Ownership verification
- Custom timestamp support
- Chat timestamp updates
- Client message ID storage

**messages.streamUpsert mutation (19 tests)**
- New message creation
- Existing message updates
- Status handling (streaming/completed)
- Reasoning content storage
- Role validation (user/assistant only)
- Content length validation (100KB max, byte-based)
- Max messages per chat enforcement (10,000)
- Message count tracking
- Client message ID deduplication
- Empty and whitespace content
- Unicode character byte counting
- Chat timestamp updates on completion
- Ownership verification

## Running Tests

```bash
# Run all tests
cd apps/server
bun test

# Run specific test file
bun test chats.test.ts
bun test messages.test.ts

# Watch mode
bun test --watch

# Coverage
bun test:coverage
```

## Test Setup

Tests use:
- **vitest**: Test framework
- **convex-test**: Convex mock backend for isolated testing
- **Local schema**: Uses actual Convex schema from `schema.ts`

Each test suite:
1. Creates a fresh Convex test instance
2. Sets up test users
3. Runs isolated tests
4. Cleans up automatically

## Known Issues

Some tests currently fail due to:
- Rate limiter component not being registered in test environment
- This is expected for tests that trigger rate limiting

To fix: Register the rate limiter component in test setup or mock it.

## Test Coverage

- **chats.ts**: 44 tests covering all functions
- **messages.ts**: 33 tests covering core functions
- **Total**: 77 comprehensive tests

## Test Categories

- **Validation**: Input sanitization, length limits, role validation
- **Security**: Ownership checks, soft-delete filtering
- **Performance**: Bandwidth optimization, index usage
- **Edge Cases**: Empty data, invalid input, boundary conditions
- **Integration**: Cross-function behavior (chat + message deletion)
