import type { Chat, Message } from './schema/shared';

export interface ConflictData<T> {
  localVersion: T;
  cloudVersion: T;
  lastSyncTimestamp: number;
}

export interface ConflictResolution<T> {
  resolved: T;
  strategy: 'local' | 'cloud' | 'merge' | 'manual';
  requiresManualReview?: boolean;
}

export type ConflictResolver<T> = (conflict: ConflictData<T>) => ConflictResolution<T>;

class ConflictResolverManager {
  private chatResolver: ConflictResolver<Chat>;
  private messageResolver: ConflictResolver<Message>;

  constructor() {
    this.chatResolver = this.createChatResolver();
    this.messageResolver = this.createMessageResolver();
  }

  private createChatResolver(): ConflictResolver<Chat> {
    return (conflict: ConflictData<Chat>): ConflictResolution<Chat> => {
      const { localVersion, cloudVersion } = conflict;

      // If one version is deleted and the other isn't, prefer the non-deleted version
      if (localVersion.isDeleted && !cloudVersion.isDeleted) {
        return {
          resolved: cloudVersion,
          strategy: 'cloud'
        };
      }
      
      if (!localVersion.isDeleted && cloudVersion.isDeleted) {
        return {
          resolved: localVersion,
          strategy: 'local'
        };
      }

      // If both are deleted, use the most recently updated one
      if (localVersion.isDeleted && cloudVersion.isDeleted) {
        return {
          resolved: localVersion.updatedAt > cloudVersion.updatedAt ? localVersion : cloudVersion,
          strategy: localVersion.updatedAt > cloudVersion.updatedAt ? 'local' : 'cloud'
        };
      }

      // For title conflicts, prefer the most recent change
      if (localVersion.title !== cloudVersion.title) {
        const mostRecent = localVersion.updatedAt > cloudVersion.updatedAt ? localVersion : cloudVersion;
        return {
          resolved: mostRecent,
          strategy: localVersion.updatedAt > cloudVersion.updatedAt ? 'local' : 'cloud'
        };
      }

      // If no conflicts, use the most recently updated version
      return {
        resolved: localVersion.updatedAt > cloudVersion.updatedAt ? localVersion : cloudVersion,
        strategy: localVersion.updatedAt > cloudVersion.updatedAt ? 'local' : 'cloud'
      };
    };
  }

  private createMessageResolver(): ConflictResolver<Message> {
    return (conflict: ConflictData<Message>): ConflictResolution<Message> => {
      const { localVersion, cloudVersion } = conflict;

      // Messages are generally immutable, so prefer the version that exists
      if (localVersion.isDeleted && !cloudVersion.isDeleted) {
        return {
          resolved: cloudVersion,
          strategy: 'cloud'
        };
      }
      
      if (!localVersion.isDeleted && cloudVersion.isDeleted) {
        return {
          resolved: localVersion,
          strategy: 'local'
        };
      }

      // If both are deleted, keep deleted state
      if (localVersion.isDeleted && cloudVersion.isDeleted) {
        return {
          resolved: localVersion,
          strategy: 'local'
        };
      }

      // For content conflicts (rare), prefer the cloud version as the source of truth
      if (localVersion.content !== cloudVersion.content) {
        return {
          resolved: cloudVersion,
          strategy: 'cloud',
          requiresManualReview: true
        };
      }

      // Use the original version (messages shouldn't change after creation)
      return {
        resolved: localVersion.createdAt <= cloudVersion.createdAt ? localVersion : cloudVersion,
        strategy: localVersion.createdAt <= cloudVersion.createdAt ? 'local' : 'cloud'
      };
    };
  }

  resolveChat(conflict: ConflictData<Chat>): ConflictResolution<Chat> {
    return this.chatResolver(conflict);
  }

  resolveMessage(conflict: ConflictData<Message>): ConflictResolution<Message> {
    return this.messageResolver(conflict);
  }

  // Advanced merge strategies for complex conflicts
  mergeChatData(local: Chat, cloud: Chat): Chat {
    // Create a merged version that combines the best of both
    return {
      ...local,
      // Use the most recent title
      title: local.updatedAt > cloud.updatedAt ? local.title : cloud.title,
      // Use the most recent update timestamp
      updatedAt: Math.max(local.updatedAt, cloud.updatedAt),
      // Use deletion status from the most recent update
      isDeleted: local.updatedAt > cloud.updatedAt ? local.isDeleted : cloud.isDeleted
    };
  }

  // Detect if entities are in conflict
  isInConflict<T extends { updatedAt: number }>(
    local: T, 
    cloud: T, 
    lastSyncTimestamp: number
  ): boolean {
    // Both have been modified since last sync
    return local.updatedAt > lastSyncTimestamp && cloud.updatedAt > lastSyncTimestamp;
  }

  // Get conflict priority (higher number = higher priority)
  getConflictPriority(entityType: 'chat' | 'message', operation: 'create' | 'update' | 'delete'): number {
    const priorities = {
      chat: {
        create: 3,
        update: 2,
        delete: 1
      },
      message: {
        create: 3,
        update: 1, // Messages rarely update
        delete: 2
      }
    };

    return priorities[entityType][operation];
  }

  // Create a manual conflict resolution prompt
  createConflictPrompt<T>(
    entityType: string,
    conflict: ConflictData<T>
  ): {
    title: string;
    description: string;
    options: Array<{
      label: string;
      value: 'local' | 'cloud' | 'merge';
      description: string;
    }>;
  } {
    return {
      title: `${entityType} Conflict Detected`,
      description: `Both local and cloud versions of this ${entityType.toLowerCase()} have been modified. Choose how to resolve:`,
      options: [
        {
          label: 'Keep Local Version',
          value: 'local',
          description: 'Use the version stored on this device'
        },
        {
          label: 'Keep Cloud Version',
          value: 'cloud',
          description: 'Use the version from the server'
        },
        {
          label: 'Merge Changes',
          value: 'merge',
          description: 'Combine both versions intelligently'
        }
      ]
    };
  }
}

// Singleton instance
let conflictResolver: ConflictResolverManager | null = null;

export function getConflictResolver(): ConflictResolverManager {
  if (!conflictResolver) {
    conflictResolver = new ConflictResolverManager();
  }
  return conflictResolver;
}

// Utility functions for common conflict scenarios
export function createTimestampConflictResolver<T extends { updatedAt: number }>(
  preferNewest = true
): ConflictResolver<T> {
  return (conflict: ConflictData<T>): ConflictResolution<T> => {
    const { localVersion, cloudVersion } = conflict;
    
    if (preferNewest) {
      return {
        resolved: localVersion.updatedAt > cloudVersion.updatedAt ? localVersion : cloudVersion,
        strategy: localVersion.updatedAt > cloudVersion.updatedAt ? 'local' : 'cloud'
      };
    } else {
      return {
        resolved: localVersion.updatedAt < cloudVersion.updatedAt ? localVersion : cloudVersion,
        strategy: localVersion.updatedAt < cloudVersion.updatedAt ? 'local' : 'cloud'
      };
    }
  };
}

export function createAlwaysPreferResolver<T>(
  strategy: 'local' | 'cloud'
): ConflictResolver<T> {
  return (conflict: ConflictData<T>): ConflictResolution<T> => {
    return {
      resolved: strategy === 'local' ? conflict.localVersion : conflict.cloudVersion,
      strategy
    };
  };
}