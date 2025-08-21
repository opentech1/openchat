import { getLocalDatabase } from './local-db';
import type { SyncEvent, SyncConfig, Chat, Message, User } from './schema/shared';

interface CloudAPI {
  // Define your cloud API interface based on your server endpoints
  getChats(userId: string, lastSyncTimestamp?: number): Promise<Chat[]>;
  getMessages(chatId: string, lastSyncTimestamp?: number): Promise<Message[]>;
  createChat(chat: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>): Promise<Chat>;
  createMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  updateChat(id: string, updates: Partial<Chat>): Promise<Chat>;
  deleteChat(id: string): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  getSyncEvents(userId: string, since: number): Promise<SyncEvent[]>;
}

type SyncMode = 'local-only' | 'cloud-only' | 'hybrid';

interface SyncStatus {
  isOnline: boolean;
  lastSync: Date | null;
  pendingChanges: number;
  syncing: boolean;
  error: string | null;
}

export class SyncManager {
  private localDb = getLocalDatabase();
  private cloudApi: CloudAPI | null = null;
  private syncTimer: NodeJS.Timeout | null = null;
  private syncDebounceTimer: NodeJS.Timeout | null = null;
  private syncStatus: SyncStatus = {
    isOnline: navigator.onLine,
    lastSync: null,
    pendingChanges: 0,
    syncing: false,
    error: null
  };
  private statusCallbacks = new Set<(status: SyncStatus) => void>();

  constructor(cloudApi?: CloudAPI) {
    this.cloudApi = cloudApi || null;
    this.setupNetworkListeners();
    this.updatePendingChangesCount();
  }

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.syncStatus.isOnline = true;
      this.notifyStatusChange();
      this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.syncStatus.isOnline = false;
      this.notifyStatusChange();
    });
    
    // Listen for local database changes for real-time sync
    window.addEventListener('local-db-change', (event: any) => {
      const { userId } = event.detail;
      if (userId && this.syncStatus.isOnline) {
        this.triggerSync(userId);
      }
    });
  }

  private async updatePendingChangesCount(): Promise<void> {
    try {
      const events = await this.localDb.getUnsyncedEvents();
      this.syncStatus.pendingChanges = events.length;
      this.notifyStatusChange();
    } catch (error) {
      console.error('Failed to update pending changes count:', error);
    }
  }

  private notifyStatusChange(): void {
    this.statusCallbacks.forEach(callback => callback({ ...this.syncStatus }));
  }

  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusCallbacks.add(callback);
    return () => this.statusCallbacks.delete(callback);
  }

  getStatus(): SyncStatus {
    return { ...this.syncStatus };
  }

  async startAutoSync(userId: string): Promise<void> {
    const config = await this.localDb.getSyncConfig(userId);
    
    if (!config || !config.autoSync || config.mode === 'local-only') {
      return;
    }

    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(() => {
      if (this.syncStatus.isOnline && !this.syncStatus.syncing) {
        this.triggerSync(userId);
      }
    }, config.syncInterval);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  async triggerSync(userId?: string): Promise<void> {
    if (!this.cloudApi) {
      return;
    }

    if (!userId) {
      // If no userId provided, we can't sync
      return;
    }

    // Debounce rapid sync attempts (wait 500ms)
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    
    this.syncDebounceTimer = setTimeout(async () => {
      // Check if already syncing
      if (this.syncStatus.syncing) {
        return;
      }

      const config = await this.localDb.getSyncConfig(userId);
      if (!config || config.mode === 'local-only') {
        return;
      }

      this.syncStatus.syncing = true;
      this.syncStatus.error = null;
      this.notifyStatusChange();

      try {
        // First push local changes to cloud
        await this.pushLocalChanges(userId);
        
        // Then pull cloud changes to local
        await this.pullCloudChanges(userId);
        
        this.syncStatus.lastSync = new Date();
        await this.localDb.updateLastSync(userId);
        await this.updatePendingChangesCount();
        
      } catch (error) {
        this.syncStatus.error = error instanceof Error ? error.message : 'Sync failed';
        console.error('Sync failed:', error);
      } finally {
        this.syncStatus.syncing = false;
        this.notifyStatusChange();
      }
    }, 500); // 500ms debounce
  }

  private async pushLocalChanges(userId: string): Promise<void> {
    if (!this.cloudApi) return;

    const unsyncedEvents = await this.localDb.getUnsyncedEvents(userId);
    
    for (const event of unsyncedEvents) {
      try {
        await this.pushEventToCloud(event);
        await this.localDb.markEventAsSynced(event.id);
      } catch (error) {
        console.error(`Failed to sync event ${event.id}:`, error);
        // Continue with other events even if one fails
      }
    }
  }

  private async pushEventToCloud(event: SyncEvent): Promise<void> {
    if (!this.cloudApi) return;

    const data = JSON.parse(event.data || '{}');

    switch (event.entityType) {
      case 'chat':
        switch (event.operation) {
          case 'create':
            await this.cloudApi.createChat(data);
            break;
          case 'update':
            await this.cloudApi.updateChat(event.entityId, data);
            break;
          case 'delete':
            await this.cloudApi.deleteChat(event.entityId);
            break;
        }
        break;

      case 'message':
        switch (event.operation) {
          case 'create':
            await this.cloudApi.createMessage(data);
            break;
          case 'delete':
            await this.cloudApi.deleteMessage(event.entityId);
            break;
          // Messages typically aren't updated, only created or deleted
        }
        break;

      case 'user':
        // User changes might be handled differently depending on your auth system
        break;
    }
  }

  private async pullCloudChanges(userId: string): Promise<void> {
    if (!this.cloudApi) return;

    // Get the last sync timestamp for this user
    const device = await this.localDb.queryPublic(
      'SELECT last_sync_at FROM device WHERE user_id = ? AND fingerprint = ?',
      [userId, this.localDb.getDeviceId()]
    );

    const lastSyncTimestamp = device.length > 0 ? device[0].last_sync_at : 0;

    try {
      // Pull chats
      const cloudChats = await this.cloudApi.getChats(userId, lastSyncTimestamp);
      for (const chat of cloudChats) {
        await this.applyCloudChange('chat', chat);
      }

      // Pull messages for each chat
      const localChats = await this.localDb.getUserChats(userId);
      for (const chat of localChats) {
        const cloudMessages = await this.cloudApi.getMessages(chat.id, lastSyncTimestamp);
        for (const message of cloudMessages) {
          await this.applyCloudChange('message', message);
        }
      }

    } catch (error) {
      console.error('Failed to pull cloud changes:', error);
      throw error;
    }
  }

  private async applyCloudChange(entityType: 'chat' | 'message', data: any): Promise<void> {
    switch (entityType) {
      case 'chat':
        const existingChat = await this.localDb.getChat(data.id);
        if (existingChat) {
          // Check if cloud version is newer
          if (data.updatedAt > existingChat.updatedAt) {
            await this.localDb.updateChat(data.id, {
              title: data.title,
              updatedAt: data.updatedAt,
              isDeleted: data.isDeleted
            });
          }
        } else {
          // Create new chat
          await this.localDb.createChat(data);
        }
        break;

      case 'message':
        const existingMessage = await this.localDb.getMessage(data.id);
        if (!existingMessage) {
          // Create new message
          await this.localDb.createMessage(data);
        }
        // Messages typically aren't updated, only created
        break;
    }
  }

  async forcePullFromCloud(userId: string): Promise<void> {
    if (!this.cloudApi || !this.syncStatus.isOnline) {
      throw new Error('Cannot pull from cloud: offline or no cloud API');
    }

    this.syncStatus.syncing = true;
    this.notifyStatusChange();

    try {
      await this.pullCloudChanges(userId);
      this.syncStatus.lastSync = new Date();
      await this.localDb.updateLastSync(userId);
    } finally {
      this.syncStatus.syncing = false;
      this.notifyStatusChange();
    }
  }

  async forcePushToCloud(userId: string): Promise<void> {
    if (!this.cloudApi || !this.syncStatus.isOnline) {
      throw new Error('Cannot push to cloud: offline or no cloud API');
    }

    this.syncStatus.syncing = true;
    this.notifyStatusChange();

    try {
      await this.pushLocalChanges(userId);
      await this.updatePendingChangesCount();
    } finally {
      this.syncStatus.syncing = false;
      this.notifyStatusChange();
    }
  }

  async setSyncMode(userId: string, mode: SyncMode): Promise<void> {
    await this.localDb.updateSyncConfig(userId, { mode });
    
    if (mode === 'local-only') {
      this.stopAutoSync();
    } else if (mode === 'hybrid') {
      await this.startAutoSync(userId);
    }
  }

  async resolveConflict(
    entityType: 'chat' | 'message',
    entityId: string,
    resolution: 'local' | 'cloud' | 'merge'
  ): Promise<void> {
    // Basic conflict resolution implementation
    // In a production app, you'd want more sophisticated conflict resolution
    
    switch (resolution) {
      case 'local':
        // Keep local version, push to cloud
        const localData = entityType === 'chat' 
          ? await this.localDb.getChat(entityId)
          : await this.localDb.getMessage(entityId);
        
        if (localData) {
          await this.createSyncEventForEntity(entityType, entityId, 'update', localData);
        }
        break;

      case 'cloud':
        // Pull cloud version, overwrite local
        if (this.cloudApi) {
          // This would require additional API methods to get specific entities
          // Implementation depends on your cloud API structure
        }
        break;

      case 'merge':
        // Implement merge logic based on your business rules
        // This is highly application-specific
        break;
    }
  }

  private async createSyncEventForEntity(
    entityType: 'chat' | 'message',
    entityId: string,
    operation: 'create' | 'update' | 'delete',
    data: any
  ): Promise<void> {
    await this.localDb.runPublic(
      `INSERT INTO sync_event (id, entity_type, entity_id, operation, data, timestamp, user_id, device_id, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.generateId(),
        entityType,
        entityId,
        operation,
        JSON.stringify(data),
        Math.floor(Date.now() / 1000),
        data.userId || data.user_id || 'unknown',
        this.localDb.getDeviceId(),
        0
      ]
    );
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  async exportLocalData(): Promise<{
    chats: Chat[];
    messages: Message[];
    syncEvents: SyncEvent[];
  }> {
    const chats = await this.localDb.queryPublic('SELECT * FROM chat WHERE is_deleted = 0');
    const messages = await this.localDb.queryPublic('SELECT * FROM message WHERE is_deleted = 0');
    const syncEvents = await this.localDb.queryPublic('SELECT * FROM sync_event');

    return { chats, messages, syncEvents };
  }

  async importData(data: {
    chats?: Chat[];
    messages?: Message[];
  }, userId: string): Promise<void> {
    this.syncStatus.syncing = true;
    this.notifyStatusChange();

    try {
      if (data.chats) {
        for (const chat of data.chats) {
          await this.localDb.createChat(chat);
        }
      }

      if (data.messages) {
        for (const message of data.messages) {
          await this.localDb.createMessage(message);
        }
      }

      await this.updatePendingChangesCount();
    } finally {
      this.syncStatus.syncing = false;
      this.notifyStatusChange();
    }
  }

  cleanup(): void {
    this.stopAutoSync();
    this.statusCallbacks.clear();
  }
}

// Singleton instance
let syncManager: SyncManager | null = null;

export function getSyncManager(cloudApi?: CloudAPI): SyncManager {
  if (!syncManager) {
    syncManager = new SyncManager(cloudApi);
  }
  return syncManager;
}