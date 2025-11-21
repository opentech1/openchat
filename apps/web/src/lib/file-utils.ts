/**
 * File validation and utility functions for client-side file handling
 */

// File size constants
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Allowed file types
export const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
] as const;

export const ALLOWED_FILE_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES,
] as const;

// Type definitions
export type AllowedImageType = typeof ALLOWED_IMAGE_TYPES[number];
export type AllowedDocumentType = typeof ALLOWED_DOCUMENT_TYPES[number];
export type AllowedFileType = typeof ALLOWED_FILE_TYPES[number];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Check if a content type is an image
 * @param contentType - The MIME type to check
 * @returns true if the content type is an allowed image type
 */
export function isImageFile(contentType: string): boolean {
  // Normalize the content type by removing parameters (e.g., "image/png;charset=utf-8" -> "image/png")
  const normalizedType = contentType.split(';')[0].trim();
  return ALLOWED_IMAGE_TYPES.includes(normalizedType as AllowedImageType);
}

/**
 * Check if a content type is a document
 * @param contentType - The MIME type to check
 * @returns true if the content type is an allowed document type
 */
export function isDocumentFile(contentType: string): boolean {
  // Normalize the content type by removing parameters (e.g., "text/plain;charset=utf-8" -> "text/plain")
  const normalizedType = contentType.split(';')[0].trim();
  return ALLOWED_DOCUMENT_TYPES.includes(normalizedType as AllowedDocumentType);
}

/**
 * Validate file size against a maximum size limit
 * @param file - The file to validate
 * @param maxSizeMB - Maximum size in megabytes (defaults to MAX_FILE_SIZE_MB)
 * @returns Validation result with error message if invalid
 */
export function validateFileSize(
  file: File,
  maxSizeMB: number = MAX_FILE_SIZE_MB
): ValidationResult {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB} MB. Please choose a smaller file.`,
    };
  }

  return { valid: true };
}

/**
 * Validate file type against allowed types
 * @param file - The file to validate
 * @param allowedTypes - Array of allowed MIME types (defaults to ALLOWED_FILE_TYPES)
 * @returns Validation result with error message if invalid
 */
export function validateFileType(
  file: File,
  allowedTypes: string[] = [...ALLOWED_FILE_TYPES]
): ValidationResult {
  // Normalize the file type by removing parameters (e.g., "text/plain;charset=utf-8" -> "text/plain")
  const normalizedFileType = file.type.split(';')[0].trim();

  if (!allowedTypes.includes(normalizedFileType)) {
    const typeCategories: string[] = [];

    if (allowedTypes.some(type => ALLOWED_IMAGE_TYPES.includes(type as AllowedImageType))) {
      typeCategories.push('images');
    }
    if (allowedTypes.some(type => ALLOWED_DOCUMENT_TYPES.includes(type as AllowedDocumentType))) {
      typeCategories.push('documents');
    }

    const categoryText = typeCategories.length > 0
      ? typeCategories.join(' and ')
      : 'allowed file types';

    return {
      valid: false,
      error: `File type not supported. Please upload ${categoryText} only.`,
    };
  }

  return { valid: true };
}

/**
 * Format bytes to human-readable file size
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "2.5 MB", "500 KB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Limit to GB for practical purposes
  const sizeIndex = Math.min(i, sizes.length - 1);
  const value = bytes / Math.pow(k, sizeIndex);

  // Format with 1 decimal place for sizes >= 1 KB
  const formattedValue = sizeIndex > 0
    ? value.toFixed(1)
    : Math.round(value).toString();

  return `${formattedValue} ${sizes[sizeIndex]}`;
}

/**
 * Get file extension from filename
 * @param filename - The filename to extract extension from
 * @returns File extension (lowercase, without dot) or empty string if none
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');

  if (lastDotIndex === -1 || lastDotIndex === filename.length - 1) {
    return '';
  }

  return filename.slice(lastDotIndex + 1).toLowerCase();
}

/**
 * Validate both file size and type
 * @param file - The file to validate
 * @returns Validation result with error message if invalid
 */
export function isValidFile(file: File): ValidationResult {
  // Validate file type first
  const typeValidation = validateFileType(file);
  if (!typeValidation.valid) {
    return typeValidation;
  }

  // Then validate file size
  const sizeValidation = validateFileSize(file);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }

  return { valid: true };
}
