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
	pre({ children, className, ...props }) {
		return (
			<pre
				className={cn("mb-4 overflow-x-auto rounded-lg bg-muted p-4 text-sm", className)}
				{...props}
			>
				{children}
			</pre>
		);
	},
	code({ children, className, ...props }) {
		return (
			<code
				className={cn("rounded bg-muted px-1 py-0.5 font-mono text-sm", className)}
				{...props}
			>
				{children}
			</code>
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
