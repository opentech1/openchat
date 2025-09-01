# Test Plan for Stop/Resume Bug Fix

## Bug Summary
The Continue button disappears after stopping a stream twice because of an async timing issue in the `stopGeneration` function when handling continuation stops.

## Root Cause
In the original code, when stopping during a continuation:
1. `updateMessage()` is called (async operation)
2. The function immediately returns and clears `continuingMessageId` and `streamingContent`
3. The async `.then()` callback that updates `stoppedStreams` Map executes AFTER the component re-renders
4. The `stoppedStreams` Map update doesn't take effect, so `canResume` is not set

## Fix Applied
Moved the state clearing operations (`setIsLoading`, `setContinuingMessageId`, `setStreamingContent`) inside the `.then()` callback of `updateMessage()`, ensuring:
1. The `stoppedStreams` Map is updated with `canResume: true` BEFORE clearing state
2. The component re-renders with the correct `stoppedStreams` Map state
3. The Continue button remains visible

## Test Steps
1. Start a chat and send a message that generates a long response
2. Click Stop button while streaming - Continue button should appear ✓
3. Click Continue button - streaming should resume ✓
4. Click Stop button again - **Continue button should appear** (this was failing before)
5. Click Continue again - streaming should resume ✓
6. Repeat steps 4-5 multiple times - Continue button should always appear after stopping

## Code Changes
File: `/home/gl1/openchat/apps/web/src/app/chat/[chatId]/chat-client-v2.tsx`

### Changed in `stopGeneration()` function:
- Moved `setIsLoading(false)`, `setContinuingMessageId(null)`, and `setStreamingContent('')` from lines 184-186
- Placed them inside the `.then()` callback after updating `stoppedStreams` Map (lines 178-180)
- Added error handling to also clear state in `.catch()` block

### Changed in `continueGeneration()` function:
- Added `wasStoppedEarly` flag to track if continuation was stopped
- Updated condition from checking `abortControllerRef.current?.signal.aborted` to using `wasStoppedEarly`
- This ensures consistent behavior between initial streams and continuations

## Expected Behavior After Fix
- Users can stop and resume streaming responses unlimited times
- The Continue button always appears when a stream is stopped (not completed)
- The `stoppedStreams` Map is properly maintained with `canResume: true` for stopped messages
- No duplicate content or missing Continue buttons