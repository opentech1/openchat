"use client";

import { useConvexUser } from "@/contexts/convex-user-context";
import { useQuery } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { NiceLoader } from "@/components/ui/nice-loader";
import { TemplateEditorFull } from "./template-editor-full";
import type { Id } from "@server/convex/_generated/dataModel";

interface TemplateEditorPageProps {
	mode: "create" | "edit";
	templateId?: string;
}

export default function TemplateEditorPage({ mode, templateId }: TemplateEditorPageProps) {
	const { convexUser } = useConvexUser();

	const template = useQuery(
		api.promptTemplates.get,
		mode === "edit" && templateId && convexUser?._id
			? {
					templateId: templateId as Id<"promptTemplates">,
					userId: convexUser._id,
				}
			: "skip"
	);

	if (!convexUser) {
		return (
			<div className="h-screen flex items-center justify-center">
				<NiceLoader message="Loading..." size="sm" />
			</div>
		);
	}

	if (mode === "edit") {
		if (template === undefined) {
			return (
				<div className="h-screen flex items-center justify-center">
					<NiceLoader message="Loading template..." size="sm" />
				</div>
			);
		}

		if (!template) {
			return (
				<div className="h-screen flex items-center justify-center">
					<div className="text-center">
						<p className="text-lg font-medium">Template not found</p>
						<p className="text-sm text-muted-foreground mt-2">
							This template may have been deleted or you don't have access to it.
						</p>
					</div>
				</div>
			);
		}

		return (
			<TemplateEditorFull
				templateId={template._id}
				userId={convexUser._id}
				initialData={{
					name: template.name,
					command: template.command,
					template: template.template,
					description: template.description,
					category: template.category,
				}}
			/>
		);
	}

	// Create mode
	return (
		<TemplateEditorFull
			userId={convexUser._id}
			initialData={{
				name: "",
				command: "",
				template: "",
				description: "",
				category: "",
			}}
		/>
	);
}
