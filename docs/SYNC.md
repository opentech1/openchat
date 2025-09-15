# Sync over WebSocket (/sync)

This document describes v1 of the in-memory sync system.

## Endpoint

- URL: `wss://<server>/sync` (served by Elysia in `apps/server`)
- One connection per tab.
- Auth on connect: accept Clerk Bearer token (same as `/rpc`) or dev `x-user-id`.
  - For browsers (no custom headers), a Bearer token may be passed as `?token=...` query param.
  - Dev fallback accepts `?x-user-id=...` when Clerk is not configured.

## Topics

- `chats:index:{userId}` — user’s chat list updates (sidebar)
- `chat:{chatId}` — a single chat’s message feed

## Events

- `system.hello`                 `{ serverTime }`
- `chats.index.add`              `{ chatId, title, updatedAt, lastMessageAt }`
- `chats.index.update`           `{ chatId, updatedAt, lastMessageAt, title? }`
- `chat.new`                     `{ chatId, messageId, role, content, createdAt }`

Notes:

- `messages.send` writes two rows (user then assistant "test"). The server emits two `chat.new` events in order (ascending by `createdAt`).
- When a message is written, the server also emits `chats.index.update` so the sidebar can reorder by `lastMessageAt`.

## Envelope

All WS messages use this shape:

```
{ id, ts, topic, type, data }
```

- `id`: unique per event
- `ts`: server timestamp (ms)
- `topic`: one of the topics above
- `type`: one of the event types above
- `data`: event payload

## Server

1) Sync Hub (in-memory)

- `Map<topic, Set<WebSocket>>` plus `WeakMap<WebSocket, Set<topic>>` for cleanup.
- API:
  - `subscribe(ws, topic)`
  - `unsubscribe(ws, topic)`
  - `publish(topic, type, data)` → fan-out envelope to sockets subscribed to topic
  - Enforces per-socket subscription cap (≤ 50) and per-event payload size (≤ 8 KB).

2) `/sync` route (Elysia)

- Upgrades to WebSocket.
- On connect: verifies token like `createContext` does for `/rpc`. If unauthenticated, closes with code 1008.
- Receives messages:
  - `{"op":"sub", topic}` → subscribe the socket (authorization enforced)
  - `{"op":"unsub", topic}` → unsubscribe
  - `"ping"` or `{"op":"ping"}` → replies `"pong"`
- On open: sends `system.hello` envelope.

3) Emit on write (after DB commit)

- `chats.create()` → `publish("chats:index:{userId}", "chats.index.add", ...)`
- `messages.send()` →
  - After user message insert → `publish("chat:{chatId}", "chat.new", ...)`
  - After assistant message insert → `publish("chat:{chatId}", "chat.new", ...)`
  - After updating chat timestamps → `publish("chats:index:{userId}", "chats.index.update", ...)`

4) Security & limits

- Reject unauthenticated connections.
- Reject subscriptions to topics that don’t belong to the authenticated user.
- Cap per-socket subscriptions (≤ 50 topics) and per-event payload size (≤ 8 KB).
- Cleanup subscriptions on socket close to avoid memory growth.

## Web

1) Sync client (one socket per tab)

- `src/lib/sync.ts` with:
  - `connect()` → opens `wss://<server>/sync`
  - `subscribe(topic, handler)` / `unsubscribe(topic, handler)`
  - Internally keeps a single WS; multiplexes topics; reconnects on drop; resubscribes on reconnect.
  - Uses Clerk’s `window.Clerk.session.getToken()` to pass a Bearer token as `?token=...` query param.

2) Sidebar live updates

- `AppSidebar` uses local state initialized from SSR `initialChats`.
- On mount subscribes to `chats:index:{me}`.
  - On `chats.index.add`: appends chat if missing.
  - On `chats.index.update`: updates timestamps/title and re-sorts by `lastMessageAt` then `updatedAt` (desc).

3) Chat view live updates

- `ChatRoom` keeps SSR `initialMessages` for first paint.
- On mount subscribes to `chat:{chatId}`.
  - On `chat.new`: appends if not already present (id de-dupe); list stays sorted by `createdAt` ascending.
- Keeps existing optimistic UI and POST `/api/chat/send`.

## ENV / Config

- Uses `NEXT_PUBLIC_SERVER_URL` for WS base.
- CSP already allows `ws:` and `wss:`.

## Acceptance tests (manual, v1)

- Open Tab A and Tab B (same account). Create a new chat on A → it appears in B’s sidebar within < 200 ms.
- In that chat on A, send a message → B sees both user and assistant messages appear, and the chat bumps to top of sidebar.
- Open the same account on a second device → create/send there, both tabs on the first device update too.

## Out of scope

- Presence/typing, AI streaming over WS, file uploads, Redis/Valkey, outbox/WAL, multi-tenant topics, moderation, notifications.

