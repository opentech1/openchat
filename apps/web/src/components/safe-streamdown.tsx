"use client";

import { Streamdown, type StreamdownProps } from "streamdown";
import { memo } from "react";
import { cn } from "@/lib/utils";

const components = {
	p({ children, className, ...props }) {
		return (
			<div
				className={cn("mb-4 leading-7 first:mt-0 last:mb-0", className)}
				{...props}
			>
				{children}
			</div>
		);
	},
} satisfies NonNullable<StreamdownProps["components"]>;

function SafeStreamdownBase({ className, ...props }: StreamdownProps) {
	return (
		<Streamdown
			className={className}
			components={components}
			{...props}
		/>
	);
}

export const SafeStreamdown = memo(SafeStreamdownBase);
