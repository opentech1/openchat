import { describe, it, expect } from 'vitest';
import { removeEmDashes, containsEmDashes } from '@/lib/text-transforms';

describe('text-transforms', () => {
  describe('removeEmDashes', () => {
    it('should remove single em-dash', () => {
      expect(removeEmDashes('Hello—world')).toBe('Hello-world');
    });

    it('should remove multiple em-dashes', () => {
      expect(removeEmDashes('A—B—C—D')).toBe('A-B-C-D');
    });

    it('should preserve regular hyphens', () => {
      expect(removeEmDashes('Hello-world')).toBe('Hello-world');
    });

    it('should handle empty string', () => {
      expect(removeEmDashes('')).toBe('');
    });

    it('should handle text without em-dashes', () => {
      const text = 'This is a normal sentence with no em-dashes.';
      expect(removeEmDashes(text)).toBe(text);
    });

    it('should preserve other punctuation', () => {
      const text = 'Hello, world! How are you?';
      expect(removeEmDashes(text)).toBe(text);
    });

    it('should handle complex sentence with em-dashes', () => {
      const input = 'The solution—which works well—is simple';
      const expected = 'The solution-which works well-is simple';
      expect(removeEmDashes(input)).toBe(expected);
    });

    it('should handle em-dashes at start and end', () => {
      expect(removeEmDashes('—test—')).toBe('-test-');
    });

    it('should handle consecutive em-dashes', () => {
      expect(removeEmDashes('test——test')).toBe('test--test');
    });
  });

  describe('containsEmDashes', () => {
    it('should detect em-dashes', () => {
      expect(containsEmDashes('Hello—world')).toBe(true);
    });

    it('should return false for text without em-dashes', () => {
      expect(containsEmDashes('Hello-world')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(containsEmDashes('')).toBe(false);
    });

    it('should detect multiple em-dashes', () => {
      expect(containsEmDashes('A—B—C')).toBe(true);
    });
  });
});
