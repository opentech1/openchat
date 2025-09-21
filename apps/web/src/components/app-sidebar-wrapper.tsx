"use client";

import { useEffect, useState } from "react";
import AppSidebar, { type AppSidebarProps } from "@/components/app-sidebar";

function SidebarSkeleton() {
	return (
		<div className="flex h-full flex-col justify-between border-r bg-background">
			<div className="p-4 text-sm text-muted-foreground">Loading…</div>
		</div>
	);
}

export default function AppSidebarWrapper(props: AppSidebarProps) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	if (!mounted) return <SidebarSkeleton />;
	return <AppSidebar {...props} />;
}
