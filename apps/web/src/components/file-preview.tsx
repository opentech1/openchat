import { memo } from 'react';
import { X, File, ImageIcon } from '@/lib/icons';

interface FilePreviewProps {
  file: {
    id?: string;
    storageId?: string;
    filename: string;
    contentType: string;
    size: number;
    url?: string;
  };
  onRemove?: () => void;
  showRemove?: boolean;
}

function FilePreviewComponent({ file, onRemove, showRemove = true }: FilePreviewProps) {
  const isImage = file.contentType.startsWith('image/');
  const fileSizeKB = (file.size / 1024).toFixed(1);

  return (
    <div className="flex items-center gap-2 p-2 rounded border bg-muted">
      {/* Thumbnail or Icon */}
      <div className="size-12 rounded flex-shrink-0">
        {isImage && file.url ? (
          <img
            src={file.url}
            alt={file.filename}
            className="size-12 rounded object-cover"
          />
        ) : isImage ? (
          <div className="size-12 rounded bg-muted-foreground/10 flex items-center justify-center">
            <ImageIcon className="size-6 text-muted-foreground" />
          </div>
        ) : (
          <div className="size-12 rounded bg-muted-foreground/10 flex items-center justify-center">
            <File className="size-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{file.filename}</p>
        <p className="text-sm text-muted-foreground">{fileSizeKB} KB</p>
      </div>

      {/* Remove Button */}
      {showRemove && onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${file.filename}`}
          className="size-8 flex-shrink-0 flex items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

// PERFORMANCE FIX: Memoize with custom comparison to prevent re-renders in message lists
export const FilePreview = memo(FilePreviewComponent, (prev, next) => {
  // Compare by storageId if available (most reliable), otherwise by other props
  if (prev.file.storageId && next.file.storageId) {
    return prev.file.storageId === next.file.storageId && prev.showRemove === next.showRemove;
  }
  // Fallback: compare all file properties
  return (
    prev.file.filename === next.file.filename &&
    prev.file.contentType === next.file.contentType &&
    prev.file.size === next.file.size &&
    prev.file.url === next.file.url &&
    prev.showRemove === next.showRemove &&
    prev.onRemove === next.onRemove
  );
});
