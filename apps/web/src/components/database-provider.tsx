"use client";

import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSyncManager } from '@/lib/db/sync-manager';
import { getLocalDatabase } from '@/lib/db/local-db';
import { getCloudAPI } from '@/lib/api/cloud-adapter';

interface DatabaseContextType {
  isInitialized: boolean;
  initializationError: string | null;
  syncManager: ReturnType<typeof getSyncManager> | null;
  localDatabase: ReturnType<typeof getLocalDatabase> | null;
}

const DatabaseContext = createContext<DatabaseContextType>({
  isInitialized: false,
  initializationError: null,
  syncManager: null,
  localDatabase: null,
});

export function useDatabaseContext() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabaseContext must be used within a DatabaseProvider');
  }
  return context;
}

interface DatabaseProviderProps {
  children: ReactNode;
  userId?: string;
}

export function DatabaseProvider({ children, userId }: DatabaseProviderProps) {
  const { data: initializationData, error } = useQuery({
    queryKey: ['database-provider-initialization', userId],
    queryFn: async () => {
      // Initialize local database
      const db = getLocalDatabase();
      await db.waitForInitialization();

      // Initialize sync manager with cloud API
      const cloudApi = getCloudAPI();
      const sync = getSyncManager(cloudApi);

      // If user is logged in, set up real-time sync
      if (userId) {
        await db.registerDevice(userId);
        
        // Initialize sync configuration for real-time sync
        await db.updateSyncConfig(userId, {
          mode: 'hybrid',
          autoSync: true,
          syncInterval: 5000, // 5 seconds for near real-time sync
        });

        // Start auto-sync
        await sync.startAutoSync(userId);
      }

      return {
        isInitialized: true,
        syncManager: sync,
        localDatabase: db,
      };
    },
    staleTime: Infinity, // Only initialize once
    gcTime: Infinity, // Keep in cache indefinitely
  });

  const contextValue: DatabaseContextType = {
    isInitialized: initializationData?.isInitialized ?? false,
    initializationError: error?.message ?? null,
    syncManager: initializationData?.syncManager ?? null,
    localDatabase: initializationData?.localDatabase ?? null,
  };

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}