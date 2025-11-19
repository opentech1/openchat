"use client";

import { motion, AnimatePresence } from "motion/react";
import { CommandIcon, XCircleIcon, CheckCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandBadgeProps {
	command: string;
	isValid: boolean;
	show: boolean;
}

export function CommandBadge({ command, isValid, show }: CommandBadgeProps) {
	return (
		<AnimatePresence>
			{show && (
				<motion.div
					initial={{ opacity: 0, y: 5 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 5 }}
					transition={{ duration: 0.15 }}
					className={cn(
						"inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border transition-colors",
						isValid
							? "bg-primary/10 text-primary border-primary/20"
							: "bg-muted text-muted-foreground border-border"
					)}
				>
					{isValid ? (
						<CheckCircleIcon className="h-3 w-3" />
					) : (
						<XCircleIcon className="h-3 w-3" />
					)}
					<span className="font-mono">{command}</span>
				</motion.div>
			)}
		</AnimatePresence>
	);
}
