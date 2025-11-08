/**
 * Unit Tests for Content-Type Validation
 *
 * Tests Content-Type header validation to prevent MIME confusion attacks.
 */

import { describe, it, expect } from "vitest";
import {
	validateContentType,
	createUnsupportedMediaTypeResponse,
	withContentTypeValidation,
	ALLOWED_CONTENT_TYPES,
} from "../content-type-validation";

describe("validateContentType", () => {
	describe("JSON Content-Type", () => {
		it("should accept application/json", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(true);
			expect(result.contentType).toBe("application/json");
		});

		it("should accept application/json with charset", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=utf-8",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(true);
			expect(result.contentType).toBe("application/json");
			expect(result.charset).toBe("utf-8");
		});

		it("should be case-insensitive", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "APPLICATION/JSON",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(true);
		});

		it("should trim whitespace", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "  application/json  ",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(true);
		});
	});

	describe("Multiple Content-Types", () => {
		it("should accept form-urlencoded when allowed", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "application/x-www-form-urlencoded",
				},
			});

			// Act
			const result = validateContentType(request, [
				ALLOWED_CONTENT_TYPES.FORM_URLENCODED,
			]);

			// Assert
			expect(result.valid).toBe(true);
			expect(result.contentType).toBe("application/x-www-form-urlencoded");
		});

		it("should accept multipart/form-data when allowed", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type":
						"multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW",
				},
			});

			// Act
			const result = validateContentType(request, [
				ALLOWED_CONTENT_TYPES.MULTIPART,
			]);

			// Assert
			expect(result.valid).toBe(true);
		});

		it("should accept text/plain when allowed", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "text/plain",
				},
			});

			// Act
			const result = validateContentType(request, [ALLOWED_CONTENT_TYPES.TEXT]);

			// Assert
			expect(result.valid).toBe(true);
			expect(result.contentType).toBe("text/plain");
		});

		it("should accept multiple allowed types", () => {
			// Arrange
			const allowedTypes = [
				ALLOWED_CONTENT_TYPES.JSON,
				ALLOWED_CONTENT_TYPES.FORM_URLENCODED,
			];

			const request1 = new Request("http://localhost:3000", {
				method: "POST",
				headers: { "content-type": "application/json" },
			});

			const request2 = new Request("http://localhost:3000", {
				method: "POST",
				headers: { "content-type": "application/x-www-form-urlencoded" },
			});

			// Act
			const result1 = validateContentType(request1, allowedTypes);
			const result2 = validateContentType(request2, allowedTypes);

			// Assert
			expect(result1.valid).toBe(true);
			expect(result2.valid).toBe(true);
		});
	});

	describe("Invalid Content-Types", () => {
		it("should reject missing Content-Type header", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(false);
			expect(result.reason).toBe("Missing Content-Type header");
		});

		it("should reject empty Content-Type", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(false);
			expect(result.reason).toBe("Missing Content-Type header");
		});

		it("should reject malformed Content-Type", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": ";;;",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(false);
			expect(result.reason).toBe("Invalid Content-Type format");
		});

		it("should reject non-allowed Content-Type", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "text/html",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(false);
			expect(result.contentType).toBe("text/html");
			expect(result.reason).toContain("not allowed");
		});

		it("should reject application/xml when not allowed", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "application/xml",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(false);
		});

		it("should reject image types", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "image/png",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(false);
		});
	});

	describe("Charset Parsing", () => {
		it("should parse charset parameter", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=iso-8859-1",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.valid).toBe(true);
			expect(result.charset).toBe("iso-8859-1");
		});

		it("should handle multiple parameters", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type":
						"multipart/form-data; boundary=abc123; charset=utf-8",
				},
			});

			// Act
			const result = validateContentType(request, [
				ALLOWED_CONTENT_TYPES.MULTIPART,
			]);

			// Assert
			expect(result.valid).toBe(true);
			expect(result.charset).toBe("utf-8");
		});

		it("should trim whitespace from charset", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "application/json; charset=  utf-8  ",
				},
			});

			// Act
			const result = validateContentType(request);

			// Assert
			expect(result.charset).toBe("utf-8");
		});
	});

	describe("Multipart Boundary", () => {
		it("should accept multipart with boundary", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type":
						"multipart/form-data; boundary=----WebKitFormBoundary",
				},
			});

			// Act
			const result = validateContentType(request, [
				ALLOWED_CONTENT_TYPES.MULTIPART,
			]);

			// Assert
			expect(result.valid).toBe(true);
		});

		it("should accept multipart without boundary", () => {
			// Arrange
			const request = new Request("http://localhost:3000", {
				method: "POST",
				headers: {
					"content-type": "multipart/form-data",
				},
			});

			// Act
			const result = validateContentType(request, [
				ALLOWED_CONTENT_TYPES.MULTIPART,
			]);

			// Assert
			expect(result.valid).toBe(true);
		});
	});
});

describe("createUnsupportedMediaTypeResponse", () => {
	it("should create 415 response", () => {
		// Arrange
		const validation = {
			valid: false,
			reason: "Invalid Content-Type",
		};

		// Act
		const response = createUnsupportedMediaTypeResponse(validation);

		// Assert
		expect(response.status).toBe(415);
		expect(response.headers.get("Content-Type")).toBe("application/json");
	});

	it("should include error details in body", async () => {
		// Arrange
		const validation = {
			valid: false,
			contentType: "text/html",
			reason: "Content-Type 'text/html' not allowed",
		};

		// Act
		const response = createUnsupportedMediaTypeResponse(validation);
		const body = await response.json();

		// Assert
		expect(body.error).toBe("Unsupported Media Type");
		expect(body.message).toBe("Content-Type 'text/html' not allowed");
	});

	it("should include allowed types in body", async () => {
		// Arrange
		const validation = {
			valid: false,
			reason: "Invalid",
		};
		const allowedTypes = [
			ALLOWED_CONTENT_TYPES.JSON,
			ALLOWED_CONTENT_TYPES.FORM_URLENCODED,
		];

		// Act
		const response = createUnsupportedMediaTypeResponse(
			validation,
			allowedTypes,
		);
		const body = await response.json();

		// Assert
		expect(body.allowedTypes).toEqual(allowedTypes);
	});

	it("should set Accept header", () => {
		// Arrange
		const validation = { valid: false, reason: "Invalid" };
		const allowedTypes = [
			ALLOWED_CONTENT_TYPES.JSON,
			ALLOWED_CONTENT_TYPES.TEXT,
		];

		// Act
		const response = createUnsupportedMediaTypeResponse(
			validation,
			allowedTypes,
		);

		// Assert
		expect(response.headers.get("Accept")).toBe(
			"application/json, text/plain",
		);
	});

	it("should use default allowed types", async () => {
		// Arrange
		const validation = { valid: false, reason: "Invalid" };

		// Act
		const response = createUnsupportedMediaTypeResponse(validation);
		const body = await response.json();

		// Assert
		expect(body.allowedTypes).toEqual([ALLOWED_CONTENT_TYPES.JSON]);
	});
});

describe("withContentTypeValidation", () => {
	it("should call handler for valid Content-Type", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
		});
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(200);
	});

	it("should return 415 for invalid Content-Type", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				"content-type": "text/html",
			},
		});
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(415);
	});

	it("should skip validation for GET requests", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "GET",
		});
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(200);
	});

	it("should validate POST requests", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "POST",
		});
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(415);
	});

	it("should validate PUT requests", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "PUT",
			headers: {
				"content-type": "application/json",
			},
		});
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(200);
	});

	it("should validate PATCH requests", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "PATCH",
			headers: {
				"content-type": "application/json",
			},
		});
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(200);
	});

	it("should skip validation for DELETE requests", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "DELETE",
		});
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(200);
	});

	it("should skip validation for HEAD requests", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "HEAD",
		});
		const handler = async () => new Response(null, { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(200);
	});

	it("should skip validation for OPTIONS requests", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "OPTIONS",
		});
		const handler = async () => new Response(null, { status: 204 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);

		// Assert
		expect(response.status).toBe(204);
	});

	it("should return error body from validation failure", async () => {
		// Arrange
		const request = new Request("http://localhost:3000", {
			method: "POST",
			headers: {
				"content-type": "text/html",
			},
		});
		const handler = async () =>
			new Response(JSON.stringify({ success: true }), { status: 200 });

		// Act
		const response = await withContentTypeValidation(
			request,
			[ALLOWED_CONTENT_TYPES.JSON],
			handler,
		);
		const body = await response.json();

		// Assert
		expect(body.error).toBe("Unsupported Media Type");
	});
});
