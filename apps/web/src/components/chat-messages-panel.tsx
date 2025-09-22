"use client";

import { ArrowDownIcon } from "lucide-react";
import {
	memo,
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { Message } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Streamdown } from "streamdown";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
};

type ChatMessagesPanelProps = {
	messages: ChatMessage[];
	paddingBottom: number;
	className?: string;
	autoStick?: boolean;
};

const SCROLL_LOCK_THRESHOLD_PX = 48;

function ChatMessagesPanelComponent({ messages, paddingBottom, className, autoStick = true }: ChatMessagesPanelProps) {
	const viewportRef = useRef<HTMLDivElement | null>(null);
	const contentRef = useRef<HTMLDivElement>(null);
	const [isAtBottom, setIsAtBottom] = useState(true);
	const initialSyncDoneRef = useRef(false);
	const shouldStickRef = useRef(true);
	const lastSignatureRef = useRef<string | null>(null);

	const hasMessages = messages.length > 0;
	const tailSignature = useMemo(() => {
		if (!hasMessages) return null;
		const last = messages[messages.length - 1]!;
		return `${last.id}:${last.role}:${last.content.length}`;
	}, [hasMessages, messages]);

	const computeIsAtBottom = useCallback((node: HTMLDivElement) => {
		return node.scrollHeight - node.scrollTop - node.clientHeight <= SCROLL_LOCK_THRESHOLD_PX;
	}, []);

	const scrollToBottom = useCallback(
		(behavior: ScrollBehavior = "auto") => {
			const node = viewportRef.current;
			if (!node) return;
			node.scrollTo({ top: node.scrollHeight, behavior });
		},
		[],
	);

	const syncScrollPosition = useCallback(
		(forceInstant = false) => {
			if (!autoStick) return;
			if (!hasMessages) return;
			if (!shouldStickRef.current && !forceInstant) return;
			scrollToBottom(forceInstant ? "auto" : "smooth");
		},
		[autoStick, hasMessages, scrollToBottom],
	);

	useLayoutEffect(() => {
		const node = viewportRef.current;
		if (!node) return;
		if (!hasMessages) return;
		if (initialSyncDoneRef.current) return;
		requestAnimationFrame(() => {
			initialSyncDoneRef.current = true;
			shouldStickRef.current = true;
			scrollToBottom("auto");
			setIsAtBottom(true);
			lastSignatureRef.current = tailSignature;
		});
	}, [hasMessages, scrollToBottom, tailSignature]);

	useEffect(() => {
		const node = viewportRef.current;
		if (!node) return;
		const handleScroll = () => {
			const atBottom = computeIsAtBottom(node);
			setIsAtBottom(atBottom);
			shouldStickRef.current = atBottom;
		};
		handleScroll();
		node.addEventListener("scroll", handleScroll, { passive: true });
		return () => node.removeEventListener("scroll", handleScroll);
	}, [computeIsAtBottom]);

	useEffect(() => {
		if (!autoStick) return;
		if (!tailSignature) return;
		if (!initialSyncDoneRef.current) return;
		if (lastSignatureRef.current === tailSignature) return;
		lastSignatureRef.current = tailSignature;
		syncScrollPosition(false);
	}, [autoStick, tailSignature, syncScrollPosition]);

	useEffect(() => {
		if (tailSignature) return;
		lastSignatureRef.current = null;
	}, [tailSignature]);

	useLayoutEffect(() => {
		if (!autoStick) return;
		const contentNode = contentRef.current;
		if (!contentNode) return;
		const observer = new ResizeObserver(() => {
			if (!initialSyncDoneRef.current) return;
			if (!shouldStickRef.current) return;
			scrollToBottom("auto");
		});
		observer.observe(contentNode);
		return () => observer.disconnect();
	}, [autoStick, scrollToBottom]);

	return (
		<div className={cn("relative flex flex-1 min-h-0 flex-col", className)}>
			<ScrollAreaPrimitive.Root className="relative flex h-full flex-1 min-h-0 overflow-hidden">
				<ScrollAreaPrimitive.Viewport
					ref={(node) => {
						viewportRef.current = node;
					}}
					className="size-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
				>
					<div
						ref={contentRef}
						className="flex min-h-full flex-col gap-4 bg-background/30 px-4 pt-4"
						style={{ paddingBottom }}
					>
						{hasMessages ? (
							messages.map((msg) => (
								<Message key={msg.id} from={msg.role} className={msg.role === "assistant" ? "justify-start flex-row" : undefined}>
									{msg.role === "assistant" ? (
										<Streamdown className="text-foreground text-sm leading-6 whitespace-pre-wrap">
											{msg.content}
										</Streamdown>
									) : (
										<div className="border border-border rounded-lg px-4 py-2 text-sm whitespace-pre-wrap">{msg.content}</div>
									)}
								</Message>
							))
						) : (
							<p className="text-muted-foreground text-sm">No messages yet. Say hi!</p>
						)}
					</div>
				</ScrollAreaPrimitive.Viewport>
				<ScrollBar orientation="vertical" className="hidden" />
				<ScrollAreaPrimitive.Corner className="hidden" />
			</ScrollAreaPrimitive.Root>
			{autoStick && !isAtBottom ? (
				<Button
					type="button"
					variant="outline"
					size="icon"
					onClick={() => {
						shouldStickRef.current = true;
						scrollToBottom("smooth");
					}}
					className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 shadow-sm"
				>
					<ArrowDownIcon className="size-4" />
				</Button>
			) : null}
		</div>
	);
}

export const ChatMessagesPanel = memo(ChatMessagesPanelComponent);
ChatMessagesPanel.displayName = "ChatMessagesPanel";
