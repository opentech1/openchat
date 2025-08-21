import { useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getLocalDatabase } from '@/lib/db/local-db';
import { getSyncManager } from '@/lib/db/sync-manager';
import type { Chat, Message, User, SyncConfig } from '@/lib/db/schema/shared';

interface UseDatabaseOptions {
  userId?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

interface DatabaseState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  syncStatus: {
    isOnline: boolean;
    lastSync: Date | null;
    pendingChanges: number;
    syncing: boolean;
    error: string | null;
  };
}

export function useLocalDatabase(options: UseDatabaseOptions = {}) {
  const { userId, autoSync = false, syncInterval = 5 * 60 * 1000 } = options;
  
  const localDb = useRef(getLocalDatabase());
  const syncManager = useRef(getSyncManager());
  const queryClient = useQueryClient();

  const { data: initializationState, isLoading, error } = useQuery({
    queryKey: ['database-initialization', userId, autoSync, syncInterval],
    queryFn: async () => {
      await localDb.current.waitForInitialization();
      
      if (userId) {
        await localDb.current.registerDevice(userId);
        
        // Set up sync configuration
        const existingConfig = await localDb.current.getSyncConfig(userId);
        if (!existingConfig) {
          await localDb.current.updateSyncConfig(userId, {
            mode: 'hybrid',
            autoSync,
            syncInterval
          });
        }

        // Start auto sync if enabled
        if (autoSync) {
          await syncManager.current.startAutoSync(userId);
        }
      }

      return {
        isInitialized: true,
        syncStatus: syncManager.current.getStatus()
      };
    },
    staleTime: Infinity, // Only initialize once
    gcTime: Infinity, // Keep in cache indefinitely
  });

  const { data: syncStatus } = useQuery({
    queryKey: ['sync-status'],
    queryFn: () => syncManager.current.getStatus(),
    refetchInterval: 30000, // Poll sync status every 30 seconds
    enabled: initializationState?.isInitialized ?? false,
  });

  const triggerSyncMutation = useMutation({
    mutationFn: async () => {
      if (userId) {
        await syncManager.current.triggerSync(userId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  const setSyncModeMutation = useMutation({
    mutationFn: async (mode: 'local-only' | 'cloud-only' | 'hybrid') => {
      if (userId) {
        await syncManager.current.setSyncMode(userId, mode);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  return {
    isInitialized: initializationState?.isInitialized ?? false,
    isLoading,
    error: error?.message ?? null,
    syncStatus: syncStatus ?? {
      isOnline: navigator.onLine,
      lastSync: null,
      pendingChanges: 0,
      syncing: false,
      error: null
    },
    database: localDb.current,
    syncManager: syncManager.current,
    triggerSync: triggerSyncMutation.mutate,
    setSyncMode: setSyncModeMutation.mutate
  };
}

export function useChats(userId?: string) {
  const { database, isInitialized } = useLocalDatabase({ userId });
  const queryClient = useQueryClient();

  const { data: chats = [], isLoading, error } = useQuery({
    queryKey: ['chats', userId],
    queryFn: async () => {
      if (!userId) return [];
      return database.getUserChats(userId);
    },
    enabled: isInitialized && !!userId,
  });

  const createChatMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!userId) throw new Error('User ID required');
      return database.createChat({ title, userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', userId] });
    },
  });

  const updateChatMutation = useMutation({
    mutationFn: async ({ chatId, updates }: { chatId: string; updates: Partial<Chat> }) => {
      await database.updateChat(chatId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', userId] });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      await database.deleteChat(chatId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats', userId] });
    },
  });

  return {
    chats,
    isLoading,
    error: error?.message ?? null,
    createChat: createChatMutation.mutate,
    updateChat: (chatId: string, updates: Partial<Chat>) => 
      updateChatMutation.mutate({ chatId, updates }),
    deleteChat: deleteChatMutation.mutate,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['chats', userId] })
  };
}

export function useMessages(chatId?: string) {
  const { database, isInitialized } = useLocalDatabase();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading, error } = useQuery({
    queryKey: ['messages', chatId],
    queryFn: async () => {
      if (!chatId) return [];
      return database.getChatMessages(chatId);
    },
    enabled: isInitialized && !!chatId,
  });

  const addMessageMutation = useMutation({
    mutationFn: async ({ content, role }: { content: string; role: 'user' | 'assistant' | 'system' }) => {
      if (!chatId) throw new Error('Chat ID required');
      return database.createMessage({ chatId, role, content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      await database.deleteMessage(messageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });

  return {
    messages,
    isLoading,
    error: error?.message ?? null,
    addMessage: (content: string, role: 'user' | 'assistant' | 'system' = 'user') => 
      addMessageMutation.mutate({ content, role }),
    deleteMessage: deleteMessageMutation.mutate,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['messages', chatId] })
  };
}

export function useSyncConfig(userId?: string) {
  const { database, isInitialized } = useLocalDatabase({ userId });
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['sync-config', userId],
    queryFn: async () => {
      if (!userId) return null;
      return database.getSyncConfig(userId);
    },
    enabled: isInitialized && !!userId,
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Partial<SyncConfig>) => {
      if (!userId) return;
      await database.updateSyncConfig(userId, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-config', userId] });
    },
  });

  return {
    config,
    isLoading,
    updateConfig: updateConfigMutation.mutate
  };
}