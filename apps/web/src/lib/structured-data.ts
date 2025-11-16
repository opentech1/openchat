/**
 * JSON-LD Structured Data utilities for SEO
 * Generates schema.org compliant structured data for search engines
 */

import type { WithContext, WebSite, SoftwareApplication, Organization } from "schema-dts";

interface StructuredDataConfig {
	siteUrl: string;
	siteName?: string;
	description?: string;
}

/**
 * Generates WebSite schema with search action
 * Helps search engines understand the site structure and enables sitelinks search box
 */
export function generateWebSiteSchema(config: StructuredDataConfig): WithContext<WebSite> {
	const { siteUrl, siteName = "OpenChat", description = "Fast AI Chat" } = config;

	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: siteName,
		url: siteUrl,
		description,
		inLanguage: "en-US",
	};
}

/**
 * Generates Organization schema
 * Provides information about the organization behind the website
 */
export function generateOrganizationSchema(config: StructuredDataConfig): WithContext<Organization> {
	const { siteUrl, siteName = "OpenChat" } = config;

	return {
		"@context": "https://schema.org",
		"@type": "Organization",
		name: siteName,
		url: siteUrl,
		logo: `${siteUrl}/og-image.png`,
		sameAs: [
			// Add social media profiles here when available
			// "https://twitter.com/openchat",
			// "https://github.com/openchat-org/openchat",
		],
	};
}

/**
 * Generates SoftwareApplication schema
 * Describes the web application for better search engine understanding
 */
export function generateSoftwareApplicationSchema(
	config: StructuredDataConfig,
): WithContext<SoftwareApplication> {
	const {
		siteUrl,
		siteName = "OpenChat",
		description = "Fast, open source AI chat with 100+ models. ChatGPT alternative with GPT-4, Claude, Gemini & more. Free, customizable, self-hostable.",
	} = config;

	return {
		"@context": "https://schema.org",
		"@type": "SoftwareApplication",
		name: siteName,
		applicationCategory: "CommunicationApplication",
		operatingSystem: "Web",
		description,
		url: siteUrl,
		offers: {
			"@type": "Offer",
			price: "0",
			priceCurrency: "USD",
			availability: "https://schema.org/InStock",
		},
		permissions: "No special permissions required",
		softwareVersion: "1.0",
		screenshot: `${siteUrl}/og-image.png`,
	};
}

/**
 * Combines multiple schemas into a single JSON-LD graph
 * This is more efficient than multiple separate script tags
 */
export function generateCombinedStructuredData(config: StructuredDataConfig) {
	return {
		"@context": "https://schema.org",
		"@graph": [
			generateWebSiteSchema(config),
			generateOrganizationSchema(config),
			generateSoftwareApplicationSchema(config),
		],
	};
}

/**
 * Utility to safely stringify structured data for script tags
 * Escapes special characters to prevent XSS and ensure valid HTML
 */
export function stringifyStructuredData(data: object): string {
	return JSON.stringify(data)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026");
}
