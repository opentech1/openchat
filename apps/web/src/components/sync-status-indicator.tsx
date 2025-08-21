"use client";

import { useLocalDatabase } from '@/hooks/use-local-database';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from './ui/tooltip';
import { 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Database
} from 'lucide-react';

interface SyncStatusIndicatorProps {
  userId?: string;
}

export function SyncStatusIndicator({ userId }: SyncStatusIndicatorProps) {
  const { syncStatus, triggerSync, isInitialized } = useLocalDatabase({ userId });

  if (!userId || !isInitialized) {
    return null;
  }

  const getStatusIcon = () => {
    if (syncStatus.error) return <AlertCircle className="h-4 w-4 text-destructive" />;
    if (syncStatus.syncing) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (!syncStatus.isOnline) return <WifiOff className="h-4 w-4 text-orange-500" />;
    return <Database className="h-4 w-4 text-green-500" />;
  };

  const getStatusText = () => {
    if (syncStatus.error) return 'Sync Error';
    if (syncStatus.syncing) return 'Syncing';
    if (!syncStatus.isOnline) return 'Offline';
    return 'Local DB';
  };

  const getStatusColor = () => {
    if (syncStatus.error) return 'destructive';
    if (syncStatus.syncing) return 'secondary';
    if (!syncStatus.isOnline) return 'outline';
    return 'outline';
  };

  const getDetailedStatus = () => {
    if (syncStatus.error) {
      return `Error: ${syncStatus.error}`;
    }
    if (syncStatus.syncing) {
      return 'Synchronizing with cloud...';
    }
    if (!syncStatus.isOnline) {
      return 'Working offline. Changes will sync when online.';
    }
    if (syncStatus.lastSync) {
      return `Last sync: ${syncStatus.lastSync.toLocaleTimeString()}`;
    }
    return 'Local-first database ready';
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-2">
            <Badge 
              variant={getStatusColor() as any} 
              className="flex items-center gap-1 cursor-pointer"
            >
              {getStatusIcon()}
              <span className="hidden sm:inline">{getStatusText()}</span>
            </Badge>
            
            {syncStatus.pendingChanges > 0 && (
              <Badge variant="secondary" className="text-xs">
                {syncStatus.pendingChanges}
              </Badge>
            )}
            
            {syncStatus.isOnline && !syncStatus.syncing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={triggerSync}
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-center">
            <div className="font-medium">{getDetailedStatus()}</div>
            {syncStatus.pendingChanges > 0 && (
              <div className="text-xs text-muted-foreground mt-1">
                {syncStatus.pendingChanges} changes pending
              </div>
            )}
            {syncStatus.isOnline && !syncStatus.syncing && (
              <div className="text-xs text-muted-foreground mt-1">
                Click sync button to manually sync
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}