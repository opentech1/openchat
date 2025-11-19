"use client";

import dynamicImport from "next/dynamic";
import { NiceLoader } from "@/components/ui/nice-loader";

const TemplateEditorPage = dynamicImport(
	() => import("@/components/templates/template-editor-page"),
	{
		ssr: false,
		loading: () => (
			<div className="w-full h-screen flex items-center justify-center">
				<NiceLoader message="Loading editor..." size="sm" />
			</div>
		),
	}
);

export default function NewTemplatePage() {
	return <TemplateEditorPage mode="create" />;
}
