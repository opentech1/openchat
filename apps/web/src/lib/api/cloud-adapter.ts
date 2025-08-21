import { client } from '@/utils/orpc';
import type { Chat, Message, SyncEvent } from '@/lib/db/schema/shared';

export interface CloudAPI {
  getChats(userId: string, lastSyncTimestamp?: number): Promise<Chat[]>;
  getMessages(chatId: string, lastSyncTimestamp?: number): Promise<Message[]>;
  createChat(chat: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>): Promise<Chat>;
  createMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message>;
  updateChat(id: string, updates: Partial<Chat>): Promise<Chat>;
  deleteChat(id: string): Promise<void>;
  deleteMessage(id: string): Promise<void>;
  getSyncEvents(userId: string, since: number, deviceId: string): Promise<SyncEvent[]>;
  registerDevice(fingerprint: string): Promise<any>;
  updateLastSync(deviceId: string): Promise<void>;
}

export class OpenChatCloudAPI implements CloudAPI {
  async getChats(userId: string, lastSyncTimestamp?: number): Promise<Chat[]> {
    try {
      const result = await client.chat.getChats({
        lastSyncTimestamp,
        deviceId: this.getDeviceId(),
      });
      
      return result.map(this.transformChatFromServer);
    } catch (error) {
      console.error('Failed to fetch chats from cloud:', error);
      throw new Error('Failed to sync chats from server');
    }
  }

  async getMessages(chatId: string, lastSyncTimestamp?: number): Promise<Message[]> {
    try {
      const result = await client.chat.getMessages({
        chatId,
        lastSyncTimestamp,
      });
      
      return result.map(this.transformMessageFromServer);
    } catch (error) {
      console.error('Failed to fetch messages from cloud:', error);
      throw new Error('Failed to sync messages from server');
    }
  }

  async createChat(chat: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>): Promise<Chat> {
    try {
      const result = await client.chat.createChat({
        title: chat.title,
      });
      
      return this.transformChatFromServer(result);
    } catch (error) {
      console.error('Failed to create chat on server:', error);
      throw new Error('Failed to create chat on server');
    }
  }

  async createMessage(message: Omit<Message, 'id' | 'createdAt'>): Promise<Message> {
    try {
      const result = await client.chat.createMessage({
        chatId: message.chatId,
        role: message.role,
        content: message.content,
      });
      
      return this.transformMessageFromServer(result);
    } catch (error) {
      console.error('Failed to create message on server:', error);
      throw new Error('Failed to create message on server');
    }
  }

  async updateChat(id: string, updates: Partial<Chat>): Promise<Chat> {
    try {
      await client.chat.updateChat({
        id,
        title: updates.title,
        isDeleted: updates.isDeleted,
      });
      
      // Return the updated chat (in a real implementation, the server might return the updated object)
      return { id, ...updates } as Chat;
    } catch (error) {
      console.error('Failed to update chat on server:', error);
      throw new Error('Failed to update chat on server');
    }
  }

  async deleteChat(id: string): Promise<void> {
    try {
      await client.chat.deleteChat({ id });
    } catch (error) {
      console.error('Failed to delete chat on server:', error);
      throw new Error('Failed to delete chat on server');
    }
  }

  async deleteMessage(id: string): Promise<void> {
    try {
      await client.chat.deleteMessage({ id });
    } catch (error) {
      console.error('Failed to delete message on server:', error);
      throw new Error('Failed to delete message on server');
    }
  }

  async getSyncEvents(userId: string, since: number, deviceId: string): Promise<SyncEvent[]> {
    try {
      const result = await client.chat.getSyncEvents({
        lastSyncTimestamp: since,
        deviceId,
      });
      
      return result.map(this.transformSyncEventFromServer);
    } catch (error) {
      console.error('Failed to fetch sync events from cloud:', error);
      throw new Error('Failed to fetch sync events from server');
    }
  }

  async registerDevice(fingerprint: string): Promise<any> {
    try {
      const result = await client.chat.registerDevice({
        fingerprint,
      });
      
      return result;
    } catch (error) {
      console.error('Failed to register device on server:', error);
      throw new Error('Failed to register device on server');
    }
  }

  async updateLastSync(deviceId: string): Promise<void> {
    try {
      await client.chat.updateLastSync({
        deviceId,
      });
    } catch (error) {
      console.error('Failed to update last sync on server:', error);
      throw new Error('Failed to update last sync on server');
    }
  }

  // Transform server data to match local schema
  private transformChatFromServer(serverChat: any): Chat {
    return {
      id: serverChat.id,
      title: serverChat.title,
      userId: serverChat.userId,
      createdAt: this.timestampToUnix(serverChat.createdAt),
      updatedAt: this.timestampToUnix(serverChat.updatedAt),
      isDeleted: Boolean(serverChat.isDeleted),
    };
  }

  private transformMessageFromServer(serverMessage: any): Message {
    return {
      id: serverMessage.id,
      chatId: serverMessage.chatId,
      role: serverMessage.role,
      content: serverMessage.content,
      createdAt: this.timestampToUnix(serverMessage.createdAt),
      isDeleted: Boolean(serverMessage.isDeleted),
    };
  }

  private transformSyncEventFromServer(serverEvent: any): SyncEvent {
    return {
      id: serverEvent.id,
      entityType: serverEvent.entityType,
      entityId: serverEvent.entityId,
      operation: serverEvent.operation,
      data: serverEvent.data,
      timestamp: this.timestampToUnix(serverEvent.timestamp),
      userId: serverEvent.userId,
      deviceId: serverEvent.deviceId,
      synced: Boolean(serverEvent.synced),
    };
  }

  private timestampToUnix(timestamp: Date | string | number): number {
    if (timestamp instanceof Date) {
      return Math.floor(timestamp.getTime() / 1000);
    }
    if (typeof timestamp === 'string') {
      return Math.floor(new Date(timestamp).getTime() / 1000);
    }
    if (typeof timestamp === 'number') {
      // Assume it's already a unix timestamp if it's reasonable
      return timestamp > 1000000000 && timestamp < 10000000000 ? timestamp : Math.floor(timestamp / 1000);
    }
    return Math.floor(Date.now() / 1000);
  }

  private getDeviceId(): string {
    // This should match the device fingerprint from your local database
    // For now, we'll use a simple implementation
    if (typeof window !== 'undefined') {
      let deviceId = localStorage.getItem('openchat-device-id');
      if (!deviceId) {
        deviceId = this.generateDeviceFingerprint();
        localStorage.setItem('openchat-device-id', deviceId);
      }
      return deviceId;
    }
    return 'server-generated-id';
  }

  private generateDeviceFingerprint(): string {
    if (typeof window === 'undefined') return 'server';

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
}

// Create singleton instance
let cloudApi: OpenChatCloudAPI | null = null;

export function getCloudAPI(): OpenChatCloudAPI {
  if (!cloudApi) {
    cloudApi = new OpenChatCloudAPI();
  }
  return cloudApi;
}