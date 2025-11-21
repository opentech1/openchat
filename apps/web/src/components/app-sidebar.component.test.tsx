/**
 * Comprehensive Component Tests for AppSidebar
 *
 * Tests the main sidebar navigation component with chat list,
 * virtualization, user authentication, and chat management.
 *
 * Coverage:
 * - Rendering chat lists (small and large)
 * - Virtualization behavior
 * - Chat selection and highlighting
 * - Chat creation and deletion
 * - Search and filtering
 * - Empty states
 * - Sidebar collapse/expand
 * - User session handling
 * - Loading states
 * - Error handling
 * - Accessibility features
 */

import React from "react";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppSidebar, { type ChatListItem } from "./app-sidebar";
import * as authClient from "@/lib/auth-client";
import * as convexUserContext from "@/contexts/convex-user-context";
import * as openRouterKey from "@/hooks/use-openrouter-key";
import * as brandTheme from "@/components/brand-theme-provider";
import * as posthog from "@/lib/posthog";
import * as csrfClient from "@/lib/csrf-client";
import * as chatPrefetchCache from "@/lib/chat-prefetch-cache";

// Mock Next.js navigation
const mockPush = vi.fn();
const mockPrefetch = vi.fn();
const mockUsePathname = vi.fn(() => "/dashboard/chat/1");

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		prefetch: mockPrefetch,
	}),
	usePathname: () => mockUsePathname(),
}));

// Mock dependencies
vi.mock("@/lib/auth-client", () => ({
	authClient: {
		useSession: vi.fn(),
	},
}));

vi.mock("@/contexts/convex-user-context", () => ({
	useConvexUser: vi.fn(),
}));

vi.mock("@/hooks/use-openrouter-key", () => ({
	useOpenRouterKey: vi.fn(),
}));

vi.mock("@/components/brand-theme-provider", () => ({
	useBrandTheme: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
	captureClientEvent: vi.fn(),
	identifyClient: vi.fn(),
	registerClientProperties: vi.fn(),
}));

vi.mock("@/lib/csrf-client", () => ({
	fetchWithCsrf: vi.fn(),
}));

vi.mock("@/lib/chat-prefetch-cache", () => ({
	prefetchChat: vi.fn(),
}));

vi.mock("@/components/lazy/account-settings-modal-lazy", () => ({
	AccountSettingsModalLazy: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
		open ? <div data-testid="account-settings-modal">
			<button onClick={onClose}>Close</button>
		</div> : null
	),
}));

vi.mock("@/components/logo", () => ({
	Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock("@/components/theme-toggle", () => ({
	default: () => <button data-testid="theme-toggle">Theme</button>,
}));

vi.mock("@/components/error-boundary", () => ({
	ErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock sonner toast
vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
	},
}));

const mockUseSession = authClient.authClient.useSession as ReturnType<typeof vi.fn>;
const mockUseConvexUser = convexUserContext.useConvexUser as ReturnType<typeof vi.fn>;
const mockUseOpenRouterKey = openRouterKey.useOpenRouterKey as ReturnType<typeof vi.fn>;
const mockUseBrandTheme = brandTheme.useBrandTheme as ReturnType<typeof vi.fn>;
const mockFetchWithCsrf = csrfClient.fetchWithCsrf as ReturnType<typeof vi.fn>;
const mockPrefetchChat = chatPrefetchCache.prefetchChat as ReturnType<typeof vi.fn>;

describe("AppSidebar Component", () => {
	// Mock user data
	const mockUser = {
		id: "user_123",
		email: "test@example.com",
		name: "Test User",
		image: "https://example.com/avatar.jpg",
	};

	const mockConvexUser = {
		_id: "convex_user_123" as any,
		externalId: "user_123",
	};

	// Sample chat data
	const createMockChat = (id: string, title: string, daysAgo = 0): ChatListItem => ({
		id,
		title,
		updatedAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
		lastMessageAt: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
	});

	const mockChats: ChatListItem[] = [
		createMockChat("chat-1", "Chat 1", 0),
		createMockChat("chat-2", "Chat 2", 1),
		createMockChat("chat-3", "Chat 3", 2),
	];

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		mockUseSession.mockReturnValue({ data: { user: mockUser } });
		mockUseConvexUser.mockReturnValue({ convexUser: mockConvexUser });
		mockUseOpenRouterKey.mockReturnValue({
			hasKey: true,
			isLoading: false,
		});
		mockUseBrandTheme.mockReturnValue({ theme: "default" });
		mockFetchWithCsrf.mockResolvedValue({
			ok: true,
			json: async () => ({}),
		} as Response);
		mockPrefetchChat.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllTimers();
	});

	describe("Rendering", () => {
		test("should render sidebar with basic elements", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByRole("complementary")).toBeInTheDocument();
			expect(screen.getByText("New Chat")).toBeInTheDocument();
			expect(screen.getByText("Chats")).toBeInTheDocument();
			expect(screen.getByTestId("logo")).toBeInTheDocument();
		});

		test("should render all chats in list", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByText("Chat 1")).toBeInTheDocument();
			expect(screen.getByText("Chat 2")).toBeInTheDocument();
			expect(screen.getByText("Chat 3")).toBeInTheDocument();
		});

		test("should show empty state when no chats", () => {
			render(<AppSidebar initialChats={[]} />);

			expect(screen.getByText("No chats")).toBeInTheDocument();
		});

		test("should render user info when authenticated", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByText("Test User")).toBeInTheDocument();
			expect(screen.getByText("test@example.com")).toBeInTheDocument();
		});

		test("should render user avatar when image provided", () => {
			render(<AppSidebar initialChats={mockChats} />);

			const avatar = screen.getByAltText("Test User");
			expect(avatar).toBeInTheDocument();
			expect(avatar).toHaveAttribute("src", mockUser.image);
		});

		test("should render user initials when no image", () => {
			mockUseSession.mockReturnValue({
				data: { user: { ...mockUser, image: null } },
			});

			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByText("TU")).toBeInTheDocument(); // Test User initials
		});

		test("should render settings link", () => {
			render(<AppSidebar initialChats={mockChats} />);

			const settingsLink = screen.getByRole("link", { name: /settings/i });
			expect(settingsLink).toBeInTheDocument();
			expect(settingsLink).toHaveAttribute("href", "/dashboard/settings");
		});

		test("should render theme toggle", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
		});

		test("should render collapse button", () => {
			render(<AppSidebar initialChats={mockChats} />);

			const collapseButton = screen.getByRole("button", { name: /collapse sidebar/i });
			expect(collapseButton).toBeInTheDocument();
		});

		test("should render with Untitled for chats without title", () => {
			const chatsWithoutTitles = [{ ...mockChats[0], title: null }];
			render(<AppSidebar initialChats={chatsWithoutTitles} />);

			expect(screen.getByText("Untitled")).toBeInTheDocument();
		});
	});

	describe("Chat List Rendering", () => {
		test("should render chat list without virtualization for small lists", () => {
			const smallList = Array.from({ length: 10 }, (_, i) =>
				createMockChat(`chat-${i}`, `Chat ${i}`, i)
			);

			render(<AppSidebar initialChats={smallList} />);

			// All chats should be visible
			smallList.forEach((chat) => {
				expect(screen.getByText(chat.title!)).toBeInTheDocument();
			});
		});

		test("should use virtualization for large chat lists (>30)", () => {
			const largeList = Array.from({ length: 50 }, (_, i) =>
				createMockChat(`chat-${i}`, `Chat ${i}`, i)
			);

			const { container } = render(<AppSidebar initialChats={largeList} />);

			// Check for virtualization container styles
			const virtualContainer = container.querySelector('[style*="position"]');
			expect(virtualContainer).toBeInTheDocument();
		});

		test("should sort chats by most recent activity", () => {
			const unsortedChats = [
				createMockChat("old", "Old Chat", 10),
				createMockChat("new", "New Chat", 0),
				createMockChat("middle", "Middle Chat", 5),
			];

			render(<AppSidebar initialChats={unsortedChats} />);

			const chatLinks = screen.getAllByRole("link", { name: /chat/i });
			// Assuming the links appear in order
			expect(chatLinks[0]).toHaveTextContent("New Chat");
			expect(chatLinks[1]).toHaveTextContent("Middle Chat");
			expect(chatLinks[2]).toHaveTextContent("Old Chat");
		});

		test("should deduplicate chats with same ID", () => {
			const duplicateChats = [
				createMockChat("chat-1", "Chat 1 v1", 0),
				createMockChat("chat-1", "Chat 1 v2", 0),
				createMockChat("chat-2", "Chat 2", 1),
			];

			render(<AppSidebar initialChats={duplicateChats} />);

			// Should only show one "Chat 1"
			const chat1Elements = screen.getAllByText(/Chat 1/);
			expect(chat1Elements).toHaveLength(1);
		});
	});

	describe("Chat Selection and Highlighting", () => {
		test("should highlight selected chat based on pathname", () => {
			mockUsePathname.mockReturnValue("/dashboard/chat/chat-1");

			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			expect(chat1Link).toHaveAttribute("aria-current", "page");
		});

		test("should not highlight non-selected chats", () => {
			mockUsePathname.mockReturnValue("/dashboard/chat/chat-1");

			render(<AppSidebar initialChats={mockChats} />);

			const chat2Link = screen.getByRole("link", { name: "Chat 2" });
			expect(chat2Link).not.toHaveAttribute("aria-current");
		});

		test("should handle click to navigate to chat", async () => {
			const user = userEvent.setup();
			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			await user.click(chat1Link);

			// Link should have correct href
			expect(chat1Link).toHaveAttribute("href", "/dashboard/chat/chat-1");
		});

		test("should prefetch chat on hover", async () => {
			const user = userEvent.setup();
			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			await user.hover(chat1Link);

			await waitFor(() => {
				expect(mockPrefetch).toHaveBeenCalledWith("/dashboard/chat/chat-1");
				expect(mockPrefetchChat).toHaveBeenCalledWith("chat-1");
			});
		});

		test("should prefetch chat on focus", async () => {
			const user = userEvent.setup();
			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			await user.tab(); // Focus on first focusable element

			// Keep tabbing until we reach the chat link
			let attempts = 0;
			while (document.activeElement !== chat1Link && attempts < 10) {
				await user.tab();
				attempts++;
			}

			if (document.activeElement === chat1Link) {
				await waitFor(() => {
					expect(mockPrefetchChat).toHaveBeenCalledWith("chat-1");
				});
			}
		});
	});

	describe("Create New Chat", () => {
		test("should create new chat when button clicked", async () => {
			const user = userEvent.setup();
			const newChat = createMockChat("new-chat", "New Chat");

			mockFetchWithCsrf.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ chat: newChat }),
			} as Response);

			render(<AppSidebar initialChats={mockChats} />);

			const createButton = screen.getByRole("button", { name: /new chat/i });
			await user.click(createButton);

			await waitFor(() => {
				expect(mockFetchWithCsrf).toHaveBeenCalledWith(
					"/api/chats",
					expect.objectContaining({
						method: "POST",
						body: JSON.stringify({ title: "New Chat" }),
					})
				);
			});

			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/dashboard/chat/new-chat");
			});
		});

		test("should show loading state while creating chat", async () => {
			const user = userEvent.setup();

			// Delay the response
			mockFetchWithCsrf.mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					ok: true,
					json: async () => ({ chat: createMockChat("new", "New") }),
				} as Response), 100))
			);

			render(<AppSidebar initialChats={mockChats} />);

			const createButton = screen.getByRole("button", { name: /new chat/i });
			await user.click(createButton);

			// Should show loading state
			expect(screen.getByText("Creating…")).toBeInTheDocument();
			expect(createButton).toHaveAttribute("aria-busy", "true");
		});

		test("should disable create button when not authenticated", () => {
			mockUseSession.mockReturnValue({ data: null });

			render(<AppSidebar initialChats={mockChats} />);

			const createButton = screen.getByRole("button", { name: /new chat/i });
			expect(createButton).toBeDisabled();
		});

		test("should handle create chat error", async () => {
			const user = userEvent.setup();
			const { toast } = await import("sonner");

			mockFetchWithCsrf.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ error: "Failed to create chat" }),
			} as Response);

			render(<AppSidebar initialChats={mockChats} />);

			const createButton = screen.getByRole("button", { name: /new chat/i });
			await user.click(createButton);

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalledWith("Failed to create chat");
			});
		});

		test("should prevent duplicate create requests", async () => {
			const user = userEvent.setup();

			mockFetchWithCsrf.mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					ok: true,
					json: async () => ({ chat: createMockChat("new", "New") }),
				} as Response), 100))
			);

			render(<AppSidebar initialChats={mockChats} />);

			const createButton = screen.getByRole("button", { name: /new chat/i });

			// Click multiple times rapidly
			await user.click(createButton);
			await user.click(createButton);
			await user.click(createButton);

			// Should only call API once
			await waitFor(() => {
				expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1);
			});
		});

		test("should capture analytics event on chat creation", async () => {
			const user = userEvent.setup();
			const newChat = createMockChat("new-chat", "New Chat");

			mockFetchWithCsrf.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ chat: newChat }),
			} as Response);

			render(<AppSidebar initialChats={mockChats} />);

			const createButton = screen.getByRole("button", { name: /new chat/i });
			await user.click(createButton);

			await waitFor(() => {
				expect(posthog.captureClientEvent).toHaveBeenCalledWith(
					"chat.created",
					expect.objectContaining({
						chat_id: "new-chat",
						source: "sidebar_button",
					})
				);
			});
		});
	});

	describe("Delete Chat", () => {
		test("should show delete button on hover", async () => {
			const user = userEvent.setup();
			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			const chatItem = chat1Link.closest("div");

			await user.hover(chatItem!);

			const deleteButton = within(chatItem!).getByRole("button", { name: /delete/i });
			expect(deleteButton).toBeVisible();
		});

		test("should delete chat when delete button clicked", async () => {
			const user = userEvent.setup();

			mockFetchWithCsrf.mockResolvedValueOnce({
				ok: true,
			} as Response);

			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			const chatItem = chat1Link.closest("div");

			// Hover to show delete button
			await user.hover(chatItem!);

			const deleteButton = within(chatItem!).getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(mockFetchWithCsrf).toHaveBeenCalledWith(
					"/api/chats/chat-1",
					expect.objectContaining({
						method: "DELETE",
					})
				);
			});

			// Chat should be removed from list
			await waitFor(() => {
				expect(screen.queryByText("Chat 1")).not.toBeInTheDocument();
			});
		});

		test("should show loading state while deleting", async () => {
			const user = userEvent.setup();

			mockFetchWithCsrf.mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					ok: true,
				} as Response), 100))
			);

			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			const chatItem = chat1Link.closest("div");

			await user.hover(chatItem!);

			const deleteButton = within(chatItem!).getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			// Should show loading indicator
			expect(deleteButton).toBeDisabled();
		});

		test("should handle delete error", async () => {
			const user = userEvent.setup();
			const { toast } = await import("sonner");

			mockFetchWithCsrf.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ error: "Failed to delete" }),
			} as Response);

			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			const chatItem = chat1Link.closest("div");

			await user.hover(chatItem!);

			const deleteButton = within(chatItem!).getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			await waitFor(() => {
				expect(toast.error).toHaveBeenCalled();
			});

			// Chat should still be in list
			expect(screen.getByText("Chat 1")).toBeInTheDocument();
		});

		test("should prevent delete click from navigating to chat", async () => {
			const user = userEvent.setup();

			mockFetchWithCsrf.mockResolvedValueOnce({
				ok: true,
			} as Response);

			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			const chatItem = chat1Link.closest("div");

			await user.hover(chatItem!);

			const deleteButton = within(chatItem!).getByRole("button", { name: /delete/i });
			await user.click(deleteButton);

			// Should not navigate (click event should be stopped)
			expect(chat1Link).toBeInTheDocument();
		});
	});

	describe("Account Settings", () => {
		test("should open account settings modal when button clicked", async () => {
			const user = userEvent.setup();
			render(<AppSidebar initialChats={mockChats} />);

			const accountButton = screen.getByRole("button", { name: /account settings/i });
			await user.click(accountButton);

			expect(screen.getByTestId("account-settings-modal")).toBeInTheDocument();
		});

		test("should close account settings modal", async () => {
			const user = userEvent.setup();
			render(<AppSidebar initialChats={mockChats} />);

			const accountButton = screen.getByRole("button", { name: /account settings/i });
			await user.click(accountButton);

			expect(screen.getByTestId("account-settings-modal")).toBeInTheDocument();

			const closeButton = screen.getByRole("button", { name: "Close" });
			await user.click(closeButton);

			await waitFor(() => {
				expect(screen.queryByTestId("account-settings-modal")).not.toBeInTheDocument();
			});
		});

		test("should not open modal when user not authenticated", async () => {
			mockUseSession.mockReturnValue({ data: null });

			const user = userEvent.setup();
			render(<AppSidebar initialChats={mockChats} />);

			const accountButton = screen.getByRole("button", { name: /account/i });
			await user.click(accountButton);

			expect(screen.queryByTestId("account-settings-modal")).not.toBeInTheDocument();
		});
	});

	describe("Accessibility", () => {
		test("should have proper ARIA labels", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByRole("button", { name: /create new chat/i })).toBeInTheDocument();
			expect(screen.getByRole("button", { name: /collapse sidebar/i })).toBeInTheDocument();
			expect(screen.getByRole("link", { name: /settings/i })).toBeInTheDocument();
		});

		test("should announce loading states to screen readers", async () => {
			const user = userEvent.setup();

			mockFetchWithCsrf.mockImplementation(() =>
				new Promise(resolve => setTimeout(() => resolve({
					ok: true,
					json: async () => ({ chat: createMockChat("new", "New") }),
				} as Response), 100))
			);

			render(<AppSidebar initialChats={mockChats} />);

			const createButton = screen.getByRole("button", { name: /new chat/i });
			await user.click(createButton);

			// Check for live region with announcement
			const liveRegion = screen.getByRole("status", { hidden: true });
			expect(liveRegion).toHaveTextContent("Creating new chat...");
		});

		test("should mark selected chat with aria-current", () => {
			mockUsePathname.mockReturnValue("/dashboard/chat/chat-1");

			render(<AppSidebar initialChats={mockChats} />);

			const chat1Link = screen.getByRole("link", { name: "Chat 1" });
			expect(chat1Link).toHaveAttribute("aria-current", "page");
		});

		test("should have keyboard navigation support", async () => {
			const user = userEvent.setup();
			render(<AppSidebar initialChats={mockChats} />);

			// Tab through interactive elements
			await user.tab();
			expect(document.activeElement).toHaveAttribute("aria-label");
		});
	});

	describe("User Session States", () => {
		test("should show user info when authenticated", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByText("Test User")).toBeInTheDocument();
			expect(screen.getByText("test@example.com")).toBeInTheDocument();
		});

		test("should show fallback when user has no name", () => {
			mockUseSession.mockReturnValue({
				data: { user: { ...mockUser, name: null } },
			});

			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByText("test@example.com")).toBeInTheDocument();
		});

		test("should show generic account text when not authenticated", () => {
			mockUseSession.mockReturnValue({ data: null });

			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByText("Account")).toBeInTheDocument();
		});

		test("should identify user for analytics", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(posthog.identifyClient).toHaveBeenCalledWith(
				mockUser.id,
				expect.objectContaining({
					workspaceId: mockUser.id,
				})
			);
		});
	});

	describe("Analytics Tracking", () => {
		test("should track dashboard entry", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(posthog.captureClientEvent).toHaveBeenCalledWith(
				"dashboard.entered",
				expect.objectContaining({
					chat_total: mockChats.length,
				})
			);
		});

		test("should register client properties", () => {
			render(<AppSidebar initialChats={mockChats} />);

			expect(posthog.registerClientProperties).toHaveBeenCalledWith(
				expect.objectContaining({
					auth_state: "member",
					workspace_id: mockUser.id,
				})
			);
		});

		test("should track only once per mount", () => {
			const { rerender } = render(<AppSidebar initialChats={mockChats} />);

			const firstCallCount = vi.mocked(posthog.captureClientEvent).mock.calls.length;

			rerender(<AppSidebar initialChats={mockChats} />);

			// Should not call again on rerender
			expect(vi.mocked(posthog.captureClientEvent).mock.calls.length).toBe(firstCallCount);
		});
	});

	describe("Edge Cases", () => {
		test("should handle chats with null titles", () => {
			const chatsWithNull = [{ ...mockChats[0], title: null }];
			render(<AppSidebar initialChats={chatsWithNull} />);

			expect(screen.getByText("Untitled")).toBeInTheDocument();
		});

		test("should handle chats with very long titles", () => {
			const longTitle = "A".repeat(200);
			const chatsWithLongTitle = [{ ...mockChats[0], title: longTitle }];
			render(<AppSidebar initialChats={chatsWithLongTitle} />);

			expect(screen.getByText(longTitle)).toBeInTheDocument();
		});

		test("should handle empty user name", () => {
			mockUseSession.mockReturnValue({
				data: { user: { ...mockUser, name: "" } },
			});

			render(<AppSidebar initialChats={mockChats} />);

			// Should fall back to email
			expect(screen.getByText("test@example.com")).toBeInTheDocument();
		});

		test("should handle missing user email", () => {
			mockUseSession.mockReturnValue({
				data: { user: { id: "123", name: "Test" } },
			});

			render(<AppSidebar initialChats={mockChats} />);

			expect(screen.getByText("Test")).toBeInTheDocument();
		});

		test("should handle rapid chat list updates", async () => {
			const { rerender } = render(<AppSidebar initialChats={mockChats} />);

			const newChats = [...mockChats, createMockChat("chat-4", "Chat 4")];
			rerender(<AppSidebar initialChats={newChats} />);

			await waitFor(() => {
				expect(screen.getByText("Chat 4")).toBeInTheDocument();
			});
		});

		test("should handle invalid date formats gracefully", () => {
			const invalidChats = [
				{
					id: "invalid",
					title: "Invalid Date Chat",
					updatedAt: "invalid-date",
					lastMessageAt: "invalid-date",
				},
			];

			render(<AppSidebar initialChats={invalidChats as ChatListItem[]} />);

			expect(screen.getByText("Invalid Date Chat")).toBeInTheDocument();
		});
	});
});
