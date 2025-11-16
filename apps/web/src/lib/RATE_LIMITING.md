# Rate Limiting

Production-ready distributed rate limiting system with automatic Redis/in-memory mode selection.

## Overview

OpenChat uses a dual-mode rate limiting system that automatically selects the appropriate implementation based on your deployment environment:

- **In-Memory Mode** (default): Fast and simple, perfect for development and single-instance deployments
- **Redis Mode** (production): Distributed rate limiting across all instances using Upstash Redis REST API

## Quick Start

### Development (In-Memory)

No configuration needed! The system uses in-memory rate limiting by default:

```bash
bun run dev
```

### Production (Redis)

1. **Create an Upstash Redis database**:
   - Visit https://console.upstash.com/redis
   - Create a new database (Global recommended for low latency worldwide)
   - Copy the REST URL and REST TOKEN

2. **Set environment variables**:

```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

3. **Install the optional dependency** (if not already installed):

```bash
bun add @upstash/redis
```

4. **Deploy and enjoy distributed rate limiting!**

The system will automatically detect the Redis credentials and use distributed rate limiting across all instances.

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint | - |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | - |
| `RATE_LIMIT_MODE` | Force mode: `redis` \| `memory` | Auto-detect |
| `RATE_LIMIT_FAIL_OPEN` | Allow requests on Redis errors | `true` |
| `CHAT_CREATE_RATE_LIMIT` | Max chat creations per window | `10` |
| `CHAT_CREATE_WINDOW_MS` | Rate limit window (milliseconds) | `60000` (1 minute) |
| `OPENROUTER_RATE_LIMIT_PER_MIN` | Max API requests per minute | `30` |

### Rate Limit Configuration

You can customize rate limits in your code:

```typescript
import { createRateLimiter } from "@/lib/rate-limit";

// Auto-detect mode based on environment
const limiter = await createRateLimiter({
  limit: 100,
  windowMs: 60000, // 1 minute
});

// Force in-memory mode (for testing)
const memoryLimiter = await createRateLimiter(
  { limit: 100, windowMs: 60000 },
  { mode: "memory" }
);

// Force Redis mode with custom credentials
const redisLimiter = await createRateLimiter(
  { limit: 100, windowMs: 60000 },
  {
    mode: "redis",
    redisUrl: "https://...",
    redisToken: "...",
    failOpen: true, // Allow requests on Redis errors
  }
);
```

## Implementation Details

### Architecture

```
┌─────────────────────────────────────────┐
│         createRateLimiter()             │
│    (Automatic mode selection)           │
└───────────────┬─────────────────────────┘
                │
        ┌───────┴───────┐
        │               │
┌───────▼────────┐ ┌────▼────────────┐
│ RateLimiter    │ │RedisRateLimiter │
│ (In-Memory)    │ │(Upstash Redis)  │
└────────────────┘ └─────────────────┘
```

### Sliding Window Algorithm

Both implementations use the same sliding window algorithm:

1. Each request adds a timestamp to a sorted set (Redis) or map (in-memory)
2. Old entries outside the window are automatically removed
3. Request count is checked against the limit
4. Rate limit headers are returned to the client

**Time Complexity**: O(log N + M) where:
- N = total requests in window
- M = expired entries removed (typically few)

**Space Complexity**: O(N) where N = requests in window

### Redis Implementation (Upstash)

**Features**:
- ✅ Serverless-native REST API (no persistent connections)
- ✅ Global edge network for low latency
- ✅ Automatic scaling and high availability
- ✅ Atomic operations via pipelines
- ✅ Automatic expiry to prevent memory leaks
- ✅ Graceful degradation (fail-open/fail-closed)

**Pipeline Operations**:
```typescript
1. ZREMRANGEBYSCORE key 0 windowStart  // Remove old entries
2. ZADD key timestamp random-id         // Add current request
3. ZCARD key                            // Count requests in window
4. EXPIRE key ttl                       // Set expiry for cleanup
```

### In-Memory Implementation

**Features**:
- ✅ Zero external dependencies
- ✅ Lazy cleanup (serverless-friendly)
- ✅ Bounded memory usage (maxBuckets limit)
- ✅ Perfect for development and single-instance deployments

**Note**: In-memory rate limits are per-instance, not shared across servers.

## Usage Examples

### Basic Usage

```typescript
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";

export async function POST(request: Request) {
  // Create rate limiter (reuse across requests)
  const limiter = await createRateLimiter({
    limit: 10,
    windowMs: 60000, // 1 minute
  });

  // Check rate limit
  const ip = getClientIp(request);
  const result = await limiter.check(ip);

  if (result.limited) {
    return new Response("Too many requests", {
      status: 429,
      headers: {
        "Retry-After": result.retryAfter!.toString(),
        "X-RateLimit-Limit": "10",
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  // Process request...
  return new Response("Success");
}
```

### Multiple Rate Limits

```typescript
// Different limits for different endpoints
const chatLimiter = await createRateLimiter({
  limit: 10,
  windowMs: 60000,
});

const apiLimiter = await createRateLimiter({
  limit: 100,
  windowMs: 60000,
});

// Different limits for authenticated vs anonymous users
const identifier = userId ? `user:${userId}` : `ip:${ip}`;
const result = await limiter.check(identifier);
```

### Composite Identifiers

```typescript
// Rate limit by both IP and user ID
const identifier = `${ip}:${userId}`;
const result = await limiter.check(identifier);

// Rate limit by API key
const identifier = `apikey:${apiKey}`;
const result = await limiter.check(identifier);
```

## Monitoring

### Upstash Dashboard

Monitor your Redis rate limiter in real-time:
- https://console.upstash.com/redis/[your-db-id]/details

Metrics available:
- Request count
- Memory usage
- Latency (p50, p99)
- Error rate

### Application Metrics

Get rate limiter statistics:

```typescript
const stats = await limiter.getStats();
console.log(stats);
// {
//   totalBuckets: 150,
//   config: {
//     limit: 10,
//     windowMs: 60000,
//     maxBuckets: 10000
//   }
// }
```

## Testing

### Unit Tests

```typescript
import { createRateLimiter } from "@/lib/rate-limit";

describe("Rate Limiter", () => {
  it("should allow requests within limit", async () => {
    const limiter = await createRateLimiter(
      { limit: 2, windowMs: 60000 },
      { mode: "memory" } // Force in-memory for tests
    );

    const result1 = await limiter.check("test-user");
    expect(result1.limited).toBe(false);

    const result2 = await limiter.check("test-user");
    expect(result2.limited).toBe(false);

    const result3 = await limiter.check("test-user");
    expect(result3.limited).toBe(true);
  });
});
```

### Integration Tests

Test with a real Upstash Redis instance:

```typescript
const limiter = await createRateLimiter(
  { limit: 10, windowMs: 60000 },
  {
    mode: "redis",
    redisUrl: process.env.TEST_REDIS_URL,
    redisToken: process.env.TEST_REDIS_TOKEN,
  }
);

// Clean up after tests
afterEach(async () => {
  await limiter.clear();
});
```

## Troubleshooting

### Redis Connection Issues

**Problem**: Rate limiter falls back to in-memory mode

**Solutions**:
1. Check environment variables are set correctly
2. Verify Upstash Redis credentials at https://console.upstash.com/redis
3. Check network connectivity to Upstash endpoints
4. Review application logs for Redis errors

### Rate Limit Not Shared Across Instances

**Problem**: Each server has its own rate limits

**Cause**: Using in-memory mode instead of Redis

**Solution**: Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables

### High Latency

**Problem**: Rate limit checks are slow

**Solutions**:
- Use Upstash Global database (not Regional) for worldwide low latency
- Check your network latency to Upstash edge nodes
- Consider caching rate limit results for a few seconds

### Memory Leaks

**Problem**: In-memory rate limiter using too much memory

**Solutions**:
- Reduce `maxBuckets` configuration (default: 10,000)
- Switch to Redis mode for distributed deployments
- Clean up rate limits periodically: `await limiter.clear()`

## Best Practices

### 1. Reuse Rate Limiter Instances

Create rate limiters once and reuse them:

```typescript
// ✅ Good - create once per module
let rateLimiterPromise: Promise<IRateLimiter> | null = null;

async function getRateLimiter() {
  if (!rateLimiterPromise) {
    rateLimiterPromise = createRateLimiter({ limit: 10, windowMs: 60000 });
  }
  return rateLimiterPromise;
}

// ❌ Bad - creates new instance on every request
export async function POST(request: Request) {
  const limiter = await createRateLimiter({ limit: 10, windowMs: 60000 });
  // ...
}
```

### 2. Choose Appropriate Identifiers

- **Anonymous users**: Use IP address (beware of NAT/proxies)
- **Authenticated users**: Use user ID
- **API keys**: Use API key
- **Pre-authentication**: Use session token
- **Multi-layer**: Combine identifiers (e.g., `${ip}:${userId}`)

### 3. Set Reasonable Limits

Start conservative and adjust based on usage:
- Chat creation: 10-20 per minute
- API endpoints: 30-100 per minute
- File uploads: 5-10 per minute

### 4. Handle Rate Limit Errors Gracefully

```typescript
if (result.limited) {
  return new Response("Too many requests. Please try again later.", {
    status: 429,
    headers: {
      "Retry-After": result.retryAfter!.toString(),
      "X-RateLimit-Limit": config.limit.toString(),
      "X-RateLimit-Remaining": "0",
      "X-RateLimit-Reset": result.resetAt!.toString(),
    },
  });
}
```

### 5. Monitor and Alert

Set up alerts for:
- High rate limit rejection rate (> 5%)
- Redis errors (if using Redis mode)
- Memory usage (if using in-memory mode)
- Unusual traffic patterns

## Migration Guide

### From In-Memory to Redis

1. **Set up Upstash Redis** (see Quick Start)

2. **Update environment variables**:
```bash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

3. **Install dependency**:
```bash
bun add @upstash/redis
```

4. **Deploy** - no code changes needed! The system auto-detects Redis credentials.

### From ioredis to Upstash Redis

If you're migrating from the old `ioredis` implementation:

1. **Update package.json**:
```diff
  "optionalDependencies": {
-   "ioredis": "^5.3.2"
+   "@upstash/redis": "^1.38.0"
  }
```

2. **Update environment variables**:
```diff
- REDIS_URL=redis://localhost:6379
+ UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
+ UPSTASH_REDIS_REST_TOKEN=your_token_here
```

3. **No code changes needed** - the abstraction layer handles everything!

## FAQ

**Q: When should I use Redis vs in-memory?**

A: Use Redis for production multi-instance deployments. Use in-memory for development and single-instance deployments.

**Q: Does this work with serverless (Vercel, AWS Lambda, etc.)?**

A: Yes! Upstash Redis uses a REST API that's perfect for serverless environments. No persistent connections needed.

**Q: What happens if Redis goes down?**

A: By default, the system "fails open" (allows requests) when Redis is unavailable. You can configure it to "fail closed" (deny requests) by setting `RATE_LIMIT_FAIL_OPEN=false`.

**Q: Can I use a different Redis provider?**

A: The current implementation is optimized for Upstash Redis REST API. For other providers, you'll need to modify `rate-limit-redis.ts` to use their SDK.

**Q: How accurate is the sliding window?**

A: Very accurate! Both implementations use the same algorithm with millisecond precision.

**Q: Can I reset rate limits for specific users?**

A: Yes! Use `await limiter.reset(identifier)` to reset the rate limit for a specific user/IP.

## Security Considerations

### IP Spoofing

IP-based rate limiting can be spoofed if not behind a trusted proxy:

```typescript
// Use strict mode if NOT behind a trusted proxy
const ip = getClientIp(request, "strict");

// Use x-forwarded-for if behind a trusted proxy (Cloudflare, nginx, etc.)
const ip = getClientIp(request, "x-forwarded-for");
```

### User Enumeration

Rate limit BEFORE user validation to prevent timing attacks:

```typescript
// ✅ Good - rate limit first
const rateLimitResult = await limiter.check(sessionToken);
if (rateLimitResult.limited) {
  return new Response("Too many requests", { status: 429 });
}

const user = await validateUser(sessionToken);

// ❌ Bad - allows user enumeration via timing
const user = await validateUser(sessionToken);
const rateLimitResult = await limiter.check(user.id);
```

### DDoS Protection

Rate limiting alone is not enough for DDoS protection. Also implement:
- Network-level protection (Cloudflare, AWS Shield)
- Connection limits
- Request size limits
- CAPTCHA challenges for suspicious behavior

## Support

- **Issues**: https://github.com/your-org/openchat/issues
- **Upstash Docs**: https://docs.upstash.com/redis
- **Upstash Support**: https://console.upstash.com/support

## License

Same as OpenChat project license.
