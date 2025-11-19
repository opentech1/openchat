"use client";

import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@server/convex/_generated/api";
import { useConvexUser } from "@/contexts/convex-user-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PlusIcon, SearchIcon, FilterIcon } from "lucide-react";
import { TemplateList } from "./template-list";
import type { PromptTemplate } from "./template-card";
import { NiceLoader } from "@/components/ui/nice-loader";
import type { Id } from "@server/convex/_generated/dataModel";
import { useRouter } from "next/navigation";

export default function TemplatesPageClient() {
	const router = useRouter();
	const { convexUser } = useConvexUser();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

	// Fetch templates
	const templatesResult = useQuery(
		api.promptTemplates.list,
		convexUser?._id ? { userId: convexUser._id } : "skip"
	);

	// Mutations
	const deleteTemplate = useMutation(api.promptTemplates.remove);

	const templates = templatesResult?.templates || [];

	// Get unique categories
	const categories = useMemo(() => {
		const cats = new Set<string>();
		templates.forEach((t) => {
			if (t.category) cats.add(t.category);
		});
		return Array.from(cats).sort();
	}, [templates]);

	// Filter templates
	const filteredTemplates = useMemo(() => {
		let filtered = templates;

		// Filter by search query
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(t) =>
					t.name.toLowerCase().includes(query) ||
					t.command.toLowerCase().includes(query) ||
					t.description?.toLowerCase().includes(query) ||
					t.template.toLowerCase().includes(query)
			);
		}

		// Filter by category
		if (selectedCategory) {
			filtered = filtered.filter((t) => t.category === selectedCategory);
		}

		return filtered;
	}, [templates, searchQuery, selectedCategory]);

	const handleCreate = () => {
		router.push("/dashboard/templates/new");
	};

	const handleEdit = (template: PromptTemplate) => {
		router.push(`/dashboard/templates/${template._id}`);
	};

	const handleDelete = async (templateId: string) => {
		if (!convexUser?._id) return;
		await deleteTemplate({
			templateId: templateId as Id<"promptTemplates">,
			userId: convexUser._id,
		});
	};

	if (!convexUser) {
		return (
			<div className="h-screen flex items-center justify-center">
				<NiceLoader message="Loading..." size="sm" />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
				{/* Header */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3 }}
					className="space-y-2"
				>
					<h1 className="text-3xl font-bold tracking-tight">Prompt Templates</h1>
					<p className="text-muted-foreground">
						Create and manage reusable prompt templates with custom slash commands
					</p>
				</motion.div>

				{/* Toolbar */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.1 }}
					className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
				>
					<div className="flex flex-col sm:flex-row gap-3 flex-1 w-full sm:w-auto">
						{/* Search */}
						<div className="relative flex-1 max-w-md">
							<SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search templates..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9"
							/>
						</div>

						{/* Category Filter */}
						{categories.length > 0 && (
							<div className="flex gap-2 items-center flex-wrap">
								<FilterIcon className="h-4 w-4 text-muted-foreground" />
								<Button
									variant={selectedCategory === null ? "default" : "outline"}
									size="sm"
									onClick={() => setSelectedCategory(null)}
								>
									All
								</Button>
								{categories.map((category) => (
									<Button
										key={category}
										variant={selectedCategory === category ? "default" : "outline"}
										size="sm"
										onClick={() => setSelectedCategory(category)}
									>
										{category}
									</Button>
								))}
							</div>
						)}
					</div>

					{/* Create Button */}
					<Button onClick={handleCreate} className="w-full sm:w-auto">
						<PlusIcon className="h-4 w-4 mr-2" />
						New Template
					</Button>
				</motion.div>

				{/* Stats */}
				<motion.div
					initial={{ opacity: 0, y: -10 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.3, delay: 0.2 }}
					className="flex gap-6 text-sm text-muted-foreground"
				>
					<span>
						<strong className="text-foreground">{templates.length}</strong> total templates
					</span>
					{searchQuery || selectedCategory ? (
						<span>
							<strong className="text-foreground">{filteredTemplates.length}</strong>{" "}
							matching
						</span>
					) : null}
				</motion.div>

				{/* Templates List */}
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ duration: 0.3, delay: 0.3 }}
				>
					{templatesResult === undefined ? (
						<div className="flex items-center justify-center py-12">
							<NiceLoader message="Loading templates..." size="sm" />
						</div>
					) : (
						<TemplateList
							templates={filteredTemplates}
							onEdit={handleEdit}
							onDelete={handleDelete}
							onClick={handleEdit}
						/>
					)}
				</motion.div>
			</div>
		</div>
	);
}
