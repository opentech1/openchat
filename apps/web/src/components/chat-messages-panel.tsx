"use client";

import { ArrowDownIcon, Copy, RefreshCw, Quote } from "lucide-react";
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
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDayLabel, formatRelativeTime } from "@/lib/date";
import { FOCUS_COMPOSER_EVENT, PREFILL_COMPOSER_EVENT, type PrefillComposerEventDetail } from "@/lib/events";

type ChatMessage = {
	id: string;
	role: "user" | "assistant";
	content: string;
	createdAt: Date;
};

type ChatMessagesPanelProps = {
	messages: ChatMessage[];
	paddingBottom: number;
	className?: string;
	autoStick?: boolean;
};

const SCROLL_LOCK_THRESHOLD_PX = 48;

function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

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
							<TooltipProvider delayDuration={150}>
								{messages.map((msg, index) => {
									const previous = messages[index - 1];
									const showDayDivider =
										!previous || !isSameDay(previous.createdAt, msg.createdAt);
									const relativeLabel = formatRelativeTime(msg.createdAt);
									return (
										<div key={msg.id} className="space-y-2">
											{showDayDivider ? (
												<div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
													<div className="h-px flex-1 bg-border/60" />
													<span>{formatDayLabel(msg.createdAt)}</span>
													<div className="h-px flex-1 bg-border/60" />
												</div>
											) : null}
											<Message
												from={msg.role}
												className={cn(
													msg.role === "assistant" ? "justify-start flex-row" : undefined,
													"relative",
												)}
											>
												<div className="relative flex w-full flex-col gap-2">
													<div className="pointer-events-none absolute -top-8 right-0 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
														<Tooltip>
															<TooltipTrigger asChild>
																<button
																	type="button"
																	className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
																	onClick={() => {
																		void (async () => {
																			try {
																				if (navigator.clipboard?.writeText) {
																					await navigator.clipboard.writeText(msg.content);
																				} else {
																					document.execCommand?.("copy", false, msg.content);
																				}
																				toast.success("Message copied");
																			} catch {
																				toast.error("Failed to copy message");
																			}
																		})();
																}}
																aria-label="Copy message"
															>
																<Copy className="size-4" />
															</button>
														</TooltipTrigger>
														<TooltipContent side="left">Copy</TooltipContent>
													</Tooltip>
													<Tooltip>
														<TooltipTrigger asChild>
															<button
																	type="button"
																	className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
																	onClick={() => {
																		const detail: PrefillComposerEventDetail = { text: msg.content };
																		window.dispatchEvent(new CustomEvent(PREFILL_COMPOSER_EVENT, { detail }));
																		window.dispatchEvent(new Event(FOCUS_COMPOSER_EVENT));
																		toast.success("Composer prefilled");
																}}
																aria-label="Use as prompt"
															>
																<RefreshCw className="size-4" />
															</button>
														</TooltipTrigger>
														<TooltipContent side="left">Send to composer</TooltipContent>
													</Tooltip>
													<Tooltip>
														<TooltipTrigger asChild>
															<button
																	type="button"
																	className="pointer-events-auto inline-flex size-8 items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
																	onClick={() => {
																		const quoted = msg.content
																			.split(/\r?\n/)
																			.map((line) => `> ${line}`)
																			.join("\n");
																		const detail: PrefillComposerEventDetail = { text: `${quoted}\n\n` };
																		window.dispatchEvent(new CustomEvent(PREFILL_COMPOSER_EVENT, { detail }));
																		window.dispatchEvent(new Event(FOCUS_COMPOSER_EVENT));
																		toast.success("Quoted message in composer");
																}}
																aria-label="Quote message"
															>
																<Quote className="size-4" />
															</button>
														</TooltipTrigger>
														<TooltipContent side="left">Quote</TooltipContent>
													</Tooltip>
												</div>
												{msg.role === "assistant" ? (
													<Streamdown className="text-foreground text-sm leading-6 whitespace-pre-wrap">
														{msg.content}
													</Streamdown>
												) : (
													<div className="border border-border/70 rounded-lg bg-background px-4 py-2 text-sm leading-6 shadow-sm whitespace-pre-wrap">
														{msg.content}
													</div>
												)}
												<span className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
													{relativeLabel || formatDayLabel(msg.createdAt)}
												</span>
											</div>
											</Message>
										</div>
									);
								})}
							</TooltipProvider>
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
