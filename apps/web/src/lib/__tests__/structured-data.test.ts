import { describe, it, expect } from "vitest";
import {
	generateWebSiteSchema,
	generateOrganizationSchema,
	generateSoftwareApplicationSchema,
	generateCombinedStructuredData,
	stringifyStructuredData,
} from "../structured-data";

describe("Structured Data", () => {
	const mockConfig = {
		siteUrl: "https://example.com",
		siteName: "OpenChat",
		description: "Fast AI Chat",
	};

	describe("generateWebSiteSchema", () => {
		it("should generate valid WebSite schema", () => {
			const schema = generateWebSiteSchema(mockConfig);

			expect(schema["@context"]).toBe("https://schema.org");
			expect(schema["@type"]).toBe("WebSite");
			expect(schema.name).toBe("OpenChat");
			expect(schema.url).toBe("https://example.com");
			expect(schema.description).toBe("Fast AI Chat");
			expect(schema.potentialAction).toBeDefined();
			expect(schema.potentialAction?.["@type"]).toBe("SearchAction");
			expect(schema.inLanguage).toBe("en-US");
		});

		it("should use default values when not provided", () => {
			const schema = generateWebSiteSchema({ siteUrl: "https://example.com" });

			expect(schema.name).toBe("OpenChat");
			expect(schema.description).toBe("Fast AI Chat");
		});
	});

	describe("generateOrganizationSchema", () => {
		it("should generate valid Organization schema", () => {
			const schema = generateOrganizationSchema(mockConfig);

			expect(schema["@context"]).toBe("https://schema.org");
			expect(schema["@type"]).toBe("Organization");
			expect(schema.name).toBe("OpenChat");
			expect(schema.url).toBe("https://example.com");
			expect(schema.logo).toBe("https://example.com/og-image.png");
			expect(schema.sameAs).toBeDefined();
			expect(Array.isArray(schema.sameAs)).toBe(true);
		});
	});

	describe("generateSoftwareApplicationSchema", () => {
		it("should generate valid SoftwareApplication schema", () => {
			const schema = generateSoftwareApplicationSchema(mockConfig);

			expect(schema["@context"]).toBe("https://schema.org");
			expect(schema["@type"]).toBe("SoftwareApplication");
			expect(schema.name).toBe("OpenChat");
			expect(schema.applicationCategory).toBe("CommunicationApplication");
			expect(schema.operatingSystem).toBe("Web");
			expect(schema.url).toBe("https://example.com");
			expect(schema.offers).toBeDefined();
			expect(schema.offers?.["@type"]).toBe("Offer");
			expect(schema.offers?.price).toBe("0");
			expect(schema.offers?.priceCurrency).toBe("USD");
		});

		it("should include aggregate rating", () => {
			const schema = generateSoftwareApplicationSchema(mockConfig);

			expect(schema.aggregateRating).toBeDefined();
			expect(schema.aggregateRating?.["@type"]).toBe("AggregateRating");
			expect(schema.aggregateRating?.ratingValue).toBe("4.8");
			expect(schema.aggregateRating?.bestRating).toBe("5");
		});
	});

	describe("generateCombinedStructuredData", () => {
		it("should generate combined schema with @graph", () => {
			const combined = generateCombinedStructuredData(mockConfig);

			expect(combined["@context"]).toBe("https://schema.org");
			expect(combined["@graph"]).toBeDefined();
			expect(Array.isArray(combined["@graph"])).toBe(true);
			expect(combined["@graph"].length).toBe(3);
		});

		it("should include all schema types in graph", () => {
			const combined = generateCombinedStructuredData(mockConfig);
			const types = combined["@graph"].map((item) => item["@type"]);

			expect(types).toContain("WebSite");
			expect(types).toContain("Organization");
			expect(types).toContain("SoftwareApplication");
		});
	});

	describe("stringifyStructuredData", () => {
		it("should escape special characters", () => {
			const data = {
				test: "<script>&</script>",
			};

			const result = stringifyStructuredData(data);

			expect(result).toContain("\\u003c");
			expect(result).toContain("\\u003e");
			expect(result).toContain("\\u0026");
			expect(result).not.toContain("<");
			expect(result).not.toContain(">");
		});

		it("should produce valid JSON string", () => {
			const data = generateCombinedStructuredData(mockConfig);
			const result = stringifyStructuredData(data);

			// Should be parseable
			expect(() => JSON.parse(result)).not.toThrow();
		});
	});
});
