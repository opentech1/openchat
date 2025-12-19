"use client";

import * as React from "react";
import { Download, FileText, FileJson, FileType } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getCsrfToken, CSRF_HEADER_NAME } from "@/lib/csrf-client";
import { iconSize } from "@/styles/design-tokens";

interface ChatExportButtonProps {
	chatId: string;
	className?: string;
}

type ExportFormat = "markdown" | "json" | "pdf";

export function ChatExportButton({ chatId, className }: ChatExportButtonProps) {
	const [isOpen, setIsOpen] = React.useState(false);
	const [isExporting, setIsExporting] = React.useState(false);

	const handleExport = async (format: ExportFormat) => {
		setIsExporting(true);
		setIsOpen(false);

		try {
			// Get CSRF token
			const csrfToken = await getCsrfToken();

			const response = await fetch(
				`/api/chats/${chatId}/export?format=${format}`,
				{
					method: "GET",
					headers: {
						[CSRF_HEADER_NAME]: csrfToken,
					},
				},
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Export failed");
			}

			// Get filename from Content-Disposition header
			const contentDisposition = response.headers.get("Content-Disposition");
			const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
			const filename =
				filenameMatch?.[1] || `chat-export.${format === "markdown" ? "md" : format}`;

			// Download the file
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);

			toast.success(`Chat exported as ${format.toUpperCase()}`);
		} catch (error) {
			console.error("Export error:", error);
			const message =
				error instanceof Error ? error.message : "Failed to export chat";
			toast.error(message);
		} finally {
			setIsExporting(false);
		}
	};

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			<PopoverTrigger asChild>
				<button
					className={cn(
						"hover:bg-accent text-muted-foreground hover:text-accent-foreground inline-flex size-9 items-center justify-center rounded-md transition-colors",
						isExporting && "opacity-50 pointer-events-none",
						className,
					)}
					aria-label="Export chat"
					disabled={isExporting}
				>
					<Download className={iconSize.sm} />
				</button>
			</PopoverTrigger>
			<PopoverContent className="w-48 p-2" align="end">
				<div className="flex flex-col gap-1">
				<button
					onClick={() => handleExport("markdown")}
					disabled={isExporting}
					aria-label="Export as Markdown"
					className={cn(
						"flex items-center gap-2 px-3 py-2 text-sm rounded-md",
						"hover:bg-accent hover:text-accent-foreground",
						"transition-colors outline-none",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						"disabled:opacity-50 disabled:pointer-events-none",
					)}
				>
					<FileText className="size-4" />
					<span>Markdown (.md)</span>
				</button>
				<button
					onClick={() => handleExport("json")}
					disabled={isExporting}
					aria-label="Export as JSON"
					className={cn(
						"flex items-center gap-2 px-3 py-2 text-sm rounded-md",
						"hover:bg-accent hover:text-accent-foreground",
						"transition-colors outline-none",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						"disabled:opacity-50 disabled:pointer-events-none",
					)}
				>
					<FileJson className="size-4" />
					<span>JSON (.json)</span>
				</button>
				<button
					onClick={() => handleExport("pdf")}
					disabled={isExporting}
					aria-label="Export as PDF"
					className={cn(
						"flex items-center gap-2 px-3 py-2 text-sm rounded-md",
						"hover:bg-accent hover:text-accent-foreground",
						"transition-colors outline-none",
						"focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						"disabled:opacity-50 disabled:pointer-events-none",
					)}
				>
					<FileType className="size-4" />
					<span>PDF (.pdf)</span>
				</button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
