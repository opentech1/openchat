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
	// Table components for responsive tables
	// CRITICAL: Use nested divs to ensure proper width containment and horizontal scrolling
	table({ children, className, ...props }) {
		return (
			<div className="my-4 w-full max-w-full overflow-hidden">
				<div className="overflow-x-auto rounded-lg border border-border">
					<table
						className={cn("min-w-full border-collapse text-sm", className)}
						{...props}
					>
						{children}
					</table>
				</div>
			</div>
		);
	},
	thead({ children, className, ...props }) {
		return (
			<thead className={cn("bg-muted/50", className)} {...props}>
				{children}
			</thead>
		);
	},
	tbody({ children, className, ...props }) {
		return (
			<tbody className={cn("divide-y divide-border", className)} {...props}>
				{children}
			</tbody>
		);
	},
	tr({ children, className, ...props }) {
		return (
			<tr className={cn("border-b border-border last:border-0", className)} {...props}>
				{children}
			</tr>
		);
	},
	th({ children, className, ...props }) {
		return (
			<th
				className={cn(
					"px-3 py-2 text-left font-medium text-foreground whitespace-nowrap",
					className
				)}
				{...props}
			>
				{children}
			</th>
		);
	},
	td({ children, className, ...props }) {
		return (
			<td
				className={cn("px-3 py-2 text-muted-foreground", className)}
				{...props}
			>
				{children}
			</td>
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
