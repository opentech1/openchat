"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
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
						`flex w-full ${borderRadius.sm} border border-input bg-transparent px-4 py-3 text-sm`,
						"placeholder:text-muted-foreground",
						"selection:bg-primary selection:text-primary-foreground",
						"disabled:cursor-not-allowed disabled:opacity-50",
						"transition-[border-color,box-shadow] duration-100 ease-out",
						"focus:border-ring focus:ring-1 focus:ring-ring/20",
						"outline-none",
						showRing
							? "focus:ring-0 focus:ring-offset-0"
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
					<span
						className={`ring-ring/20 pointer-events-none absolute inset-0 ${borderRadius.sm} ring-1 ring-offset-0 animate-in fade-in-0 duration-100`}
					/>
				)}
			</div>
		);
	},
);

AutoResizeTextarea.displayName = "AutoResizeTextarea";
