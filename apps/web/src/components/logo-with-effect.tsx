'use client'

import { cn } from '@/lib/utils';
import Image from 'next/image';

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

export const LogoWithEffect = ({
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
	);
};
