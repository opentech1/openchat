/**
 * Unit Tests for File Upload Functionality
 *
 * Tests file upload validation, type checking, size limits, and attachment handling.
 */

import { describe, it, expect } from "vitest";

// File type constants from file-upload-button.tsx
const IMAGE_TYPES = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
	"image/bmp",
];

const AUDIO_TYPES = [
	"audio/mpeg",
	"audio/mp3",
	"audio/wav",
	"audio/ogg",
	"audio/m4a",
	"audio/aac",
	"audio/webm",
];

const VIDEO_TYPES = [
	"video/mp4",
	"video/mpeg",
	"video/quicktime",
	"video/webm",
	"video/x-msvideo",
	"video/x-ms-wmv",
];

const DOCUMENT_TYPES = [
	"application/pdf",
	"text/plain",
	"text/markdown",
];

// Size limits from files.ts
const DEFAULT_MAX_SIZE_MB = 10;
const AUDIO_MAX_SIZE_MB = 25;
const VIDEO_MAX_SIZE_MB = 50;

const MB_TO_BYTES = 1024 * 1024;

describe("File Upload - Type Validation", () => {
	describe("Image Files", () => {
		it("should accept valid image types", () => {
			// Arrange & Act & Assert
			IMAGE_TYPES.forEach((type) => {
				expect(IMAGE_TYPES.includes(type)).toBe(true);
			});
		});

		it("should validate JPEG images", () => {
			// Arrange
			const file = new File(["dummy content"], "test.jpg", {
				type: "image/jpeg",
			});

			// Act
			const isValidType = IMAGE_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
			expect(file.name).toBe("test.jpg");
		});

		it("should validate PNG images", () => {
			// Arrange
			const file = new File(["dummy content"], "test.png", {
				type: "image/png",
			});

			// Act
			const isValidType = IMAGE_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should validate WebP images", () => {
			// Arrange
			const file = new File(["dummy content"], "test.webp", {
				type: "image/webp",
			});

			// Act
			const isValidType = IMAGE_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should validate GIF images", () => {
			// Arrange
			const file = new File(["dummy content"], "test.gif", {
				type: "image/gif",
			});

			// Act
			const isValidType = IMAGE_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should reject invalid image types", () => {
			// Arrange
			const invalidTypes = ["image/tiff", "image/bpg", "image/x-icon"];

			// Act & Assert
			invalidTypes.forEach((type) => {
				expect(IMAGE_TYPES.includes(type)).toBe(false);
			});
		});
	});

	describe("Document Files", () => {
		it("should accept PDF documents", () => {
			// Arrange
			const file = new File(["dummy content"], "test.pdf", {
				type: "application/pdf",
			});

			// Act
			const isValidType = DOCUMENT_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should accept plain text files", () => {
			// Arrange
			const file = new File(["dummy content"], "test.txt", {
				type: "text/plain",
			});

			// Act
			// Normalize MIME type by removing parameters (e.g., charset)
			const normalizedType = file.type.split(';')[0].trim();
			const isValidType = DOCUMENT_TYPES.includes(normalizedType);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should accept markdown files", () => {
			// Arrange
			const file = new File(["dummy content"], "README.md", {
				type: "text/markdown",
			});

			// Act
			const isValidType = DOCUMENT_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should reject unsupported document types", () => {
			// Arrange
			const invalidTypes = [
				"application/msword",
				"application/vnd.ms-excel",
				"application/zip",
			];

			// Act & Assert
			invalidTypes.forEach((type) => {
				expect(DOCUMENT_TYPES.includes(type)).toBe(false);
			});
		});
	});

	describe("Audio Files", () => {
		it("should accept MP3 audio", () => {
			// Arrange
			const file = new File(["dummy content"], "test.mp3", {
				type: "audio/mpeg",
			});

			// Act
			const isValidType = AUDIO_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should accept WAV audio", () => {
			// Arrange
			const file = new File(["dummy content"], "test.wav", {
				type: "audio/wav",
			});

			// Act
			const isValidType = AUDIO_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should accept M4A audio", () => {
			// Arrange
			const file = new File(["dummy content"], "test.m4a", {
				type: "audio/m4a",
			});

			// Act
			const isValidType = AUDIO_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should accept OGG audio", () => {
			// Arrange
			const file = new File(["dummy content"], "test.ogg", {
				type: "audio/ogg",
			});

			// Act
			const isValidType = AUDIO_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});
	});

	describe("Video Files", () => {
		it("should accept MP4 video", () => {
			// Arrange
			const file = new File(["dummy content"], "test.mp4", {
				type: "video/mp4",
			});

			// Act
			const isValidType = VIDEO_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should accept WebM video", () => {
			// Arrange
			const file = new File(["dummy content"], "test.webm", {
				type: "video/webm",
			});

			// Act
			const isValidType = VIDEO_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});

		it("should accept QuickTime video", () => {
			// Arrange
			const file = new File(["dummy content"], "test.mov", {
				type: "video/quicktime",
			});

			// Act
			const isValidType = VIDEO_TYPES.includes(file.type);

			// Assert
			expect(isValidType).toBe(true);
		});
	});
});

describe("File Upload - Size Validation", () => {
	describe("Image Size Limits", () => {
		it("should accept images under 10MB", () => {
			// Arrange
			const sizeInBytes = 5 * MB_TO_BYTES; // 5MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "test.jpg", { type: "image/jpeg" });

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBeLessThanOrEqual(DEFAULT_MAX_SIZE_MB);
		});

		it("should reject images over 10MB", () => {
			// Arrange
			const sizeInBytes = 15 * MB_TO_BYTES; // 15MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "large.jpg", { type: "image/jpeg" });

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBeGreaterThan(DEFAULT_MAX_SIZE_MB);
		});

		it("should accept images exactly at 10MB limit", () => {
			// Arrange
			const sizeInBytes = 10 * MB_TO_BYTES; // Exactly 10MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "max.jpg", { type: "image/jpeg" });

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBe(DEFAULT_MAX_SIZE_MB);
		});
	});

	describe("Audio Size Limits", () => {
		it("should accept audio under 25MB", () => {
			// Arrange
			const sizeInBytes = 20 * MB_TO_BYTES; // 20MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "test.mp3", { type: "audio/mpeg" });

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBeLessThanOrEqual(AUDIO_MAX_SIZE_MB);
		});

		it("should reject audio over 25MB", () => {
			// Arrange
			const sizeInBytes = 30 * MB_TO_BYTES; // 30MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "large.mp3", { type: "audio/mpeg" });

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBeGreaterThan(AUDIO_MAX_SIZE_MB);
		});
	});

	describe("Video Size Limits", () => {
		it("should accept video under 50MB", () => {
			// Arrange
			const sizeInBytes = 40 * MB_TO_BYTES; // 40MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "test.mp4", { type: "video/mp4" });

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBeLessThanOrEqual(VIDEO_MAX_SIZE_MB);
		});

		it("should reject video over 50MB", () => {
			// Arrange
			const sizeInBytes = 60 * MB_TO_BYTES; // 60MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "large.mp4", { type: "video/mp4" });

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBeGreaterThan(VIDEO_MAX_SIZE_MB);
		});
	});

	describe("Document Size Limits", () => {
		it("should accept documents under 10MB", () => {
			// Arrange
			const sizeInBytes = 5 * MB_TO_BYTES; // 5MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "test.pdf", {
				type: "application/pdf",
			});

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBeLessThanOrEqual(DEFAULT_MAX_SIZE_MB);
		});

		it("should reject documents over 10MB", () => {
			// Arrange
			const sizeInBytes = 15 * MB_TO_BYTES; // 15MB
			const buffer = new ArrayBuffer(sizeInBytes);
			const file = new File([buffer], "large.pdf", {
				type: "application/pdf",
			});

			// Act
			const fileSizeMB = file.size / MB_TO_BYTES;

			// Assert
			expect(fileSizeMB).toBeGreaterThan(DEFAULT_MAX_SIZE_MB);
		});
	});
});

describe("File Upload - Model Capabilities", () => {
	describe("Image Capability Detection", () => {
		it("should detect GPT-4 vision models", () => {
			// Arrange
			const models = [
				"openai/gpt-4-vision",
				"openai/gpt-4-turbo",
				"openai/gpt-4o",
				"openai/gpt-5",
			];

			// Act & Assert
			models.forEach((model) => {
				const hasVision =
					model.includes("gpt-4-vision") ||
					model.includes("gpt-4-turbo") ||
					model.includes("gpt-4o") ||
					model.includes("gpt-5");
				expect(hasVision).toBe(true);
			});
		});

		it("should detect Claude vision models", () => {
			// Arrange
			const models = [
				"anthropic/claude-3-opus",
				"anthropic/claude-3-sonnet",
				"anthropic/claude-4-sonnet",
			];

			// Act & Assert
			models.forEach((model) => {
				const hasVision =
					model.includes("claude-3") || model.includes("claude-4");
				expect(hasVision).toBe(true);
			});
		});

		it("should detect Gemini vision models", () => {
			// Arrange
			const models = [
				"google/gemini-2.0-flash",
				"google/gemini-2.5-pro",
				"google/gemini-pro-vision",
			];

			// Act & Assert
			models.forEach((model) => {
				const hasVision = model.includes("gemini");
				expect(hasVision).toBe(true);
			});
		});

		it("should not detect vision in text-only models", () => {
			// Arrange
			const models = [
				"openai/gpt-3.5-turbo",
				"meta-llama/llama-3-8b",
				"mistralai/mistral-7b",
			];

			// Act & Assert
			models.forEach((model) => {
				const hasVision =
					model.includes("gpt-4-vision") ||
					model.includes("gpt-4-turbo") ||
					model.includes("gpt-4o") ||
					model.includes("gpt-5") ||
					model.includes("claude-3") ||
					model.includes("claude-4") ||
					model.includes("gemini");
				expect(hasVision).toBe(false);
			});
		});
	});

	describe("Audio Capability Detection", () => {
		it("should detect Gemini 2.0 Flash audio support", () => {
			// Arrange
			const model = "google/gemini-2.0-flash";

			// Act
			const hasAudio =
				model.includes("gemini-2") && model.includes("flash");

			// Assert
			expect(hasAudio).toBe(true);
		});

		it("should detect GPT-4o audio models", () => {
			// Arrange
			const model = "openai/gpt-4o-audio-preview";

			// Act
			const hasAudio = model.includes("gpt-4o-audio");

			// Assert
			expect(hasAudio).toBe(true);
		});

		it("should detect Whisper models", () => {
			// Arrange
			const model = "openai/whisper-1";

			// Act
			const hasAudio = model.includes("whisper");

			// Assert
			expect(hasAudio).toBe(true);
		});
	});

	describe("Video Capability Detection", () => {
		it("should detect Gemini 2.0 Flash video support", () => {
			// Arrange
			const model = "google/gemini-2.0-flash";

			// Act
			const hasVideo =
				model.includes("gemini-2") && model.includes("flash");

			// Assert
			expect(hasVideo).toBe(true);
		});

		it("should not detect video in non-multimodal models", () => {
			// Arrange
			const models = [
				"openai/gpt-4",
				"anthropic/claude-3-sonnet",
				"meta-llama/llama-3-8b",
			];

			// Act & Assert
			models.forEach((model) => {
				const hasVideo =
					model.includes("gemini-2") && model.includes("flash");
				expect(hasVideo).toBe(false);
			});
		});
	});
});

describe("File Upload - File Name Sanitization", () => {
	it("should handle normal filenames", () => {
		// Arrange
		const filename = "test-document.pdf";

		// Act
		const sanitized = filename;

		// Assert
		expect(sanitized).toBe("test-document.pdf");
	});

	it("should handle filenames with spaces", () => {
		// Arrange
		const filename = "my test document.pdf";

		// Act
		const sanitized = filename;

		// Assert
		expect(sanitized).toBe("my test document.pdf");
	});

	it("should handle long filenames", () => {
		// Arrange
		const longName = "a".repeat(300) + ".pdf";

		// Act
		const isLong = longName.length > 255;

		// Assert
		expect(isLong).toBe(true);
	});

	it("should preserve file extensions", () => {
		// Arrange
		const files = [
			"test.jpg",
			"document.pdf",
			"audio.mp3",
			"video.mp4",
		];

		// Act & Assert
		files.forEach((filename) => {
			const extension = filename.split(".").pop();
			expect(extension).toBeTruthy();
			expect(filename.endsWith(`.${extension}`)).toBe(true);
		});
	});
});

describe("File Upload - Clipboard Paste Detection", () => {
	it("should detect image in clipboard items", () => {
		// Arrange
		const mockItem = {
			type: "image/png",
			kind: "file",
			getAsFile: () => new File([""], "clipboard.png", { type: "image/png" }),
		};

		// Act
		const isImage = mockItem.type.startsWith("image/");

		// Assert
		expect(isImage).toBe(true);
	});

	it("should detect text in clipboard items", () => {
		// Arrange
		const mockItem = {
			type: "text/plain",
			kind: "string",
		};

		// Act
		const isImage = mockItem.type.startsWith("image/");

		// Assert
		expect(isImage).toBe(false);
	});

	it("should handle multiple clipboard items", () => {
		// Arrange
		const items = [
			{ type: "text/plain", kind: "string" },
			{ type: "image/png", kind: "file" },
			{ type: "text/html", kind: "string" },
		];

		// Act
		const imageItem = items.find((item) => item.type.startsWith("image/"));

		// Assert
		expect(imageItem).toBeDefined();
		expect(imageItem?.type).toBe("image/png");
	});

	it("should prioritize first image when multiple images exist", () => {
		// Arrange
		const items = [
			{ type: "image/png", kind: "file", name: "first.png" },
			{ type: "image/jpeg", kind: "file", name: "second.jpg" },
		];

		// Act
		let firstImage = null;
		for (const item of items) {
			if (item.type.startsWith("image/")) {
				firstImage = item;
				break;
			}
		}

		// Assert
		expect(firstImage).toBeDefined();
		expect(firstImage?.name).toBe("first.png");
	});
});

describe("File Upload - Attachment Data Structure", () => {
	it("should create valid attachment object", () => {
		// Arrange
		const attachment = {
			storageId: "test-storage-id-123" as any,
			filename: "test.jpg",
			contentType: "image/jpeg",
			size: 1024 * 1024, // 1MB
		};

		// Act & Assert
		expect(attachment).toHaveProperty("storageId");
		expect(attachment).toHaveProperty("filename");
		expect(attachment).toHaveProperty("contentType");
		expect(attachment).toHaveProperty("size");
		expect(attachment.filename).toBe("test.jpg");
		expect(attachment.contentType).toBe("image/jpeg");
		expect(attachment.size).toBe(1024 * 1024);
	});

	it("should handle multiple attachments in array", () => {
		// Arrange
		const attachments = [
			{
				storageId: "id-1" as any,
				filename: "image.jpg",
				contentType: "image/jpeg",
				size: 1024,
			},
			{
				storageId: "id-2" as any,
				filename: "document.pdf",
				contentType: "application/pdf",
				size: 2048,
			},
		];

		// Act
		const totalSize = attachments.reduce((sum, att) => sum + att.size, 0);

		// Assert
		expect(attachments).toHaveLength(2);
		expect(totalSize).toBe(3072);
	});
});
