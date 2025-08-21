"use client";

import { useDatabaseContext } from './database-provider';
import { Badge } from './ui/badge';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export function DatabaseInitializationStatus() {
  const { isInitialized, initializationError } = useDatabaseContext();

  if (initializationError) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        DB Error
      </Badge>
    );
  }

  if (!isInitialized) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Initializing
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      <CheckCircle className="h-3 w-3 text-green-500" />
      Local DB Ready
    </Badge>
  );
}