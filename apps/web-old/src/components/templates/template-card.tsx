"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EditIcon, TrashIcon, CommandIcon, TrendingUpIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { extractPlaceholders, generateArgumentHint } from "@/lib/template-parser";

export interface PromptTemplate {
	_id: string;
	name: string;
	command: string;
	template: string;
	description?: string;
	category?: string;
	isDraft?: boolean;
	usageCount?: number;
	createdAt: number;
	updatedAt: number;
}

interface TemplateCardProps {
	template: PromptTemplate;
	onEdit: (template: PromptTemplate) => void;
	onDelete: (templateId: string) => void;
	onClick?: (template: PromptTemplate) => void;
}

export function TemplateCard({ template, onEdit, onDelete, onClick }: TemplateCardProps) {
	const [isDeleting, setIsDeleting] = useState(false);

	const placeholders = extractPlaceholders(template.template);
	const argumentHint = generateArgumentHint(template.template);

	const handleDelete = async (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!confirm(`Delete template "${template.name}"?`)) return;
		setIsDeleting(true);
		try {
			await onDelete(template._id);
		} catch (error) {
			console.error("Failed to delete template:", error);
			setIsDeleting(false);
		}
	};

	const handleEdit = (e: React.MouseEvent) => {
		e.stopPropagation();
		onEdit(template);
	};

	const handleClick = () => {
		if (onClick) {
			onClick(template);
		}
	};

	return (
		<motion.div
			layout
			initial={{ opacity: 0, scale: 0.95 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.95 }}
			whileHover={{ scale: 1.02 }}
			transition={{ duration: 0.2 }}
		>
		<Card
			className={cn(
				"group cursor-pointer transition-all hover:shadow-md",
				onClick && "hover:border-primary/50"
			)}
			onClick={handleClick}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					handleClick();
				}
			}}
			role="button"
			tabIndex={0}
			aria-label={`Open template: ${template.name}`}
		>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<CommandIcon className="h-4 w-4 text-primary" />
						{template.name}
					</CardTitle>
					<CardDescription className="font-mono text-xs">
						{template.command}
						{argumentHint && (
							<span className="text-muted-foreground/70 ml-2">{argumentHint}</span>
						)}
					</CardDescription>
					<CardAction>
						<div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
							<Button
								variant="ghost"
								size="icon"
								onClick={handleEdit}
								disabled={isDeleting}
								className="h-8 w-8 hover:bg-accent"
							>
								<EditIcon className="h-4 w-4" />
								<span className="sr-only">Edit template</span>
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={handleDelete}
								disabled={isDeleting}
								className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/90 hover:text-destructive-foreground transition-all"
							>
								<TrashIcon className="h-4 w-4" />
								<span className="sr-only">Delete template</span>
							</Button>
						</div>
					</CardAction>
				</CardHeader>

				<CardContent className="space-y-3">
					{template.description && (
						<p className="text-sm text-muted-foreground">{template.description}</p>
					)}

					<div className="bg-muted/50 border rounded-md p-3">
						<p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap line-clamp-3">
							{template.template}
						</p>
					</div>

					<div className="flex items-center justify-between text-xs text-muted-foreground">
						<div className="flex items-center gap-4">
							{template.category && (
								<span className="bg-primary/10 text-primary px-2 py-1 rounded-md">
									{template.category}
								</span>
							)}
							{placeholders.length > 0 && (
								<span className="flex items-center gap-1">
									<span className="font-medium">{placeholders.length}</span>
									{placeholders.length === 1 ? "argument" : "arguments"}
								</span>
							)}
						</div>
						{(template.usageCount ?? 0) > 0 && (
							<span className="flex items-center gap-1">
								<TrendingUpIcon className="h-3 w-3" />
								{template.usageCount} uses
							</span>
						)}
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}
