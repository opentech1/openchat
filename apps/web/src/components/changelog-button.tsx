import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MegaphoneIcon, ExternalLinkIcon } from "lucide-react";

export function ChangelogButton() {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
			<DropdownMenuTrigger className="relative inline-flex items-center justify-center size-9 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
				<MegaphoneIcon className="size-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="end"
				className="w-[calc(100vw-2rem)] max-w-[420px] p-0 overflow-hidden"
			>
				<div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 shrink-0">
					<span className="text-sm font-medium">What's New</span>
					<a
						href="https://updates.osschat.dev"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					>
						View all
						<ExternalLinkIcon className="size-3" />
					</a>
				</div>
				<iframe
					src="/changelog-embed.html"
					className="w-full h-[60vh] min-h-[400px] max-h-[70vh] border-0 block"
					title="Changelog"
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
