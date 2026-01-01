/**
 * Text transformation utilities for processing model outputs
 */

/**
 * Removes em-dashes (—) from text and replaces them with hyphens (-)
 * This ensures consistent formatting and prevents em-dash usage in model outputs
 *
 * @param text - The text to process
 * @returns Text with em-dashes replaced by hyphens
 */
export function removeEmDashes(text: string): string {
  // Replace em-dashes (—) with regular hyphens (-)
  return text.replace(/—/g, '-');
}

/**
 * Checks if text contains any em-dashes
 *
 * @param text - The text to check
 * @returns True if em-dashes are found, false otherwise
 */
export function containsEmDashes(text: string): boolean {
  return text.includes('—');
}
