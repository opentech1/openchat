# OpenRouter OAuth - Quick Start Guide

## 5-Minute Integration

### Option 1: Simple Button (Fastest)

Add to any component:

```typescript
import { useOpenRouterOAuth } from '@/hooks/use-openrouter-oauth';

export function MyComponent() {
  const { initiateLogin, isLoading, error } = useOpenRouterOAuth();

  return (
    <button onClick={initiateLogin} disabled={isLoading}>
      {isLoading ? 'Connecting...' : 'Connect OpenRouter'}
    </button>
  );
}
```

### Option 2: Full Settings Integration

Replace your existing API key section:

```typescript
// In settings component
import { ApiKeySectionWithOAuth } from '@/components/settings/api-key-section-with-oauth';

<ApiKeySectionWithOAuth
  hasStoredKey={hasKey}
  onKeyChanged={() => {
    // Refresh key status
  }}
/>
```

## Environment Setup

Add to `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For production:

```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## How It Works

1. User clicks "Connect"
2. Redirects to OpenRouter
3. User authorizes
4. Redirects to `/openrouter/callback`
5. Exchanges code for API key
6. Encrypts and stores key
7. Redirects to dashboard

## Testing

1. Start dev server: `npm run dev`
2. Go to settings
3. Click "Connect with OpenRouter OAuth"
4. Authorize on OpenRouter
5. Done!

## Files You Created

All implementation files are in:
- `/apps/web/src/lib/openrouter-oauth.ts` - Core utilities
- `/apps/web/src/app/openrouter/callback/page.tsx` - Callback handler
- `/apps/web/src/hooks/use-openrouter-oauth.ts` - React hook
- `/apps/web/src/components/settings/api-key-section-with-oauth.tsx` - Example UI

## Troubleshooting

**Error: "Code verifier not found"**
- Clear browser cache and try again
- Ensure cookies/sessionStorage are enabled

**Error: "Failed to exchange code"**
- Check network connection
- Verify environment variables are set
- Try restarting the OAuth flow

**Error: "Failed to save key"**
- Ensure user is logged in
- Check Convex connection
- Verify database permissions

## Next Steps

- Read full documentation: `/apps/web/src/lib/OPENROUTER_OAUTH_INTEGRATION.md`
- Read implementation summary: `/OPENROUTER_OAUTH_IMPLEMENTATION_SUMMARY.md`
- Run tests: `npm test openrouter-oauth.test.ts`

## Support

All error messages are user-friendly and include recovery instructions. Check browser console for detailed error logs.
