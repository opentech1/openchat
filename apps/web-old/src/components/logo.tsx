import { cn } from '@/lib/utils'
import Image from 'next/image'

// Use the logo.png image
const LogoIconImage = ({ className, priority }: { className?: string; priority?: boolean }) => (
	<Image
		src="/logo.png"
		alt="OpenChat logo"
		width={24}
		height={24}
		className={className}
		priority={priority}
	/>
)

// Plain SVG version of "OpenChat" without effects
export const LogoTextSvg = ({ className }: { className?: string }) => (
	<svg
		viewBox="0 0 130 24"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		className={className}
		aria-label="OpenChat"
	>
		<text
			x="0"
			y="18"
			fontFamily="monospace"
			fontSize="20"
			fontWeight="700"
			fill="currentColor"
		>
			OpenChat
		</text>
	</svg>
)

// Plain Logo component without effects (for general use)
export const Logo = ({
	className,
	size = 'default',
	priority = false,
}: {
	className?: string;
	size?: 'small' | 'default' | 'large';
	priority?: boolean;
}) => {
	const sizeClasses = {
		small: { container: 'gap-1.5', logo: 'size-5', text: 'text-base' },
		default: { container: 'gap-2', logo: 'size-6', text: 'text-lg' },
		large: { container: 'gap-3', logo: 'size-8', text: 'text-2xl' },
	}

	const sizes = sizeClasses[size]

	return (
		<span className={cn('inline-flex items-center font-semibold tracking-tight', sizes.container, className)}>
			<LogoIconImage className={cn(sizes.logo)} priority={priority} />
			<span className={cn('font-sans font-bold', sizes.text)}>
				<span className="text-foreground">Open</span>
				<span className="text-primary">Chat</span>
			</span>
		</span>
	)
}

// Icon-only version
export const LogoIcon = ({ className, priority = false }: { className?: string; priority?: boolean }) => (
	<LogoIconImage className={cn('size-6', className)} priority={priority} />
)
