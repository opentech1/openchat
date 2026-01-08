import { cn } from "@/lib/utils";

interface IconProps {
	className?: string;
}

export function SearchIcon({ className }: IconProps) {
	return (
		<svg
			className={cn("size-5 text-muted-foreground", className)}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
			/>
		</svg>
	);
}

export function PlusIcon({ className }: IconProps) {
	return (
		<svg className={cn("size-5", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
		</svg>
	);
}

export function ChatIcon({ className }: IconProps) {
	return (
		<svg
			className={cn("size-4 shrink-0", className)}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
			/>
		</svg>
	);
}

export function SettingsIcon({ className }: IconProps) {
	return (
		<svg className={cn("size-4", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
			/>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
			/>
		</svg>
	);
}

export function LogOutIcon({ className }: IconProps) {
	return (
		<svg className={cn("size-4", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
			/>
		</svg>
	);
}

export function SidebarIcon({ className }: IconProps) {
	return (
		<svg className={cn("size-5", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor">
			<rect x="3" y="3" width="18" height="18" rx="2" strokeWidth={1.5} />
			<path d="M9 3v18" strokeWidth={1.5} />
		</svg>
	);
}

export function ChevronDownIcon({ className }: IconProps) {
	return (
		<svg
			className={cn("size-4 text-muted-foreground", className)}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
		</svg>
	);
}

export function ChevronRightIcon({ className }: IconProps) {
	return (
		<svg
			className={cn("size-4 text-sidebar-foreground/40", className)}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
		</svg>
	);
}

export function CheckIcon({ className }: IconProps) {
	return (
		<svg className={cn("size-4", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
		</svg>
	);
}

export function ArrowLeftIcon({ className }: IconProps) {
	return (
		<svg className={cn("size-4", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M10 19l-7-7m0 0l7-7m-7 7h18"
			/>
		</svg>
	);
}

export function UserIcon({ className }: IconProps) {
	return (
		<svg
			className={cn("size-5 text-muted-foreground", className)}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
			/>
		</svg>
	);
}

export function MailIcon({ className }: IconProps) {
	return (
		<svg
			className={cn("size-5 text-muted-foreground", className)}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={1.5}
				d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
			/>
		</svg>
	);
}

export function ExternalLinkIcon({ className }: IconProps) {
	return (
		<svg className={cn("size-3", className)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
			/>
		</svg>
	);
}

export function GitHubIcon({ className }: IconProps) {
	return (
		<svg
			className={cn("size-5 text-muted-foreground", className)}
			fill="currentColor"
			viewBox="0 0 24 24"
		>
			<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
		</svg>
	);
}

export function MenuIcon({ className }: IconProps) {
	return (
		<svg
			className={cn("size-5", className)}
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				strokeLinecap="round"
				strokeLinejoin="round"
				strokeWidth={2}
				d="M4 6h16M4 12h16M4 18h16"
			/>
		</svg>
	);
}
