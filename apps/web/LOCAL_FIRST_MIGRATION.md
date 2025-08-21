# Local-First Database Migration Guide

This guide covers the complete migration to a local-first architecture using wa-sqlite with cloud synchronization for your OpenChat application.

## Overview

The new architecture provides:
- **Local-first**: All data operations work offline
- **Automatic sync**: Background synchronization with cloud
- **Conflict resolution**: Intelligent handling of conflicting changes
- **Multiple modes**: Local-only, cloud-only, or hybrid operation
- **Performance**: Fast local queries with web worker isolation

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   React App     │◄──►│   Local DB       │◄──►│   Cloud API      │
│   (UI Layer)    │    │   (wa-sqlite)    │    │   (Your Server)  │
└─────────────────┘    └──────────────────┘    └──────────────────┘
                               │
                       ┌──────────────────┐
                       │   Web Worker     │
                       │   (DB Operations)│
                       └──────────────────┘
```

## Installation

The required dependencies are already installed:
- `wa-sqlite`: SQLite compiled to WebAssembly
- `nanoid`: For generating unique IDs

## Core Components

### 1. Database Schema (`/src/lib/db/schema/shared.ts`)
Shared schema that works both locally and in the cloud:
- `user`: User information
- `chat`: Chat conversations
- `message`: Individual messages
- `sync_event`: Change tracking for synchronization
- `device`: Device registration and sync timestamps
- `sync_config`: User sync preferences

### 2. Local Database Manager (`/src/lib/db/local-db.ts`)
Main interface for local database operations:
- CRUD operations for all entities
- Automatic sync event creation
- Web worker communication
- Device fingerprinting

### 3. Sync Manager (`/src/lib/db/sync-manager.ts`)
Handles synchronization between local and cloud:
- Bidirectional sync
- Conflict detection and resolution
- Network status monitoring
- Configurable sync modes

### 4. Web Worker (`/public/db-worker.js`)
Isolated database operations:
- SQLite WebAssembly initialization
- OPFS/IndexedDB persistence
- SQL query execution
- Transaction handling

## Usage Examples

### Basic Setup

```tsx
import { useLocalDatabase, useChats, useMessages } from '@/hooks/use-local-database';

function ChatApp({ userId }: { userId: string }) {
  const { 
    isInitialized, 
    syncStatus, 
    triggerSync 
  } = useLocalDatabase({ userId });
  
  const { 
    chats, 
    createChat, 
    deleteChat 
  } = useChats(userId);
  
  if (!isInitialized) {
    return <div>Initializing local database...</div>;
  }
  
  return (
    <div>
      <div>Sync Status: {syncStatus.syncing ? 'Syncing...' : 'Ready'}</div>
      <div>Pending Changes: {syncStatus.pendingChanges}</div>
      
      {chats.map(chat => (
        <ChatItem key={chat.id} chat={chat} />
      ))}
    </div>
  );
}
```

### Chat Messages

```tsx
import { useMessages } from '@/hooks/use-local-database';

function ChatMessages({ chatId }: { chatId: string }) {
  const { 
    messages, 
    addMessage, 
    deleteMessage 
  } = useMessages(chatId);
  
  const handleSendMessage = async (content: string) => {
    await addMessage(content, 'user');
  };
  
  return (
    <div>
      {messages.map(message => (
        <div key={message.id}>
          <strong>{message.role}:</strong> {message.content}
          <button onClick={() => deleteMessage(message.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

### Sync Configuration

```tsx
import { SyncSettings } from '@/components/sync-settings';

function SettingsPage({ userId }: { userId: string }) {
  return (
    <div>
      <h1>Settings</h1>
      <SyncSettings userId={userId} />
    </div>
  );
}
```

## Migration Steps

### 1. Update Your Server Schema

Ensure your cloud database schema matches the local schema. Add these tables if they don't exist:

```sql
-- Example for your Cloudflare D1 database
CREATE TABLE sync_event (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  data TEXT,
  timestamp INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  synced INTEGER DEFAULT 0
);

CREATE TABLE device (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  last_sync_at INTEGER,
  created_at INTEGER NOT NULL
);
```

### 2. Implement Cloud API Interface

Create an API adapter that matches the `CloudAPI` interface:

```typescript
// /src/lib/api/cloud-adapter.ts
import type { CloudAPI } from '@/lib/db/sync-manager';

export class OpenChatCloudAPI implements CloudAPI {
  async getChats(userId: string, lastSyncTimestamp?: number) {
    // Implement using your existing API endpoints
    const response = await fetch(`/api/chats?userId=${userId}&since=${lastSyncTimestamp}`);
    return response.json();
  }
  
  async createChat(chat: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>) {
    const response = await fetch('/api/chats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chat)
    });
    return response.json();
  }
  
  // ... implement other methods
}
```

### 3. Update Your Components

Replace direct API calls with local database operations:

```tsx
// Before
const [chats, setChats] = useState([]);
useEffect(() => {
  fetch('/api/chats').then(r => r.json()).then(setChats);
}, []);

// After
const { chats } = useChats(userId);
```

### 4. Initialize Sync Manager

```tsx
// In your app root or provider
import { getSyncManager } from '@/lib/db/sync-manager';
import { OpenChatCloudAPI } from '@/lib/api/cloud-adapter';

export function AppProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const cloudApi = new OpenChatCloudAPI();
    const syncManager = getSyncManager(cloudApi);
    
    // Start auto-sync when user logs in
    if (userId) {
      syncManager.startAutoSync(userId);
    }
    
    return () => {
      syncManager.cleanup();
    };
  }, [userId]);
  
  return <>{children}</>;
}
```

## Sync Modes

### Local-Only Mode
- All data stored only on device
- No network requests
- Perfect for privacy-sensitive scenarios
- Data lost if device is lost

### Cloud-Only Mode
- Traditional client-server architecture
- Requires internet connection
- All operations go through API
- No offline capability

### Hybrid Mode (Recommended)
- Local storage with cloud backup
- Works offline
- Automatic synchronization
- Conflict resolution
- Best user experience

## Conflict Resolution

The system automatically resolves most conflicts:

1. **Deletion conflicts**: Non-deleted version wins
2. **Timestamp conflicts**: Most recent change wins
3. **Content conflicts**: Cloud version wins (for messages)

For manual resolution:

```tsx
import { getSyncManager } from '@/lib/db/sync-manager';

const syncManager = getSyncManager();

await syncManager.resolveConflict(
  'chat',
  'chat-id',
  'local' // or 'cloud' or 'merge'
);
```

## Error Handling

```tsx
import { getDatabaseErrorHandler, getUserFriendlyErrorMessage } from '@/lib/db/error-handler';

const errorHandler = getDatabaseErrorHandler();

try {
  await someOperation();
} catch (error) {
  const dbError = errorHandler.handleError(error);
  const userMessage = getUserFriendlyErrorMessage(dbError);
  
  // Show user-friendly message
  showToast(userMessage);
  
  // Attempt recovery if possible
  if (await errorHandler.recoverFromError(dbError)) {
    // Retry operation
  }
}
```

## Performance Optimizations

1. **Web Worker**: Database operations don't block UI
2. **OPFS Storage**: Faster than IndexedDB when available
3. **Batch Operations**: Multiple changes in single transaction
4. **Lazy Loading**: Load only needed data
5. **Connection Pooling**: Reuse database connections

## Testing

Run the comprehensive test suite:

```bash
bun test src/__tests__/local-database.test.ts
```

Tests cover:
- All CRUD operations
- Sync functionality
- Conflict resolution
- Error handling
- Performance scenarios

## Monitoring and Debugging

### Sync Status Component

```tsx
function SyncStatusIndicator() {
  const { syncStatus } = useLocalDatabase();
  
  return (
    <div className={`sync-status ${syncStatus.isOnline ? 'online' : 'offline'}`}>
      {syncStatus.syncing && 'Syncing...'}
      {syncStatus.pendingChanges > 0 && `${syncStatus.pendingChanges} pending`}
      {syncStatus.error && `Error: ${syncStatus.error}`}
    </div>
  );
}
```

### Debug Information

```tsx
function DebugPanel() {
  const { database, syncManager } = useLocalDatabase();
  
  const exportData = async () => {
    const data = await syncManager.exportLocalData();
    console.log('Local data:', data);
  };
  
  return (
    <div>
      <button onClick={exportData}>Export Local Data</button>
      <button onClick={() => syncManager.triggerSync()}>Force Sync</button>
    </div>
  );
}
```

## Best Practices

1. **Always handle errors gracefully**
2. **Provide offline indicators to users**
3. **Test sync scenarios thoroughly**
4. **Monitor storage quota usage**
5. **Implement data cleanup strategies**
6. **Use optimistic updates for better UX**
7. **Batch operations when possible**
8. **Provide manual sync controls**

## Migration Checklist

- [ ] Install wa-sqlite dependency
- [ ] Copy all local database files
- [ ] Update server schema to support sync tables
- [ ] Implement CloudAPI interface
- [ ] Replace API calls with local database hooks
- [ ] Add sync configuration UI
- [ ] Test offline scenarios
- [ ] Test conflict resolution
- [ ] Add error handling and user feedback
- [ ] Performance test with large datasets
- [ ] Deploy and monitor

## Troubleshooting

### Common Issues

1. **Worker fails to initialize**
   - Check CORS settings for worker files
   - Ensure wa-sqlite WASM files are accessible
   - Verify browser WebAssembly support

2. **Sync conflicts**
   - Check network connectivity
   - Verify API endpoint compatibility
   - Review conflict resolution logs

3. **Storage quota exceeded**
   - Implement data cleanup
   - Consider data archiving
   - Monitor storage usage

4. **Performance issues**
   - Check if operations are blocking main thread
   - Optimize query patterns
   - Consider pagination for large datasets

### Debug Tools

```typescript
// Enable verbose logging
const errorHandler = getDatabaseErrorHandler({
  enableLogging: true,
  onError: (error) => {
    // Send to monitoring service
    console.error('Database error:', error);
  }
});

// Monitor sync events
const syncManager = getSyncManager();
syncManager.onStatusChange((status) => {
  console.log('Sync status changed:', status);
});
```

## Future Enhancements

1. **Real-time sync**: WebSocket-based instant synchronization
2. **Collaborative editing**: Operational transforms for real-time collaboration
3. **Advanced caching**: Intelligent prefetching and cache management
4. **Data compression**: Reduce storage footprint
5. **Encryption**: End-to-end encrypted local storage
6. **Multi-device coordination**: Better conflict resolution across devices

This migration provides a robust foundation for offline-first operation while maintaining seamless cloud synchronization. The architecture scales well and provides excellent user experience across all network conditions.