"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { borderRadius } from "@/styles/design-tokens";

type UseAutoResizeTextareaProps = {
	minHeight: number;
	maxHeight?: number;
};

// Debounce utility function
function debounce<T extends (...args: any[]) => void>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout> | null = null;
	return (...args: Parameters<T>) => {
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

/**
 * Hook for auto-resizing textarea
 * Adjusts textarea height based on content while respecting min/max constraints
 */
export function useAutoResizeTextarea({
	minHeight,
	maxHeight,
}: UseAutoResizeTextareaProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const adjustHeight = useCallback(
		(reset?: boolean) => {
			const textarea = textareaRef.current;
			if (!textarea) return;

			if (reset) {
				textarea.style.height = `${minHeight}px`;
				return;
			}

			// Set height to 'auto' temporarily to get accurate scrollHeight without visual flash
			textarea.style.height = "auto";
			const newHeight = Math.max(
				minHeight,
				Math.min(
					textarea.scrollHeight,
					maxHeight ?? Number.POSITIVE_INFINITY,
				),
			);

			textarea.style.height = `${newHeight}px`;
		},
		[minHeight, maxHeight],
	);

	// Debounced version of adjustHeight for onChange events
	const debouncedAdjustHeight = useCallback(
		debounce(() => adjustHeight(), 50),
		[adjustHeight],
	);

	useEffect(() => {
		const textarea = textareaRef.current;
		if (textarea) {
			textarea.style.height = `${minHeight}px`;
		}
	}, [minHeight]);

	useEffect(() => {
		const handleResize = () => adjustHeight();
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, [adjustHeight]);

	return { textareaRef, adjustHeight, debouncedAdjustHeight };
}

type AutoResizeTextareaProps =
	React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
		containerClassName?: string;
		showRing?: boolean;
		minHeight?: number;
		maxHeight?: number;
	};

/**
 * AutoResizeTextarea Component
 * A textarea that automatically adjusts its height based on content
 * with optional focus ring animation
 */
export const AutoResizeTextarea = React.forwardRef<
	HTMLTextAreaElement,
	AutoResizeTextareaProps
>(
	(
		{
			className,
			containerClassName,
			showRing = false,
			minHeight = 80,
			maxHeight,
			onChange,
			...props
		},
		ref,
	) => {
		const [isFocused, setIsFocused] = useState(false);
		const prefersReducedMotion = useReducedMotion();
		const fast = prefersReducedMotion ? 0 : 0.3;

		const { textareaRef, debouncedAdjustHeight } = useAutoResizeTextarea({
			minHeight,
			maxHeight,
		});

		// Merge refs
		React.useImperativeHandle(ref, () => textareaRef.current!);

		const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onChange?.(e);
			debouncedAdjustHeight();
		};

		return (
			<div className={cn("relative", containerClassName)}>
				<textarea
					className={cn(
						`border-input bg-background flex w-full ${borderRadius.sm} border px-3 py-2 text-sm`,
						"transition-all duration-200 ease-in-out",
						"placeholder:text-muted-foreground",
						"disabled:cursor-not-allowed disabled:opacity-50",
						showRing
							? "focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none"
							: "",
						className,
					)}
					data-ph-no-capture
					ref={textareaRef}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					onChange={handleChange}
					style={{ minHeight, overflow: "hidden" }}
					{...props}
				/>

				{showRing && isFocused && (
					<motion.span
						className={`ring-primary/30 pointer-events-none absolute inset-0 ${borderRadius.sm} ring-2 ring-offset-0`}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: fast }}
					/>
				)}
			</div>
		);
	},
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
