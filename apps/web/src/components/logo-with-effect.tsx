'use client'

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface FocusRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const LogoIconImage = ({ className, priority }: { className?: string; priority?: boolean }) => (
	<Image
		src="/logo.png"
		alt="osschat logo"
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
	const words = ['oss', 'chat'];
	const [currentIndex, setCurrentIndex] = useState<number>(0);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
	const [focusRect, setFocusRect] = useState<FocusRect>({ x: 0, y: 0, width: 0, height: 0 });

	const sizeClasses = {
		small: { container: 'gap-1.5', logo: 'size-5', text: 'text-base' },
		default: { container: 'gap-2', logo: 'size-6', text: 'text-lg' },
		large: { container: 'gap-3', logo: 'size-8', text: 'text-2xl' },
	}

	const sizes = sizeClasses[size]

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentIndex(prev => (prev + 1) % words.length);
		}, 3000); // 2s animation + 1s pause

		return () => clearInterval(interval);
	}, [words.length]);

	useEffect(() => {
		if (currentIndex === null || currentIndex === -1) return;
		if (!wordRefs.current[currentIndex] || !containerRef.current) return;

		const parentRect = containerRef.current.getBoundingClientRect();
		const activeRect = wordRefs.current[currentIndex]!.getBoundingClientRect();

		setFocusRect({
			x: activeRect.left - parentRect.left,
			y: activeRect.top - parentRect.top,
			width: activeRect.width,
			height: activeRect.height
		});
	}, [currentIndex, words.length]);

	return (
		<span className={cn('inline-flex items-center font-semibold tracking-tight', sizes.container, className)}>
			<LogoIconImage className={cn(sizes.logo)} priority={priority} />
			<div className="relative flex gap-0 items-center" ref={containerRef}>
				{words.map((word, index) => {
					const isActive = index === currentIndex;
					return (
						<span
							key={index}
							ref={el => {
								wordRefs.current[index] = el;
							}}
							className={cn('relative font-mono font-bold cursor-default', sizes.text)}
							style={{
								filter: isActive ? `blur(0px)` : `blur(2px)`,
								transition: `filter 0.5s ease`
							}}
						>
							{word}
						</span>
					);
				})}

				<motion.div
					className="absolute top-0 left-0 pointer-events-none box-border border-0"
					animate={{
						x: focusRect.x,
						y: focusRect.y,
						width: focusRect.width,
						height: focusRect.height,
						opacity: currentIndex >= 0 ? 1 : 0
					}}
					transition={{
						duration: 0.5
					}}
					style={{
						'--border-color': 'white',
						'--glow-color': 'rgba(255, 255, 255, 0.6)'
					} as React.CSSProperties}
				>
					<span
						className="absolute w-2 h-2 border-[2px] rounded-[2px] top-[-6px] left-[-6px] border-r-0 border-b-0"
						style={{
							borderColor: 'var(--border-color)',
							filter: 'drop-shadow(0 0 2px var(--border-color))'
						}}
					></span>
					<span
						className="absolute w-2 h-2 border-[2px] rounded-[2px] top-[-6px] right-[-6px] border-l-0 border-b-0"
						style={{
							borderColor: 'var(--border-color)',
							filter: 'drop-shadow(0 0 2px var(--border-color))'
						}}
					></span>
					<span
						className="absolute w-2 h-2 border-[2px] rounded-[2px] bottom-[-6px] left-[-6px] border-r-0 border-t-0"
						style={{
							borderColor: 'var(--border-color)',
							filter: 'drop-shadow(0 0 2px var(--border-color))'
						}}
					></span>
					<span
						className="absolute w-2 h-2 border-[2px] rounded-[2px] bottom-[-6px] right-[-6px] border-l-0 border-t-0"
						style={{
							borderColor: 'var(--border-color)',
							filter: 'drop-shadow(0 0 2px var(--border-color))'
						}}
					></span>
				</motion.div>
			</div>
		</span>
	);
};
