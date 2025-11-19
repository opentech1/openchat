"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { CommandIcon, InfoIcon } from "lucide-react";
import { borderRadius, spacing } from "@/styles/design-tokens";
import { extractPlaceholders, generateArgumentHint } from "@/lib/template-parser";

interface Template {
	_id: string;
	name: string;
	command: string;
	template: string;
	description?: string;
	category?: string;
}

interface CommandAutocompleteProps {
	templates: Template[];
	partialCommand: string;
	onSelect: (template: Template) => void;
	onClose: () => void;
}

export function CommandAutocomplete({
	templates,
	partialCommand,
	onSelect,
	onClose,
}: CommandAutocompleteProps) {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);

	// Filter templates based on partial command
	const filteredTemplates = templates.filter((t) =>
		t.command.toLowerCase().includes(partialCommand.toLowerCase())
	);

	// Reset selection when filtered templates change
	useEffect(() => {
		setSelectedIndex(0);
	}, [partialCommand]);

	// Handle keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (filteredTemplates.length === 0) return;

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev < filteredTemplates.length - 1 ? prev + 1 : 0
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex((prev) =>
						prev > 0 ? prev - 1 : filteredTemplates.length - 1
					);
					break;
				case "Tab":
				case "Enter":
					e.preventDefault();
					if (filteredTemplates[selectedIndex]) {
						onSelect(filteredTemplates[selectedIndex]!);
					}
					break;
				case "Escape":
					e.preventDefault();
					onClose();
					break;
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [filteredTemplates, selectedIndex, onSelect, onClose]);

	// Click outside to close
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				onClose();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [onClose]);

	if (filteredTemplates.length === 0) {
		return (
			<motion.div
				ref={containerRef}
				initial={{ opacity: 0, y: 5 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 5 }}
				transition={{ duration: 0.15 }}
				className={cn(
					"absolute bottom-full left-4 right-4 mb-2 z-50",
					"bg-background/95 backdrop-blur-xl border border-border shadow-lg",
					borderRadius.lg,
				)}
			>
				<div className={cn("py-2 px-3 text-sm text-muted-foreground", spacing.gap.sm)}>
					<div className="flex items-center gap-2">
						<InfoIcon className="h-4 w-4" />
						<span>No matching templates found. Create one in the Prompt Library!</span>
					</div>
				</div>
			</motion.div>
		);
	}

	return (
		<AnimatePresence>
			<motion.div
				ref={containerRef}
				initial={{ opacity: 0, y: 5 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 5 }}
				transition={{ duration: 0.15 }}
				className={cn(
					"absolute bottom-full left-4 right-4 mb-2 z-50 max-h-[300px] overflow-y-auto",
					"bg-background/95 backdrop-blur-xl border border-border shadow-lg",
					borderRadius.lg,
				)}
			>
				<div className="py-1">
					{filteredTemplates.map((template, index) => {
						const placeholders = extractPlaceholders(template.template);
						const argumentHint = generateArgumentHint(template.template);

						return (
							<motion.button
								key={template._id}
								onClick={() => onSelect(template)}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								transition={{ delay: index * 0.02 }}
								className={cn(
									"w-full text-left px-3 py-2 transition-colors cursor-pointer",
									selectedIndex === index
										? "bg-primary/20 text-foreground"
										: "text-muted-foreground hover:bg-primary/10"
								)}
							>
								<div className="flex items-start justify-between gap-2">
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 mb-1">
											<CommandIcon className="h-3 w-3 text-primary flex-shrink-0" />
											<span className="font-medium text-sm truncate">
												{template.name}
											</span>
										</div>
										<div className="flex items-center gap-2 text-xs">
											<code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono">
												{template.command}
												{argumentHint && (
													<span className="text-muted-foreground/70 ml-1">
														{argumentHint}
													</span>
												)}
											</code>
										</div>
										{template.description && (
											<p className="text-xs text-muted-foreground mt-1 line-clamp-1">
												{template.description}
											</p>
										)}
									</div>
									{template.category && (
										<span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded flex-shrink-0">
											{template.category}
										</span>
									)}
								</div>
							</motion.button>
						);
					})}
				</div>
				<div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
					<span className="flex items-center gap-1">
						<kbd className="bg-muted px-1 rounded text-[10px]">↑↓</kbd> Navigate
						<kbd className="bg-muted px-1 rounded text-[10px] ml-2">Enter</kbd> Select
						<kbd className="bg-muted px-1 rounded text-[10px] ml-2">Esc</kbd> Close
					</span>
				</div>
			</motion.div>
		</AnimatePresence>
	);
}
