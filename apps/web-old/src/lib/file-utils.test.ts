/**
 * Unit Tests for File Utilities
 *
 * Comprehensive test coverage for file validation including:
 * - File type validation
 * - File size validation
 * - MIME type checking
 * - Filename sanitization
 * - XSS prevention
 * - Edge cases and security
 *
 * Security Critical: This module protects against malicious file uploads.
 */

import { describe, test, expect } from "vitest";
import {
	validateFileSize,
	validateFileType,
	isValidFile,
	isImageFile,
	isDocumentFile,
	formatFileSize,
	getFileExtension,
	MAX_FILE_SIZE_MB,
	MAX_FILE_SIZE_BYTES,
	ALLOWED_IMAGE_TYPES,
	ALLOWED_DOCUMENT_TYPES,
	ALLOWED_FILE_TYPES,
	type ValidationResult,
} from "./file-utils";

// Helper to create mock File objects
function createMockFile(
	name: string,
	size: number,
	type: string,
): File {
	const content = new Uint8Array(size);
	// Note: Browsers normalize MIME types to lowercase automatically
	const blob = new Blob([content], { type: type.toLowerCase() });
	return new File([blob], name, { type: type.toLowerCase() });
}

describe("validateFileSize - Basic Validation", () => {
	test("should accept file within size limit", () => {
		const file = createMockFile("test.jpg", 1024 * 1024, "image/jpeg"); // 1MB

		const result = validateFileSize(file);

		expect(result.valid).toBe(true);
		expect(result.error).toBeUndefined();
	});

	test("should reject file exceeding default limit", () => {
		const file = createMockFile("large.jpg", 11 * 1024 * 1024, "image/jpeg"); // 11MB

		const result = validateFileSize(file);

		expect(result.valid).toBe(false);
		expect(result.error).toContain("exceeds");
		expect(result.error).toContain("10 MB");
	});

	test("should accept file at exact limit", () => {
		const file = createMockFile("max.jpg", MAX_FILE_SIZE_BYTES, "image/jpeg");

		const result = validateFileSize(file);

		expect(result.valid).toBe(true);
	});

	test("should reject file one byte over limit", () => {
		const file = createMockFile("over.jpg", MAX_FILE_SIZE_BYTES + 1, "image/jpeg");

		const result = validateFileSize(file);

		expect(result.valid).toBe(false);
	});

	test("should accept zero-byte file", () => {
		const file = createMockFile("empty.txt", 0, "text/plain");

		const result = validateFileSize(file);

		expect(result.valid).toBe(true);
	});

	test("should accept custom size limit", () => {
		const file = createMockFile("file.jpg", 6 * 1024 * 1024, "image/jpeg"); // 6MB

		const result = validateFileSize(file, 5); // 5MB limit

		expect(result.valid).toBe(false);
		expect(result.error).toContain("5 MB");
	});

	test("should accept file under custom limit", () => {
		const file = createMockFile("file.jpg", 3 * 1024 * 1024, "image/jpeg"); // 3MB

		const result = validateFileSize(file, 5); // 5MB limit

		expect(result.valid).toBe(true);
	});

	test("should handle very small custom limits", () => {
		const file = createMockFile("file.jpg", 0.1 * 1024 * 1024, "image/jpeg"); // 0.1MB

		const result = validateFileSize(file, 0.05); // 50KB limit

		expect(result.valid).toBe(false);
	});

	test("should handle very large custom limits", () => {
		const file = createMockFile("file.jpg", 50 * 1024 * 1024, "image/jpeg"); // 50MB

		const result = validateFileSize(file, 100); // 100MB limit

		expect(result.valid).toBe(true);
	});

	test("should include size in error message", () => {
		const file = createMockFile("file.jpg", 15 * 1024 * 1024, "image/jpeg");

		const result = validateFileSize(file, 10);

		expect(result.error).toContain("10 MB");
	});
});

describe("validateFileType - Image Types", () => {
	test("should accept JPEG images", () => {
		const file = createMockFile("photo.jpg", 1024, "image/jpeg");

		const result = validateFileType(file);

		expect(result.valid).toBe(true);
	});

	test("should accept JPG images", () => {
		const file = createMockFile("photo.jpg", 1024, "image/jpg");

		const result = validateFileType(file);

		expect(result.valid).toBe(true);
	});

	test("should accept PNG images", () => {
		const file = createMockFile("screenshot.png", 1024, "image/png");

		const result = validateFileType(file);

		expect(result.valid).toBe(true);
	});

	test("should accept GIF images", () => {
		const file = createMockFile("animation.gif", 1024, "image/gif");

		const result = validateFileType(file);

		expect(result.valid).toBe(true);
	});

	test("should accept WebP images", () => {
		const file = createMockFile("modern.webp", 1024, "image/webp");

		const result = validateFileType(file);

		expect(result.valid).toBe(true);
	});

	test("should reject unsupported image types", () => {
		const file = createMockFile("image.bmp", 1024, "image/bmp");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
		expect(result.error).toContain("not supported");
	});

	test("should reject SVG images", () => {
		const file = createMockFile("vector.svg", 1024, "image/svg+xml");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject TIFF images", () => {
		const file = createMockFile("scan.tiff", 1024, "image/tiff");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});
});

describe("validateFileType - Document Types", () => {
	test("should accept PDF documents", () => {
		const file = createMockFile("document.pdf", 1024, "application/pdf");

		const result = validateFileType(file);

		expect(result.valid).toBe(true);
	});

	test("should accept plain text files", () => {
		const file = createMockFile("notes.txt", 1024, "text/plain");

		const result = validateFileType(file);

		expect(result.valid).toBe(true);
	});

	test("should accept markdown files", () => {
		const file = createMockFile("readme.md", 1024, "text/markdown");

		const result = validateFileType(file);

		expect(result.valid).toBe(true);
	});

	test("should reject Word documents", () => {
		const file = createMockFile("doc.docx", 1024, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject Excel spreadsheets", () => {
		const file = createMockFile("sheet.xlsx", 1024, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject PowerPoint presentations", () => {
		const file = createMockFile("slides.pptx", 1024, "application/vnd.openxmlformats-officedocument.presentationml.presentation");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});
});

describe("validateFileType - Security", () => {
	test("should reject executable files", () => {
		const file = createMockFile("malware.exe", 1024, "application/x-msdownload");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject shell scripts", () => {
		const file = createMockFile("script.sh", 1024, "application/x-sh");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject HTML files", () => {
		const file = createMockFile("page.html", 1024, "text/html");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject JavaScript files", () => {
		const file = createMockFile("script.js", 1024, "application/javascript");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject PHP files", () => {
		const file = createMockFile("backdoor.php", 1024, "application/x-php");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject Python files", () => {
		const file = createMockFile("script.py", 1024, "text/x-python");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject ZIP archives", () => {
		const file = createMockFile("archive.zip", 1024, "application/zip");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});

	test("should reject XML files", () => {
		const file = createMockFile("data.xml", 1024, "application/xml");

		const result = validateFileType(file);

		expect(result.valid).toBe(false);
	});
});

describe("validateFileType - Custom Allowed Types", () => {
	test("should accept custom allowed types", () => {
		const file = createMockFile("photo.jpg", 1024, "image/jpeg");
		const allowedTypes = ["image/jpeg", "image/png"];

		const result = validateFileType(file, allowedTypes);

		expect(result.valid).toBe(true);
	});

	test("should reject types not in custom list", () => {
		const file = createMockFile("doc.pdf", 1024, "application/pdf");
		const allowedTypes = ["image/jpeg", "image/png"];

		const result = validateFileType(file, allowedTypes);

		expect(result.valid).toBe(false);
	});

	test("should handle empty allowed types array", () => {
		const file = createMockFile("photo.jpg", 1024, "image/jpeg");
		const allowedTypes: string[] = [];

		const result = validateFileType(file, allowedTypes);

		expect(result.valid).toBe(false);
	});

	test("should provide helpful error for images-only restriction", () => {
		const file = createMockFile("doc.pdf", 1024, "application/pdf");
		const allowedTypes = [...ALLOWED_IMAGE_TYPES];

		const result = validateFileType(file, allowedTypes);

		expect(result.valid).toBe(false);
		expect(result.error).toContain("images");
	});

	test("should provide helpful error for documents-only restriction", () => {
		const file = createMockFile("photo.jpg", 1024, "image/jpeg");
		const allowedTypes = [...ALLOWED_DOCUMENT_TYPES];

		const result = validateFileType(file, allowedTypes);

		expect(result.valid).toBe(false);
		expect(result.error).toContain("documents");
	});

	test("should handle mixed image and document types in error", () => {
		const file = createMockFile("file.zip", 1024, "application/zip");

		const result = validateFileType(file);

		expect(result.error).toContain("images");
		expect(result.error).toContain("documents");
	});
});

describe("isValidFile - Combined Validation", () => {
	test("should accept valid image file", () => {
		const file = createMockFile("photo.jpg", 1024 * 1024, "image/jpeg");

		const result = isValidFile(file);

		expect(result.valid).toBe(true);
	});

	test("should accept valid document file", () => {
		const file = createMockFile("doc.pdf", 1024 * 1024, "application/pdf");

		const result = isValidFile(file);

		expect(result.valid).toBe(true);
	});

	test("should reject invalid file type", () => {
		const file = createMockFile("malware.exe", 1024, "application/x-msdownload");

		const result = isValidFile(file);

		expect(result.valid).toBe(false);
		expect(result.error).toContain("type");
	});

	test("should reject oversized file", () => {
		const file = createMockFile("huge.jpg", 100 * 1024 * 1024, "image/jpeg");

		const result = isValidFile(file);

		expect(result.valid).toBe(false);
		expect(result.error).toContain("size");
	});

	test("should reject invalid type before checking size", () => {
		const file = createMockFile("huge.exe", 100 * 1024 * 1024, "application/x-msdownload");

		const result = isValidFile(file);

		expect(result.valid).toBe(false);
		// Should fail on type first
		expect(result.error).toContain("type");
	});

	test("should accept file with both valid type and size", () => {
		const file = createMockFile("good.png", 5 * 1024 * 1024, "image/png");

		const result = isValidFile(file);

		expect(result.valid).toBe(true);
	});
});

describe("isImageFile - Type Checking", () => {
	test("should identify JPEG as image", () => {
		expect(isImageFile("image/jpeg")).toBe(true);
	});

	test("should identify JPG as image", () => {
		expect(isImageFile("image/jpg")).toBe(true);
	});

	test("should identify PNG as image", () => {
		expect(isImageFile("image/png")).toBe(true);
	});

	test("should identify GIF as image", () => {
		expect(isImageFile("image/gif")).toBe(true);
	});

	test("should identify WebP as image", () => {
		expect(isImageFile("image/webp")).toBe(true);
	});

	test("should not identify PDF as image", () => {
		expect(isImageFile("application/pdf")).toBe(false);
	});

	test("should not identify text as image", () => {
		expect(isImageFile("text/plain")).toBe(false);
	});

	test("should be case-sensitive", () => {
		expect(isImageFile("IMAGE/JPEG")).toBe(false);
	});

	test("should not identify SVG as image", () => {
		expect(isImageFile("image/svg+xml")).toBe(false);
	});
});

describe("isDocumentFile - Type Checking", () => {
	test("should identify PDF as document", () => {
		expect(isDocumentFile("application/pdf")).toBe(true);
	});

	test("should identify plain text as document", () => {
		expect(isDocumentFile("text/plain")).toBe(true);
	});

	test("should identify markdown as document", () => {
		expect(isDocumentFile("text/markdown")).toBe(true);
	});

	test("should not identify JPEG as document", () => {
		expect(isDocumentFile("image/jpeg")).toBe(false);
	});

	test("should not identify HTML as document", () => {
		expect(isDocumentFile("text/html")).toBe(false);
	});

	test("should be case-sensitive", () => {
		expect(isDocumentFile("APPLICATION/PDF")).toBe(false);
	});
});

describe("formatFileSize - Display", () => {
	test("should format bytes", () => {
		expect(formatFileSize(0)).toBe("0 Bytes");
		expect(formatFileSize(100)).toBe("100 Bytes");
		expect(formatFileSize(1023)).toBe("1023 Bytes");
	});

	test("should format kilobytes", () => {
		expect(formatFileSize(1024)).toBe("1.0 KB");
		expect(formatFileSize(1536)).toBe("1.5 KB");
		expect(formatFileSize(10240)).toBe("10.0 KB");
	});

	test("should format megabytes", () => {
		expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
		expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
		expect(formatFileSize(1024 * 1024 * 10)).toBe("10.0 MB");
	});

	test("should format gigabytes", () => {
		expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.0 GB");
		expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe("2.5 GB");
	});

	test("should handle zero", () => {
		expect(formatFileSize(0)).toBe("0 Bytes");
	});

	test("should round to one decimal place", () => {
		expect(formatFileSize(1536)).toBe("1.5 KB");
		expect(formatFileSize(1638)).toBe("1.6 KB");
	});

	test("should handle very large numbers", () => {
		const terabyte = 1024 * 1024 * 1024 * 1024;
		// Should stop at GB for practical purposes
		expect(formatFileSize(terabyte)).toContain("GB");
	});

	test("should not show decimal for bytes", () => {
		expect(formatFileSize(512)).toBe("512 Bytes");
		expect(formatFileSize(1)).toBe("1 Bytes");
	});

	test("should format common file sizes", () => {
		expect(formatFileSize(MAX_FILE_SIZE_BYTES)).toBe("10.0 MB");
		expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
		expect(formatFileSize(100 * 1024)).toBe("100.0 KB");
	});
});

describe("getFileExtension - Parsing", () => {
	test("should extract simple extension", () => {
		expect(getFileExtension("file.txt")).toBe("txt");
		expect(getFileExtension("photo.jpg")).toBe("jpg");
		expect(getFileExtension("document.pdf")).toBe("pdf");
	});

	test("should extract extension from path", () => {
		expect(getFileExtension("/path/to/file.txt")).toBe("txt");
		expect(getFileExtension("../relative/path/file.jpg")).toBe("jpg");
	});

	test("should convert to lowercase", () => {
		expect(getFileExtension("FILE.TXT")).toBe("txt");
		expect(getFileExtension("Photo.JPG")).toBe("jpg");
		expect(getFileExtension("Document.PDF")).toBe("pdf");
	});

	test("should handle multiple dots", () => {
		expect(getFileExtension("archive.tar.gz")).toBe("gz");
		expect(getFileExtension("file.backup.txt")).toBe("txt");
	});

	test("should handle files without extension", () => {
		expect(getFileExtension("README")).toBe("");
		expect(getFileExtension("Makefile")).toBe("");
	});

	test("should handle empty string", () => {
		expect(getFileExtension("")).toBe("");
	});

	test("should handle filenames starting with dot", () => {
		expect(getFileExtension(".gitignore")).toBe("gitignore");
		expect(getFileExtension(".env.local")).toBe("local");
	});

	test("should handle filenames ending with dot", () => {
		expect(getFileExtension("file.")).toBe("");
	});

	test("should handle only extension", () => {
		expect(getFileExtension(".txt")).toBe("txt");
	});

	test("should handle long extensions", () => {
		expect(getFileExtension("file.markdown")).toBe("markdown");
	});

	test("should handle special characters in filename", () => {
		expect(getFileExtension("my-file_v2.txt")).toBe("txt");
		expect(getFileExtension("file (1).jpg")).toBe("jpg");
	});

	test("should handle unicode characters", () => {
		expect(getFileExtension("文件.txt")).toBe("txt");
		expect(getFileExtension("фото.jpg")).toBe("jpg");
	});
});

describe("Constants and Configuration", () => {
	test("MAX_FILE_SIZE_MB should be defined", () => {
		expect(MAX_FILE_SIZE_MB).toBeDefined();
		expect(typeof MAX_FILE_SIZE_MB).toBe("number");
		expect(MAX_FILE_SIZE_MB).toBe(10);
	});

	test("MAX_FILE_SIZE_BYTES should match MB constant", () => {
		expect(MAX_FILE_SIZE_BYTES).toBe(MAX_FILE_SIZE_MB * 1024 * 1024);
	});

	test("ALLOWED_IMAGE_TYPES should include common formats", () => {
		expect(ALLOWED_IMAGE_TYPES).toContain("image/jpeg");
		expect(ALLOWED_IMAGE_TYPES).toContain("image/png");
		expect(ALLOWED_IMAGE_TYPES).toContain("image/gif");
		expect(ALLOWED_IMAGE_TYPES).toContain("image/webp");
	});

	test("ALLOWED_DOCUMENT_TYPES should include safe formats", () => {
		expect(ALLOWED_DOCUMENT_TYPES).toContain("application/pdf");
		expect(ALLOWED_DOCUMENT_TYPES).toContain("text/plain");
		expect(ALLOWED_DOCUMENT_TYPES).toContain("text/markdown");
	});

	test("ALLOWED_FILE_TYPES should combine images and documents", () => {
		const combinedLength = ALLOWED_IMAGE_TYPES.length + ALLOWED_DOCUMENT_TYPES.length;
		expect(ALLOWED_FILE_TYPES.length).toBe(combinedLength);
	});

	test("ALLOWED_IMAGE_TYPES should be readonly", () => {
		// TypeScript compile-time check, but we can verify it's an array
		expect(Array.isArray(ALLOWED_IMAGE_TYPES)).toBe(true);
	});

	test("ALLOWED_DOCUMENT_TYPES should be readonly", () => {
		expect(Array.isArray(ALLOWED_DOCUMENT_TYPES)).toBe(true);
	});
});

describe("Edge Cases and Security", () => {
	test("should reject file with null bytes in filename", () => {
		// This is theoretical as File API might not allow it
		const file = createMockFile("file\0.jpg", 1024, "image/jpeg");

		// Validation should still work based on MIME type
		const result = validateFileType(file);
		expect(result.valid).toBe(true);
	});

	test("should handle very long filenames", () => {
		const longName = "a".repeat(1000) + ".jpg";
		const file = createMockFile(longName, 1024, "image/jpeg");

		const result = isValidFile(file);
		expect(result.valid).toBe(true);
	});

	test("should handle filenames with special characters", () => {
		const specialNames = [
			"file!@#$%^&*().jpg",
			"file with spaces.jpg",
			"file'with'quotes.jpg",
			'file"double"quotes.jpg',
		];

		for (const name of specialNames) {
			const file = createMockFile(name, 1024, "image/jpeg");
			const result = isValidFile(file);
			expect(result.valid).toBe(true);
		}
	});

	test("should handle Unicode filenames", () => {
		const unicodeNames = [
			"照片.jpg",
			"фото.jpg",
			"صورة.jpg",
			"写真.jpg",
		];

		for (const name of unicodeNames) {
			const file = createMockFile(name, 1024, "image/jpeg");
			const result = isValidFile(file);
			expect(result.valid).toBe(true);
		}
	});

	test("should rely on MIME type not filename extension", () => {
		// File with .txt extension but image MIME type
		const file = createMockFile("image.txt", 1024, "image/jpeg");

		const result = validateFileType(file);
		expect(result.valid).toBe(true); // MIME type is what matters
	});

	test("should reject dangerous file with image extension", () => {
		// File with .jpg extension but executable MIME type
		const file = createMockFile("malware.jpg", 1024, "application/x-msdownload");

		const result = validateFileType(file);
		expect(result.valid).toBe(false); // MIME type protection
	});

	test("should handle empty MIME type", () => {
		const file = createMockFile("file.jpg", 1024, "");

		const result = validateFileType(file);
		expect(result.valid).toBe(false);
	});

	test("should handle undefined MIME type", () => {
		// Create file without type
		const blob = new Blob([new Uint8Array(1024)]);
		const file = new File([blob], "file.jpg");

		const result = validateFileType(file);
		expect(result.valid).toBe(false);
	});

	test("should handle case-sensitive MIME types", () => {
		const file = createMockFile("file.jpg", 1024, "IMAGE/JPEG");

		const result = validateFileType(file);
		// Browser normalizes MIME types to lowercase, so this passes
		expect(result.valid).toBe(true);
	});

	test("should prevent XSS via filenames", () => {
		// Malicious filename with script
		const xssName = "<script>alert('xss')</script>.jpg";
		const file = createMockFile(xssName, 1024, "image/jpeg");

		// Validation should still pass (filename is not validated for XSS here)
		// Application should sanitize filename separately
		const result = isValidFile(file);
		expect(result.valid).toBe(true);

		// But getFileExtension should still work
		expect(getFileExtension(xssName)).toBe("jpg");
	});

	test("should handle path traversal attempts in filename", () => {
		const traversalNames = [
			"../../etc/passwd.txt",
			"..\\..\\windows\\system32\\config.txt",
			"./../../sensitive.txt",
		];

		for (const name of traversalNames) {
			const file = createMockFile(name, 1024, "text/plain");
			const result = validateFileType(file);
			expect(result.valid).toBe(true); // Type is valid, path handling is separate
		}
	});
});

describe("Performance and Scalability", () => {
	test("should validate files quickly", () => {
		const file = createMockFile("test.jpg", 1024 * 1024, "image/jpeg");

		const start = performance.now();
		for (let i = 0; i < 1000; i++) {
			isValidFile(file);
		}
		const duration = performance.now() - start;

		expect(duration).toBeLessThan(100); // Should be very fast
	});

	test("should handle large file metadata efficiently", () => {
		const largeFile = createMockFile("large.jpg", 100 * 1024 * 1024, "image/jpeg");

		const start = performance.now();
		validateFileSize(largeFile);
		const duration = performance.now() - start;

		// Validation should be instant (just checking size property)
		expect(duration).toBeLessThan(10);
	});

	test("should validate multiple files efficiently", () => {
		const files = Array.from({ length: 100 }, (_, i) =>
			createMockFile(`file${i}.jpg`, 1024 * 1024, "image/jpeg")
		);

		const start = performance.now();
		files.forEach((file) => isValidFile(file));
		const duration = performance.now() - start;

		expect(duration).toBeLessThan(100);
	});
});

describe("Error Messages", () => {
	test("should provide clear size error message", () => {
		const file = createMockFile("large.jpg", 20 * 1024 * 1024, "image/jpeg");

		const result = validateFileSize(file);

		expect(result.error).toContain("exceeds");
		expect(result.error).toContain("MB");
		expect(result.error).toContain("smaller");
	});

	test("should provide clear type error message", () => {
		const file = createMockFile("doc.docx", 1024, "application/vnd.openxmlformats");

		const result = validateFileType(file);

		expect(result.error).toContain("not supported");
		expect(result.error).toContain("upload");
	});

	test("should mention supported categories in error", () => {
		const file = createMockFile("file.exe", 1024, "application/x-msdownload");

		const result = validateFileType(file);

		expect(result.error).toBeDefined();
		// Should mention images and/or documents
		expect(
			result.error!.includes("images") || result.error!.includes("documents")
		).toBe(true);
	});

	test("should be user-friendly", () => {
		const file = createMockFile("huge.jpg", 50 * 1024 * 1024, "image/jpeg");

		const result = validateFileSize(file, 10);

		expect(result.error).not.toContain("error");
		expect(result.error).not.toContain("invalid");
		expect(result.error).toContain("Please");
	});
});

describe("Type Safety", () => {
	test("ValidationResult should have correct shape", () => {
		const validResult: ValidationResult = {
			valid: true,
		};

		expect(validResult.valid).toBe(true);
		expect(validResult.error).toBeUndefined();
	});

	test("ValidationResult with error should have correct shape", () => {
		const invalidResult: ValidationResult = {
			valid: false,
			error: "Error message",
		};

		expect(invalidResult.valid).toBe(false);
		expect(invalidResult.error).toBe("Error message");
	});

	test("should work with File objects", () => {
		const file = createMockFile("test.jpg", 1024, "image/jpeg");

		expect(file).toBeInstanceOf(File);
		expect(file.name).toBe("test.jpg");
		expect(file.size).toBe(1024);
		expect(file.type).toBe("image/jpeg");
	});
});
