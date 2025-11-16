"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@/lib/icons";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";

type CommandPaletteProps = {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
};

export function CommandPalette({ open: controlledOpen, onOpenChange }: CommandPaletteProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const router = useRouter();

	const open = controlledOpen ?? internalOpen;
	const setOpen = onOpenChange ?? setInternalOpen;

	const toggleOpen = useCallback(() => {
		if (onOpenChange) {
			onOpenChange(!open);
		} else {
			setInternalOpen((prev) => !prev);
		}
	}, [onOpenChange, open]);

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				toggleOpen();
			}
		};

		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [toggleOpen]);

	const handleNewChat = useCallback(() => {
		router.push("/dashboard");
		setOpen(false);
	}, [router, setOpen]);

	return (
		<CommandDialog open={open} onOpenChange={setOpen}>
			<CommandInput placeholder="Type a command..." />
			<CommandList>
				<CommandEmpty>No results found.</CommandEmpty>
				<CommandGroup heading="Actions">
					<CommandItem onSelect={handleNewChat}>
						<Plus className="mr-2 size-4" />
						<span>New Chat</span>
					</CommandItem>
				</CommandGroup>
			</CommandList>
		</CommandDialog>
	);
}

export function useCommandPalette() {
	const [open, setOpen] = useState(false);

	const openPalette = useCallback(() => setOpen(true), []);
	const closePalette = useCallback(() => setOpen(false), []);
	const togglePalette = useCallback(() => setOpen((prev) => !prev), []);

	return {
		open,
		setOpen,
		openPalette,
		closePalette,
		togglePalette,
	};
}
