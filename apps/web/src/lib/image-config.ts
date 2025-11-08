/**
 * Image Optimization Configuration
 *
 * Best practices and guidelines for using Next.js Image component
 * to ensure optimal loading performance.
 *
 * NEXT.JS IMAGE FEATURES:
 * - Automatic lazy loading
 * - Responsive image srcsets
 * - WebP/AVIF conversion (when browser supports)
 * - Prevents Cumulative Layout Shift (CLS)
 * - On-demand optimization (no build-time overhead)
 *
 * PERFORMANCE TIPS:
 * - Always specify width and height to prevent CLS
 * - Use priority for above-the-fold images
 * - Choose appropriate sizes for responsive images
 * - Use fill for background images or unknown dimensions
 * - Optimize source images before uploading (compress, resize)
 */

/**
 * Standard image sizes for common use cases
 *
 * These correspond to typical breakpoints and use cases.
 * Use these as a guide when specifying the `sizes` prop.
 */
export const IMAGE_SIZES = {
	/** Thumbnail images (avatars, icons) */
	THUMBNAIL: {
		width: 64,
		height: 64,
		sizes: "64px",
	},

	/** Small images (profile pictures, small cards) */
	SMALL: {
		width: 128,
		height: 128,
		sizes: "128px",
	},

	/** Medium images (cards, previews) */
	MEDIUM: {
		width: 256,
		height: 256,
		sizes: "256px",
	},

	/** Large images (hero images, featured content) */
	LARGE: {
		width: 512,
		height: 512,
		sizes: "512px",
	},

	/** Full width images (banners, headers) */
	FULL_WIDTH: {
		width: 1920,
		height: 1080,
		sizes: "100vw",
	},

	/** Content images (responsive to container) */
	CONTENT: {
		width: 768,
		height: 432,
		sizes: "(max-width: 768px) 100vw, 768px",
	},

	/** Responsive card images */
	CARD: {
		width: 400,
		height: 300,
		sizes: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px",
	},
} as const;

/**
 * Image quality settings
 *
 * Next.js default is 75, which provides good balance.
 * Adjust based on your needs:
 * - 75-80: Good quality, smaller files (recommended)
 * - 80-90: High quality, larger files
 * - 90-100: Maximum quality, much larger files
 */
export const IMAGE_QUALITY = {
	/** Low quality for previews/placeholders */
	LOW: 50,
	/** Medium quality for standard images */
	MEDIUM: 75,
	/** High quality for important images */
	HIGH: 85,
	/** Maximum quality (rarely needed) */
	MAX: 95,
} as const;

/**
 * Image formats supported by Next.js
 */
export type ImageFormat = "image/webp" | "image/avif" | "image/png" | "image/jpeg";

/**
 * Recommended image formats by use case
 */
export const RECOMMENDED_FORMATS = {
	/** Photos and complex images */
	PHOTO: ["image/avif", "image/webp", "image/jpeg"] as ImageFormat[],

	/** Graphics with transparency */
	GRAPHIC: ["image/avif", "image/webp", "image/png"] as ImageFormat[],

	/** Icons and simple graphics */
	ICON: ["image/webp", "image/png"] as ImageFormat[],
} as const;

/**
 * Image loading strategies
 */
export const IMAGE_LOADING = {
	/** Lazy load (default) - images load as they enter viewport */
	LAZY: "lazy" as const,

	/** Eager load - images load immediately */
	EAGER: "eager" as const,
} as const;

/**
 * When to use priority loading
 *
 * Set priority={true} on Image component for:
 * - Hero images above the fold
 * - Logo in header
 * - First visible image on page
 *
 * DO NOT use priority for:
 * - Below-the-fold images
 * - Images in carousels (except first)
 * - Background images
 * - Decorative images
 */
export const PRIORITY_GUIDELINES = {
	USE_PRIORITY: [
		"Hero images",
		"Logo in header",
		"First content image",
		"LCP (Largest Contentful Paint) candidates",
	],
	AVOID_PRIORITY: [
		"Below-the-fold images",
		"Carousel images (except first)",
		"Background images",
		"Decorative images",
		"Images in tabs/accordions",
	],
} as const;

/**
 * Example usage for common scenarios
 */
export const USAGE_EXAMPLES = {
	/** Avatar/profile picture */
	AVATAR: `
<Image
  src="/avatars/user.jpg"
  alt="User avatar"
  width={64}
  height={64}
  className="rounded-full"
  sizes="64px"
/>`,

	/** Hero image (above the fold) */
	HERO: `
<Image
  src="/hero.jpg"
  alt="Hero image"
  width={1920}
  height={1080}
  priority
  sizes="100vw"
  className="w-full h-auto"
/>`,

	/** Responsive card image */
	CARD: `
<Image
  src="/card-image.jpg"
  alt="Card image"
  width={400}
  height={300}
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
  className="object-cover"
/>`,

	/** Background image with fill */
	BACKGROUND: `
<div className="relative w-full h-64">
  <Image
    src="/background.jpg"
    alt="Background"
    fill
    sizes="100vw"
    className="object-cover"
  />
</div>`,

	/** Product image with blur placeholder */
	PRODUCT: `
<Image
  src="/product.jpg"
  alt="Product name"
  width={512}
  height={512}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,..."
  sizes="(max-width: 768px) 100vw, 512px"
/>`,
} as const;

/**
 * Image optimization checklist
 */
export const OPTIMIZATION_CHECKLIST = [
	"✓ Always specify width and height (or use fill)",
	"✓ Use priority for above-the-fold images",
	"✓ Specify sizes prop for responsive images",
	"✓ Use descriptive alt text for accessibility",
	"✓ Choose appropriate quality setting (default 75 is good)",
	"✓ Compress source images before uploading",
	"✓ Use WebP/AVIF when possible (Next.js handles this)",
	'✓ Add loading="lazy" for below-the-fold images (default)',
	'✓ Use placeholder="blur" for better UX (requires blurDataURL)',
	"✓ Test on slow connections to verify performance",
] as const;

/**
 * Common mistakes to avoid
 */
export const COMMON_MISTAKES = [
	"✗ Not specifying width/height (causes layout shift)",
	"✗ Using priority on too many images (defeats the purpose)",
	"✗ Not optimizing source images (Next.js can't fix poor sources)",
	"✗ Using wrong aspect ratios (causes distortion)",
	"✗ Forgetting alt text (bad for accessibility and SEO)",
	"✗ Loading huge images on mobile (use responsive sizes)",
	"✗ Using Image for decorative SVGs (use <img> instead)",
	"✗ Not testing on slow connections",
] as const;

/**
 * Performance metrics to monitor
 */
export const PERFORMANCE_METRICS = {
	/** Largest Contentful Paint - should be < 2.5s */
	LCP: "Target: < 2.5s",

	/** Cumulative Layout Shift - should be < 0.1 */
	CLS: "Target: < 0.1",

	/** First Contentful Paint - should be < 1.8s */
	FCP: "Target: < 1.8s",

	/** Time to Interactive - should be < 3.8s */
	TTI: "Target: < 3.8s",
} as const;

/**
 * Helper function to generate blur data URL for placeholder
 *
 * Use this to create a tiny blurred version of the image for
 * the blur placeholder effect.
 *
 * @param width - Width of the placeholder (typically 10-20px)
 * @param height - Height of the placeholder (typically 10-20px)
 * @param color - Dominant color of the image as hex
 * @returns Base64 encoded blur data URL
 *
 * @example
 * ```typescript
 * const blurDataURL = generateBlurDataURL(10, 10, "#3b82f6");
 * ```
 */
export function generateBlurDataURL(width: number, height: number, color: string): string {
	// Create a simple SVG with the dominant color
	const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="${color}"/>
    </svg>
  `;

	// Convert to base64
	const base64 = Buffer.from(svg).toString("base64");

	return `data:image/svg+xml;base64,${base64}`;
}

/**
 * Helper function to calculate aspect ratio
 *
 * @param width - Image width
 * @param height - Image height
 * @returns Aspect ratio as string (e.g., "16/9")
 */
export function calculateAspectRatio(width: number, height: number): string {
	const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
	const divisor = gcd(width, height);
	return `${width / divisor}/${height / divisor}`;
}
