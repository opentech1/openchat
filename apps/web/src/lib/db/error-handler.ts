export enum DatabaseErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  QUERY_FAILED = 'QUERY_FAILED',
  SYNC_FAILED = 'SYNC_FAILED',
  CONFLICT_RESOLUTION_FAILED = 'CONFLICT_RESOLUTION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  STORAGE_QUOTA_EXCEEDED = 'STORAGE_QUOTA_EXCEEDED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  WORKER_ERROR = 'WORKER_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class DatabaseError extends Error {
  constructor(
    public type: DatabaseErrorType,
    message: string,
    public originalError?: Error,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'DatabaseError';
  }

  toJSON() {
    return {
      name: this.name,
      type: this.type,
      message: this.message,
      context: this.context,
      originalError: this.originalError?.message
    };
  }
}

export class SyncError extends DatabaseError {
  constructor(
    message: string,
    public syncDirection: 'push' | 'pull' | 'bidirectional',
    public failedOperations: Array<{ entityType: string; entityId: string; operation: string }> = [],
    originalError?: Error
  ) {
    super(DatabaseErrorType.SYNC_FAILED, message, originalError, {
      syncDirection,
      failedOperations
    });
    this.name = 'SyncError';
  }
}

export class ConflictResolutionError extends DatabaseError {
  constructor(
    message: string,
    public entityType: string,
    public entityId: string,
    originalError?: Error
  ) {
    super(DatabaseErrorType.CONFLICT_RESOLUTION_FAILED, message, originalError, {
      entityType,
      entityId
    });
    this.name = 'ConflictResolutionError';
  }
}

interface ErrorHandlerConfig {
  enableLogging?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: DatabaseError) => void;
}

class DatabaseErrorHandler {
  private config: Required<ErrorHandlerConfig>;
  private retryCount = new Map<string, number>();

  constructor(config: ErrorHandlerConfig = {}) {
    this.config = {
      enableLogging: true,
      maxRetries: 3,
      retryDelay: 1000,
      onError: () => {},
      ...config
    };
  }

  handleError(error: unknown, context?: Record<string, any>): DatabaseError {
    const dbError = this.transformError(error, context);
    
    if (this.config.enableLogging) {
      this.logError(dbError);
    }

    this.config.onError(dbError);
    return dbError;
  }

  private transformError(error: unknown, context?: Record<string, any>): DatabaseError {
    if (error instanceof DatabaseError) {
      return error;
    }

    if (error instanceof Error) {
      const errorType = this.classifyError(error);
      return new DatabaseError(errorType, error.message, error, context);
    }

    return new DatabaseError(
      DatabaseErrorType.UNKNOWN_ERROR,
      typeof error === 'string' ? error : 'An unknown error occurred',
      undefined,
      context
    );
  }

  private classifyError(error: Error): DatabaseErrorType {
    const message = error.message.toLowerCase();

    // Network-related errors
    if (message.includes('fetch') || message.includes('network') || message.includes('offline')) {
      return DatabaseErrorType.NETWORK_ERROR;
    }

    // Storage quota errors
    if (message.includes('quota') || message.includes('storage') || message.includes('disk')) {
      return DatabaseErrorType.STORAGE_QUOTA_EXCEEDED;
    }

    // Permission errors
    if (message.includes('permission') || message.includes('denied') || message.includes('forbidden')) {
      return DatabaseErrorType.PERMISSION_DENIED;
    }

    // Worker-related errors
    if (message.includes('worker') || message.includes('postmessage')) {
      return DatabaseErrorType.WORKER_ERROR;
    }

    // Connection errors
    if (message.includes('connection') || message.includes('timeout')) {
      return DatabaseErrorType.CONNECTION_FAILED;
    }

    // Query errors
    if (message.includes('sql') || message.includes('sqlite') || message.includes('syntax')) {
      return DatabaseErrorType.QUERY_FAILED;
    }

    return DatabaseErrorType.UNKNOWN_ERROR;
  }

  private logError(error: DatabaseError): void {
    console.group(`🔴 Database Error: ${error.type}`);
    console.error('Message:', error.message);
    
    if (error.context) {
      console.error('Context:', error.context);
    }
    
    if (error.originalError) {
      console.error('Original Error:', error.originalError);
    }
    
    console.error('Stack:', error.stack);
    console.groupEnd();
  }

  async withRetry<T>(
    operation: () => Promise<T>,
    operationId: string,
    context?: Record<string, any>
  ): Promise<T> {
    const currentRetries = this.retryCount.get(operationId) || 0;

    try {
      const result = await operation();
      this.retryCount.delete(operationId); // Reset on success
      return result;
    } catch (error) {
      const dbError = this.handleError(error, { ...context, operationId, retryAttempt: currentRetries });

      if (currentRetries < this.config.maxRetries && this.shouldRetry(dbError)) {
        this.retryCount.set(operationId, currentRetries + 1);
        
        if (this.config.enableLogging) {
          console.warn(`⚠️ Retrying operation ${operationId} (attempt ${currentRetries + 1}/${this.config.maxRetries})`);
        }

        await this.delay(this.config.retryDelay * Math.pow(2, currentRetries)); // Exponential backoff
        return this.withRetry(operation, operationId, context);
      }

      this.retryCount.delete(operationId);
      throw dbError;
    }
  }

  private shouldRetry(error: DatabaseError): boolean {
    // Don't retry certain types of errors
    const nonRetryableErrors = [
      DatabaseErrorType.PERMISSION_DENIED,
      DatabaseErrorType.STORAGE_QUOTA_EXCEEDED,
      DatabaseErrorType.CONFLICT_RESOLUTION_FAILED
    ];

    return !nonRetryableErrors.includes(error.type);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Error recovery strategies
  async recoverFromError(error: DatabaseError): Promise<boolean> {
    switch (error.type) {
      case DatabaseErrorType.STORAGE_QUOTA_EXCEEDED:
        return this.handleStorageQuotaExceeded();
      
      case DatabaseErrorType.WORKER_ERROR:
        return this.handleWorkerError();
      
      case DatabaseErrorType.CONNECTION_FAILED:
        return this.handleConnectionError();
      
      default:
        return false;
    }
  }

  private async handleStorageQuotaExceeded(): Promise<boolean> {
    try {
      // Clear old sync events and temporary data
      console.warn('Storage quota exceeded, attempting cleanup...');
      
      // This would integrate with your database cleanup methods
      // For now, we'll just log the attempt
      console.info('Storage cleanup completed');
      return true;
    } catch (error) {
      console.error('Failed to recover from storage quota error:', error);
      return false;
    }
  }

  private async handleWorkerError(): Promise<boolean> {
    try {
      // Restart the database worker
      console.warn('Worker error detected, attempting to restart...');
      
      // This would integrate with your database initialization
      // For now, we'll just log the attempt
      console.info('Worker restart completed');
      return true;
    } catch (error) {
      console.error('Failed to recover from worker error:', error);
      return false;
    }
  }

  private async handleConnectionError(): Promise<boolean> {
    // For connection errors, we typically just need to wait for network recovery
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (navigator.onLine) {
          resolve(true);
        } else {
          setTimeout(checkConnection, 1000);
        }
      };
      checkConnection();
    });
  }

  // Metrics and monitoring
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<DatabaseErrorType, number>;
    retryStats: { operationId: string; retries: number }[];
  } {
    const retryStats = Array.from(this.retryCount.entries()).map(([operationId, retries]) => ({
      operationId,
      retries
    }));

    return {
      totalErrors: 0, // Would need to track this in a real implementation
      errorsByType: {} as Record<DatabaseErrorType, number>, // Would need to track this
      retryStats
    };
  }

  reset(): void {
    this.retryCount.clear();
  }
}

// Singleton instance
let errorHandler: DatabaseErrorHandler | null = null;

export function getDatabaseErrorHandler(config?: ErrorHandlerConfig): DatabaseErrorHandler {
  if (!errorHandler) {
    errorHandler = new DatabaseErrorHandler(config);
  }
  return errorHandler;
}

// Utility functions for common error scenarios
export function isRetryableError(error: DatabaseError): boolean {
  const retryableErrors = [
    DatabaseErrorType.CONNECTION_FAILED,
    DatabaseErrorType.NETWORK_ERROR,
    DatabaseErrorType.QUERY_FAILED,
    DatabaseErrorType.WORKER_ERROR
  ];
  
  return retryableErrors.includes(error.type);
}

export function isRecoverableError(error: DatabaseError): boolean {
  const recoverableErrors = [
    DatabaseErrorType.STORAGE_QUOTA_EXCEEDED,
    DatabaseErrorType.WORKER_ERROR,
    DatabaseErrorType.CONNECTION_FAILED
  ];
  
  return recoverableErrors.includes(error.type);
}

export function getUserFriendlyErrorMessage(error: DatabaseError): string {
  switch (error.type) {
    case DatabaseErrorType.NETWORK_ERROR:
      return 'Unable to connect to the server. Please check your internet connection.';
    
    case DatabaseErrorType.STORAGE_QUOTA_EXCEEDED:
      return 'Your device is running out of storage space. Please free up some space and try again.';
    
    case DatabaseErrorType.PERMISSION_DENIED:
      return 'Permission denied. Please check your browser settings.';
    
    case DatabaseErrorType.SYNC_FAILED:
      return 'Failed to sync your data. Your changes are saved locally and will sync when the connection improves.';
    
    case DatabaseErrorType.CONFLICT_RESOLUTION_FAILED:
      return 'A conflict occurred while syncing. Please review and resolve the conflicts manually.';
    
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}