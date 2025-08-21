import { nanoid } from 'nanoid';
import type { 
  Chat, 
  Message, 
  User, 
  SyncEvent, 
  Device, 
  SyncConfig,
  InsertChat,
  InsertMessage,
  InsertUser,
  InsertSyncEvent,
  InsertDevice,
  InsertSyncConfig
} from './schema/shared';

interface DatabaseOperation {
  type: 'query' | 'run';
  sql: string;
  params: any[];
}

interface WorkerMessage {
  type: string;
  id: string;
  payload?: any;
}

interface WorkerResponse {
  type: string;
  id: string;
  success: boolean;
  result?: any;
  error?: string;
}

export class LocalDatabase {
  private worker: Worker | null = null;
  private pendingOperations = new Map<string, { resolve: Function; reject: Function }>();
  private initialized = false;
  private deviceId: string;

  constructor() {
    this.deviceId = this.generateDeviceFingerprint();
    this.initializeWorker();
  }

  private generateDeviceFingerprint(): string {
    // Create a device fingerprint based on available browser features
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx!.textBaseline = 'top';
    ctx!.font = '14px Arial';
    ctx!.fillText('Device fingerprint', 2, 2);
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|');
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  private initializeWorker(): void {
    // @ts-ignore - Turbopack static analysis limitation
    // eslint-disable-next-line
    this.worker = new Worker('/db-worker.js');
    
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { type, id, success, result, error } = event.data;
      
      // Handle initialization response
      if (type === 'INITIALIZE_RESULT') {
        this.initialized = success;
        if (!success) {
          console.error('Failed to initialize database:', error);
        }
        const pending = this.pendingOperations.get(id);
        if (pending) {
          this.pendingOperations.delete(id);
          if (success) {
            pending.resolve(result);
          } else {
            pending.reject(new Error(error || 'Database initialization failed'));
          }
        }
        return;
      }

      const pending = this.pendingOperations.get(id);
      if (pending) {
        this.pendingOperations.delete(id);
        
        if (success) {
          pending.resolve(result);
        } else {
          pending.reject(new Error(error || 'Database operation failed'));
        }
      }
    };

    this.worker.onerror = (error) => {
      console.error('Database worker error:', error);
    };

    // Initialize the database
    this.sendMessage({ type: 'INITIALIZE', id: nanoid() }).then(() => {
      console.log('Database initialized successfully');
    }).catch(err => {
      console.error('Database initialization failed:', err);
      this.initialized = false;
    });
  }

  private async sendMessage(message: WorkerMessage): Promise<any> {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingOperations.delete(message.id);
        reject(new Error('Database operation timeout'));
      }, 10000); // 10 second timeout

      this.pendingOperations.set(message.id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.worker!.postMessage(message);
    });
  }

  private async query(sql: string, params: any[] = []): Promise<any[]> {
    return this.sendMessage({
      type: 'QUERY',
      id: nanoid(),
      payload: { sql, params }
    });
  }

  private async run(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    return this.sendMessage({
      type: 'RUN',
      id: nanoid(),
      payload: { sql, params }
    });
  }

  private async transaction(operations: DatabaseOperation[]): Promise<void> {
    return this.sendMessage({
      type: 'TRANSACTION',
      id: nanoid(),
      payload: { operations }
    });
  }

  // Wait for initialization
  async waitForInitialization(): Promise<void> {
    const maxAttempts = 100; // 10 seconds total (100ms * 100)
    let attempts = 0;
    
    while (!this.initialized && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!this.initialized) {
      throw new Error('Database initialization timeout after 10 seconds');
    }
  }

  // User operations
  async createUser(user: InsertUser): Promise<User> {
    await this.waitForInitialization();
    
    const now = new Date();
    const userData = {
      id: user.id || nanoid(),
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified ? 1 : 0,
      image: user.image || null,
      createdAt: user.createdAt || Math.floor(now.getTime() / 1000),
      updatedAt: user.updatedAt || Math.floor(now.getTime() / 1000)
    };

    await this.run(
      `INSERT INTO user (id, name, email, email_verified, image, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userData.id, userData.name, userData.email, userData.emailVerified, userData.image, userData.createdAt, userData.updatedAt]
    );

    await this.createSyncEvent('user', userData.id, 'create', userData);
    return userData as User;
  }

  async getUser(id: string): Promise<User | null> {
    await this.waitForInitialization();
    const result = await this.query('SELECT * FROM user WHERE id = ?', [id]);
    return result.length > 0 ? result[0] : null;
  }

  // Chat operations
  async createChat(chat: InsertChat): Promise<Chat> {
    await this.waitForInitialization();
    
    const now = new Date();
    const chatData = {
      id: chat.id || nanoid(),
      title: chat.title,
      userId: chat.userId,
      createdAt: chat.createdAt || Math.floor(now.getTime() / 1000),
      updatedAt: chat.updatedAt || Math.floor(now.getTime() / 1000),
      isDeleted: chat.isDeleted ? 1 : 0
    };

    await this.run(
      `INSERT INTO chat (id, title, user_id, created_at, updated_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [chatData.id, chatData.title, chatData.userId, chatData.createdAt, chatData.updatedAt, chatData.isDeleted]
    );

    await this.createSyncEvent('chat', chatData.id, 'create', chatData);
    return chatData as Chat;
  }

  async getUserChats(userId: string): Promise<Chat[]> {
    await this.waitForInitialization();
    return this.query(
      'SELECT * FROM chat WHERE user_id = ? AND is_deleted = 0 ORDER BY updated_at DESC',
      [userId]
    );
  }

  async getChat(id: string): Promise<Chat | null> {
    await this.waitForInitialization();
    const result = await this.query('SELECT * FROM chat WHERE id = ? AND is_deleted = 0', [id]);
    return result.length > 0 ? result[0] : null;
  }

  async updateChat(id: string, updates: Partial<Chat>): Promise<void> {
    await this.waitForInitialization();
    
    const fields = Object.keys(updates).filter(key => key !== 'id');
    const values = fields.map(key => updates[key as keyof Chat]);
    const setClause = fields.map(key => `${key} = ?`).join(', ');

    if (fields.length === 0) return;

    await this.run(
      `UPDATE chat SET ${setClause}, updated_at = ? WHERE id = ?`,
      [...values, Math.floor(Date.now() / 1000), id]
    );

    await this.createSyncEvent('chat', id, 'update', updates);
  }

  async deleteChat(id: string): Promise<void> {
    await this.waitForInitialization();
    
    await this.run(
      'UPDATE chat SET is_deleted = 1, updated_at = ? WHERE id = ?',
      [Math.floor(Date.now() / 1000), id]
    );

    await this.createSyncEvent('chat', id, 'delete', { id });
  }

  // Message operations
  async createMessage(message: InsertMessage): Promise<Message> {
    await this.waitForInitialization();
    
    const now = new Date();
    const messageData = {
      id: message.id || nanoid(),
      chatId: message.chatId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt || Math.floor(now.getTime() / 1000),
      isDeleted: message.isDeleted ? 1 : 0
    };

    await this.run(
      `INSERT INTO message (id, chat_id, role, content, created_at, is_deleted)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [messageData.id, messageData.chatId, messageData.role, messageData.content, messageData.createdAt, messageData.isDeleted]
    );

    await this.createSyncEvent('message', messageData.id, 'create', messageData);
    return messageData as Message;
  }

  async getChatMessages(chatId: string): Promise<Message[]> {
    await this.waitForInitialization();
    return this.query(
      'SELECT * FROM message WHERE chat_id = ? AND is_deleted = 0 ORDER BY created_at ASC',
      [chatId]
    );
  }

  async getMessage(id: string): Promise<Message | null> {
    await this.waitForInitialization();
    const result = await this.query('SELECT * FROM message WHERE id = ? AND is_deleted = 0', [id]);
    return result.length > 0 ? result[0] : null;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.waitForInitialization();
    
    await this.run(
      'UPDATE message SET is_deleted = 1 WHERE id = ?',
      [id]
    );

    await this.createSyncEvent('message', id, 'delete', { id });
  }

  // Sync event operations
  private async createSyncEvent(entityType: string, entityId: string, operation: string, data: any): Promise<void> {
    const event: InsertSyncEvent = {
      id: nanoid(),
      entityType: entityType as any,
      entityId,
      operation: operation as any,
      data: JSON.stringify(data),
      timestamp: Math.floor(Date.now() / 1000),
      userId: data.userId || data.user_id || 'unknown',
      deviceId: this.deviceId,
      synced: false
    };

    await this.run(
      `INSERT INTO sync_event (id, entity_type, entity_id, operation, data, timestamp, user_id, device_id, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.id, event.entityType, event.entityId, event.operation, event.data, event.timestamp, event.userId, event.deviceId, event.synced ? 1 : 0]
    );
    
    // Emit custom event for real-time sync
    if (event.userId && event.userId !== 'unknown' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('local-db-change', { 
        detail: { userId: event.userId, entityType, operation } 
      }));
    }
  }

  async getUnsyncedEvents(userId?: string): Promise<SyncEvent[]> {
    await this.waitForInitialization();
    
    if (userId) {
      return this.query(
        'SELECT * FROM sync_event WHERE synced = 0 AND user_id = ? ORDER BY timestamp ASC',
        [userId]
      );
    }
    
    return this.query('SELECT * FROM sync_event WHERE synced = 0 ORDER BY timestamp ASC');
  }

  async markEventAsSynced(eventId: string): Promise<void> {
    await this.waitForInitialization();
    await this.run('UPDATE sync_event SET synced = 1 WHERE id = ?', [eventId]);
  }

  // Device and sync configuration
  async registerDevice(userId: string): Promise<Device> {
    await this.waitForInitialization();
    
    const device: InsertDevice = {
      id: nanoid(),
      userId,
      fingerprint: this.deviceId,
      lastSyncAt: null,
      createdAt: Math.floor(Date.now() / 1000)
    };

    try {
      await this.run(
        `INSERT INTO device (id, user_id, fingerprint, last_sync_at, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [device.id, device.userId, device.fingerprint, device.lastSyncAt, device.createdAt]
      );
    } catch (error) {
      // Device might already exist, update instead
      await this.run(
        'UPDATE device SET user_id = ?, created_at = ? WHERE fingerprint = ?',
        [userId, device.createdAt, this.deviceId]
      );
    }

    return device as Device;
  }

  async updateLastSync(userId: string): Promise<void> {
    await this.waitForInitialization();
    await this.run(
      'UPDATE device SET last_sync_at = ? WHERE user_id = ? AND fingerprint = ?',
      [Math.floor(Date.now() / 1000), userId, this.deviceId]
    );
  }

  async getSyncConfig(userId: string): Promise<SyncConfig | null> {
    await this.waitForInitialization();
    const result = await this.query('SELECT * FROM sync_config WHERE user_id = ?', [userId]);
    return result.length > 0 ? result[0] : null;
  }

  async updateSyncConfig(userId: string, config: Partial<SyncConfig>): Promise<void> {
    await this.waitForInitialization();
    
    const existing = await this.getSyncConfig(userId);
    
    if (existing) {
      const fields = Object.keys(config).filter(key => key !== 'id' && key !== 'userId');
      const values = fields.map(key => config[key as keyof SyncConfig]);
      const setClause = fields.map(key => `${key} = ?`).join(', ');

      if (fields.length > 0) {
        await this.run(
          `UPDATE sync_config SET ${setClause}, updated_at = ? WHERE user_id = ?`,
          [...values, Math.floor(Date.now() / 1000), userId]
        );
      }
    } else {
      const configData: InsertSyncConfig = {
        id: nanoid(),
        userId,
        mode: config.mode || 'hybrid',
        autoSync: config.autoSync !== undefined ? config.autoSync : true,
        syncInterval: config.syncInterval || 30000,
        updatedAt: Math.floor(Date.now() / 1000)
      };

      await this.run(
        `INSERT INTO sync_config (id, user_id, mode, auto_sync, sync_interval, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [configData.id, configData.userId, configData.mode, configData.autoSync ? 1 : 0, configData.syncInterval, configData.updatedAt]
      );
    }
  }

  // Cleanup and utility methods
  cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  // Expose query method for sync manager (public version of private query)
  async queryPublic(sql: string, params: any[] = []): Promise<any[]> {
    await this.waitForInitialization();
    return this.query(sql, params);
  }

  // Expose run method for sync manager (public version of private run)
  async runPublic(sql: string, params: any[] = []): Promise<{ changes: number; lastInsertRowid: number }> {
    await this.waitForInitialization();
    return this.run(sql, params);
  }
}

// Singleton instance
let localDb: LocalDatabase | null = null;

export function getLocalDatabase(): LocalDatabase {
  if (!localDb) {
    localDb = new LocalDatabase();
  }
  return localDb;
}