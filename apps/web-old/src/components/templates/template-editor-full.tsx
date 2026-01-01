"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft, Save, Eye, Code } from "lucide-react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import type { Id } from "@server/convex/_generated/dataModel";
import { extractPlaceholders, generateArgumentHint } from "@/lib/template-parser";
import { toast } from "sonner";

interface TemplateEditorFullProps {
	templateId?: Id<"promptTemplates">;
	userId: Id<"users">;
	initialData?: {
		name: string;
		command: string;
		template: string;
		description?: string;
		category?: string;
	};
}

export function TemplateEditorFull({ templateId, userId, initialData }: TemplateEditorFullProps) {
	const router = useRouter();
	const [name, setName] = useState(initialData?.name || "");
	const [command, setCommand] = useState(initialData?.command?.replace(/^\//, "") || "");
	const [template, setTemplate] = useState(initialData?.template || "");
	const [category, setCategory] = useState(initialData?.category || "");
	const [showPreview, setShowPreview] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [lastSaved, setLastSaved] = useState<Date | null>(null);

	const autoSave = useMutation(api.promptTemplates.autoSave);
	const create = useMutation(api.promptTemplates.create);
	const update = useMutation(api.promptTemplates.update);

	const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Auto-save effect
	useEffect(() => {
		if (!templateId || !name || !template) return;

		if (saveTimeoutRef.current) {
			clearTimeout(saveTimeoutRef.current);
		}

		saveTimeoutRef.current = setTimeout(async () => {
			try {
				await autoSave({
					templateId,
					userId,
					name,
					template,
				});
				setLastSaved(new Date());
			} catch (error) {
				console.error("Auto-save failed:", error);
				toast.error("Failed to auto-save changes. Please save manually.");
			}
		}, 2000); // Auto-save after 2 seconds of inactivity

		return () => {
			if (saveTimeoutRef.current) {
				clearTimeout(saveTimeoutRef.current);
			}
		};
	}, [name, template, templateId, userId, autoSave]);

	const handleSave = async () => {
		if (!name || !command || !template) {
			alert("Please fill in name, command, and template");
			return;
		}

		setIsSaving(true);
		try {
			const commandWithSlash = command.startsWith("/") ? command : `/${command}`;

			if (templateId) {
				// Update existing
				await update({
					templateId,
					userId,
					name,
					command: commandWithSlash,
					template,
					category: category || undefined,
					isDraft: false,
				});
			} else {
				// Create new
				await create({
					userId,
					name,
					command: commandWithSlash,
					template,
					category: category || undefined,
					isDraft: false,
				});
			}

			setLastSaved(new Date());
			router.push("/templates");
		} catch (error) {
			console.error("Failed to save:", error);
			alert(error instanceof Error ? error.message : "Failed to save template");
		} finally {
			setIsSaving(false);
		}
	};

	const placeholders = extractPlaceholders(template);
	const argumentHint = generateArgumentHint(template);

	return (
		<div className="h-screen flex flex-col bg-background">
			{/* Header */}
			<div className="border-b border-border bg-card/50 backdrop-blur-sm px-6 py-4">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-4 flex-1">
						<Link href="/templates">
							<Button variant="ghost" size="sm">
								<ArrowLeft className="size-4 mr-2" />
								Back
							</Button>
						</Link>
						<div className="flex-1 max-w-md">
							<Input
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Template name..."
								className="text-lg font-semibold border-none bg-transparent focus-visible:ring-0 px-0"
								aria-label="Template name"
							/>
						</div>
					</div>

					<div className="flex items-center gap-3">
						{lastSaved && (
							<span className="text-xs text-muted-foreground">
								Auto-saved {lastSaved.toLocaleTimeString()}
							</span>
						)}
						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowPreview(!showPreview)}
						>
							{showPreview ? <Code className="size-4 mr-2" /> : <Eye className="size-4 mr-2" />}
							{showPreview ? "Code Only" : "Preview"}
						</Button>
						<Button
							size="sm"
							onClick={handleSave}
							disabled={isSaving || !name || !command || !template}
						>
							<Save className="size-4 mr-2" />
							{isSaving ? "Saving..." : "Save & Close"}
						</Button>
					</div>
				</div>

				{/* Command and Category */}
				<div className="flex items-center gap-4 mt-4">
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">Command:</span>
						<div className="relative">
							<span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
								/
							</span>
							<Input
								value={command}
								onChange={(e) => setCommand(e.target.value.replace(/^\//, "").toLowerCase())}
								placeholder="review, fix, translate"
								className="pl-7 w-48"
								aria-label="Command trigger"
							/>
						</div>
						{argumentHint && (
							<code className="text-xs bg-muted px-2 py-1 rounded text-muted-foreground">
								{argumentHint}
							</code>
						)}
					</div>
					<div className="flex items-center gap-2">
						<span className="text-sm text-muted-foreground">Category:</span>
						<Input
							value={category}
							onChange={(e) => setCategory(e.target.value)}
							placeholder="coding, writing..."
							className="w-48"
							aria-label="Category"
						/>
					</div>
					{placeholders.length > 0 && (
						<div className="flex items-center gap-2 ml-auto">
							<span className="text-xs text-muted-foreground">Placeholders:</span>
							{placeholders.map((p, i) => (
								<code key={i} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
									{p}
								</code>
							))}
						</div>
					)}
				</div>
			</div>

			{/* Editor */}
			<div className="flex-1 flex overflow-hidden">
				{/* Left: Markdown Editor */}
				<div className={cn(
					"flex-1 flex flex-col border-r border-border",
					!showPreview && "flex-[2]"
				)}>
					<div className="px-6 py-3 border-b border-border bg-muted/30">
						<h3 className="text-sm font-medium">Template Content</h3>
						<p className="text-xs text-muted-foreground mt-1">
							Use <code className="bg-muted px-1 rounded">$ARGUMENTS</code> or{" "}
							<code className="bg-muted px-1 rounded">$1, $2...</code> for dynamic values
						</p>
					</div>
					<textarea
						value={template}
						onChange={(e) => setTemplate(e.target.value)}
						placeholder="Enter your prompt template here...

Example:
Review this code for bugs and improvements: $ARGUMENTS

Or use specific arguments:
Translate $1 to $2 in a $3 tone"
						className={cn(
							"flex-1 w-full p-6 resize-none",
							"bg-transparent border-none",
							"focus:outline-none focus:ring-0",
							"font-mono text-sm leading-relaxed"
						)}
						aria-label="Template content"
					/>
				</div>

				{/* Right: Preview */}
				<AnimatePresence mode="wait">
					{showPreview && (
						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							exit={{ opacity: 0, x: 20 }}
							transition={{ duration: 0.2 }}
							className="flex-1 flex flex-col"
						>
							<div className="px-6 py-3 border-b border-border bg-muted/30">
								<h3 className="text-sm font-medium">Preview</h3>
								<p className="text-xs text-muted-foreground mt-1">
									How your template will appear
								</p>
							</div>
							<div className="flex-1 overflow-y-auto p-6">
								<div className="prose prose-sm dark:prose-invert max-w-none">
									{template ? (
										<pre className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg text-sm">
											{template}
										</pre>
									) : (
										<p className="text-muted-foreground italic">
											Your template preview will appear here...
										</p>
									)}
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
}
