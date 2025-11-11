import { cn } from '@/lib/utils'
import Image from 'next/image'

// Use the logo.png image
const LogoIconImage = ({ className }: { className?: string }) => (
	<Image
		src="/logo.png"
		alt="osschat logo"
		width={24}
		height={24}
		className={className}
		priority
	/>
)

// Plain SVG version of "osschat" without effects
export const LogoTextSvg = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 120 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className={className}
		aria-label="osschat"
	>
		<text
			x="0"
			y="18"
			fontFamily="monospace"
			fontSize="20"
			fontWeight="700"
			fill="currentColor"
		>
			osschat
		</text>
	</svg>
)

// Plain Logo component without effects (for general use)
export const Logo = ({
	className,
	size = 'default',
}: {
	className?: string;
	size?: 'small' | 'default' | 'large';
}) => {
	const sizeClasses = {
		small: { container: 'gap-1.5', logo: 'size-5', text: 'text-base' },
		default: { container: 'gap-2', logo: 'size-6', text: 'text-lg' },
		large: { container: 'gap-3', logo: 'size-8', text: 'text-2xl' },
	}

	const sizes = sizeClasses[size]

	return (
		<span className={cn('inline-flex items-center font-semibold tracking-tight', sizes.container, className)}>
			<LogoIconImage className={cn(sizes.logo)} />
			<span className={cn('font-mono font-bold', sizes.text)}>
				<span className="text-foreground">oss</span>
				<span className="text-foreground">chat</span>
			</span>
		</span>
	)
}

// Icon-only version
export const LogoIcon = ({ className }: { className?: string }) => (
	<LogoIconImage className={cn('size-6', className)} />
)
