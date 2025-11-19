"use client";

import { AnimatePresence, motion } from "motion/react";
import { TemplateCard, type PromptTemplate } from "./template-card";
import { FileTextIcon } from "lucide-react";

interface TemplateListProps {
	templates: PromptTemplate[];
	onEdit: (template: PromptTemplate) => void;
	onDelete: (templateId: string) => void;
	onClick?: (template: PromptTemplate) => void;
	emptyMessage?: string;
}

export function TemplateList({ templates, onEdit, onDelete, onClick, emptyMessage }: TemplateListProps) {
	if (templates.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 text-center">
				<motion.div
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
				>
					<FileTextIcon className="h-12 w-12 text-muted-foreground/50 mb-4" />
					<p className="text-muted-foreground text-sm">
						{emptyMessage || "No templates yet. Create your first one to get started!"}
					</p>
				</motion.div>
			</div>
		);
	}

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
			<AnimatePresence mode="popLayout">
				{templates.map((template) => (
					<TemplateCard
						key={template._id}
						template={template}
						onEdit={onEdit}
						onDelete={onDelete}
						onClick={onClick}
					/>
				))}
			</AnimatePresence>
		</div>
	);
}
