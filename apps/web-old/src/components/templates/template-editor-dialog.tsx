"use client";

import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { extractPlaceholders, generateArgumentHint } from "@/lib/template-parser";
import { InfoIcon, CommandIcon } from "lucide-react";
import type { PromptTemplate } from "./template-card";

interface TemplateEditorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (data: TemplateFormData) => Promise<void>;
	template?: PromptTemplate | null;
	mode: "create" | "edit";
}

export interface TemplateFormData {
	name: string;
	command: string;
	template: string;
	description?: string;
	category?: string;
}

export function TemplateEditorDialog({
	open,
	onOpenChange,
	onSave,
	template,
	mode,
}: TemplateEditorDialogProps) {
	const [formData, setFormData] = useState<TemplateFormData>({
		name: "",
		command: "",
		template: "",
		description: "",
		category: "",
	});
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Reset form when dialog opens/closes or template changes
	useEffect(() => {
		if (open) {
			if (mode === "edit" && template) {
				setFormData({
					name: template.name,
					command: template.command.replace(/^\//, ""), // Remove leading slash for editing
					template: template.template,
					description: template.description || "",
					category: template.category || "",
				});
			} else {
				setFormData({
					name: "",
					command: "",
					template: "",
					description: "",
					category: "",
				});
			}
			setError(null);
		}
	}, [open, mode, template]);

	const placeholders = extractPlaceholders(formData.template);
	const argumentHint = generateArgumentHint(formData.template);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Validation
		if (!formData.name.trim()) {
			setError("Template name is required");
			return;
		}
		if (!formData.command.trim()) {
			setError("Command is required");
			return;
		}
		if (!formData.template.trim()) {
			setError("Template content is required");
			return;
		}

		setIsSaving(true);
		try {
			await onSave({
				...formData,
				command: formData.command.startsWith("/") ? formData.command : `/${formData.command}`,
			});
			onOpenChange(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save template");
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{mode === "create" ? "Create New Template" : "Edit Template"}
					</DialogTitle>
					<DialogDescription>
						Create a reusable prompt template with custom slash commands.
						Use <code className="bg-muted px-1 py-0.5 rounded text-xs">$ARGUMENTS</code> or{" "}
						<code className="bg-muted px-1 py-0.5 rounded text-xs">$1, $2, $3...</code> for
						dynamic values.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{error && (
						<div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md p-3 text-sm">
							{error}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="name">Template Name *</Label>
						<Input
							id="name"
							value={formData.name}
							onChange={(e) => setFormData({ ...formData, name: e.target.value })}
							placeholder="e.g., Code Review, Bug Fix"
							disabled={isSaving}
							required
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="command">Slash Command *</Label>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
								/
							</span>
							<Input
								id="command"
								value={formData.command}
								onChange={(e) =>
									setFormData({
										...formData,
										command: e.target.value.replace(/^\//, "").toLowerCase(),
									})
								}
								placeholder="review, fix, translate"
								className="pl-7"
								disabled={isSaving}
								required
							/>
						</div>
						<p className="text-xs text-muted-foreground flex items-center gap-1">
							<CommandIcon className="h-3 w-3" />
							This command will trigger your template in chat
						</p>
					</div>

					<div className="space-y-2">
						<Label htmlFor="category">Category (optional)</Label>
						<Input
							id="category"
							value={formData.category}
							onChange={(e) => setFormData({ ...formData, category: e.target.value })}
							placeholder="e.g., coding, writing, analysis"
							disabled={isSaving}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="description">Description (optional)</Label>
						<Input
							id="description"
							value={formData.description}
							onChange={(e) => setFormData({ ...formData, description: e.target.value })}
							placeholder="Brief description of what this template does"
							disabled={isSaving}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="template">Template Content *</Label>
						<textarea
							id="template"
							value={formData.template}
							onChange={(e) => setFormData({ ...formData, template: e.target.value })}
							placeholder="Enter your prompt template here&#10;&#10;Use $ARGUMENTS for all arguments:&#10;Review this code: $ARGUMENTS&#10;&#10;Or use $1, $2, etc. for specific arguments:&#10;Translate $1 to $2"
							className={cn(
								"flex min-h-[200px] w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								"disabled:cursor-not-allowed disabled:opacity-50",
								"font-mono"
							)}
							disabled={isSaving}
							required
						/>
					</div>

					{placeholders.length > 0 && (
						<div className="bg-muted/50 border rounded-md p-3 space-y-2">
							<div className="flex items-center gap-2 text-sm font-medium">
								<InfoIcon className="h-4 w-4 text-primary" />
								Template Preview
							</div>
							<div className="text-xs text-muted-foreground space-y-1">
								<div>
									<span className="font-medium">Command:</span>{" "}
									<code className="bg-background px-1 py-0.5 rounded">
										/{formData.command || "command"} {argumentHint}
									</code>
								</div>
								<div>
									<span className="font-medium">Placeholders:</span>{" "}
									{placeholders.map((p, i) => (
										<code
											key={i}
											className="bg-background px-1 py-0.5 rounded mr-1"
										>
											{p}
										</code>
									))}
								</div>
							</div>
						</div>
					)}

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => onOpenChange(false)}
							disabled={isSaving}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSaving}>
							{isSaving
								? "Saving..."
								: mode === "create"
									? "Create Template"
									: "Save Changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
