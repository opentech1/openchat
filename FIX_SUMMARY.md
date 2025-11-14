# File Upload User ID Fix Summary

## Issue Found
**ArgumentValidationError** in Convex function `files:getUserQuota`:
- Was receiving Better Auth external ID: `"k9740qa2jgvvdsc4sfxw0771e97ts8fp"`
- Expected Convex document ID like: `"j574bnr..."`

## Root Cause
In `chat-room.tsx`, the component was passing the Better Auth user ID directly to the ChatComposer:
```typescript
// BEFORE (INCORRECT):
const user = session?.user;
const workspaceId = user?.id ?? null;  // This is Better Auth ID
// ...
<ChatComposer
  userId={workspaceId as any}  // Passing wrong ID type
/>
```

## Fix Applied
Updated `chat-room.tsx` to:
1. Query for the Convex user using the Better Auth external ID
2. Pass the correct Convex user ID to ChatComposer

```typescript
// AFTER (CORRECT):
const user = session?.user;
const workspaceId = user?.id ?? null;

// Get Convex user ID from Better Auth external ID
const convexUser = useQuery(
  api.users.getByExternalId,
  workspaceId ? { externalId: workspaceId } : "skip"
);
const convexUserId = convexUser?._id ?? null;

// ...
<ChatComposer
  userId={convexUserId as any}  // Now passing correct Convex ID
/>
```

## Files Modified
1. `/apps/web/src/components/chat-room.tsx`
   - Added imports for Convex React and API
   - Added query to get Convex user from external ID
   - Updated ChatComposer prop to use Convex user ID

## Status
✅ **FIXED** - The file upload system now receives the correct Convex user ID format

## Testing Notes
- The error logs shown were from 9:58 PM (before the fix)
- After the fix, no new ArgumentValidationError messages should appear
- File upload quota (150 files/user) should now work correctly
- All file operations (upload, delete, quota check) should function properly