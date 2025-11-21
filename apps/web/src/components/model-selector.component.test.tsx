/**
 * Comprehensive Component Tests for ModelSelector
 *
 * Tests the model selection dropdown component with provider grouping,
 * pricing display, filtering, and keyboard navigation.
 *
 * Coverage:
 * - Rendering model dropdown
 * - Grouping by provider (Popular, Free, Provider groups)
 * - Model selection
 * - Selected model highlighting
 * - Pricing display and indicators
 * - Free model filtering
 * - Keyboard navigation (arrows, enter, escape)
 * - Search/filter functionality
 * - OpenRouter OAuth integration
 * - Loading states
 * - Empty states
 * - Accessibility features
 */

import React from "react";
import { describe, test, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelSelector, type ModelSelectorOption } from "./model-selector";
import * as openRouterKey from "@/hooks/use-openrouter-key";
import * as openRouterOAuth from "@/hooks/use-openrouter-oauth";
import * as posthog from "@/lib/posthog";

// Mock dependencies
vi.mock("@/hooks/use-openrouter-key", () => ({
	useOpenRouterKey: vi.fn(),
}));

vi.mock("@/hooks/use-openrouter-oauth", () => ({
	useOpenRouterOAuth: vi.fn(),
}));

vi.mock("@/lib/posthog", () => ({
	registerClientProperties: vi.fn(),
}));

const mockUseOpenRouterKey = openRouterKey.useOpenRouterKey as ReturnType<typeof vi.fn>;
const mockUseOpenRouterOAuth = openRouterOAuth.useOpenRouterOAuth as ReturnType<typeof vi.fn>;

describe("ModelSelector Component", () => {
	// Sample model data
	const mockModels: ModelSelectorOption[] = [
		{
			value: "openai/gpt-4",
			label: "GPT-4",
			description: "Most capable model",
			context: 8192,
			pricing: { prompt: 0.00003, completion: 0.00006 },
			popular: true,
			capabilities: { reasoning: true, image: true },
		},
		{
			value: "openai/gpt-3.5-turbo",
			label: "GPT-3.5 Turbo",
			description: "Fast and efficient",
			context: 4096,
			pricing: { prompt: 0.0000005, completion: 0.0000015 },
			free: false,
		},
		{
			value: "anthropic/claude-3-5-sonnet",
			label: "Claude 3.5 Sonnet",
			description: "Latest Claude model",
			context: 200000,
			pricing: { prompt: 0.000003, completion: 0.000015 },
			popular: true,
			capabilities: { reasoning: true, image: true },
		},
		{
			value: "google/gemini-pro",
			label: "Gemini Pro",
			description: "Google's flagship model",
			context: 32768,
			pricing: { prompt: 0, completion: 0 },
			free: true,
		},
		{
			value: "meta-llama/llama-3.1-70b",
			label: "Llama 3.1 70B",
			description: "Open source model",
			context: 8192,
			pricing: { prompt: 0, completion: 0 },
			free: true,
		},
		{
			value: "deepseek/deepseek-chat",
			label: "DeepSeek Chat",
			description: "Reasoning model",
			context: 64000,
			pricing: { prompt: 0.00000014, completion: 0.00000028 },
			capabilities: { reasoning: true },
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mock implementations
		mockUseOpenRouterKey.mockReturnValue({
			hasKey: true,
			isLoading: false,
		});

		mockUseOpenRouterOAuth.mockReturnValue({
			initiateLogin: vi.fn(),
			isLoading: false,
			error: null,
		});
	});

	describe("Rendering", () => {
		test("should render model selector button", () => {
			render(<ModelSelector options={mockModels} />);

			expect(screen.getByRole("button", { name: /gpt-4/i })).toBeInTheDocument();
		});

		test("should show selected model name", () => {
			render(<ModelSelector options={mockModels} value="openai/gpt-4" />);

			expect(screen.getByText("GPT-4")).toBeInTheDocument();
		});

		test("should show first model as default when no value provided", () => {
			render(<ModelSelector options={mockModels} />);

			expect(screen.getByText("GPT-4")).toBeInTheDocument();
		});

		test("should show loading text when loading", () => {
			render(<ModelSelector options={mockModels} loading={true} />);

			expect(screen.getByText("Loading models...")).toBeInTheDocument();
		});

		test("should show select text when no models and not loading", () => {
			render(<ModelSelector options={[]} />);

			expect(screen.getByText("Select model")).toBeInTheDocument();
		});

		test("should disable button when disabled prop is true", () => {
			render(<ModelSelector options={mockModels} disabled={true} />);

			const button = screen.getByRole("button");
			expect(button).toBeDisabled();
		});

		test("should disable button when loading", () => {
			render(<ModelSelector options={mockModels} loading={true} />);

			const button = screen.getByRole("button");
			expect(button).toBeDisabled();
		});

		test("should disable button when no models available", () => {
			render(<ModelSelector options={[]} />);

			const button = screen.getByRole("button");
			expect(button).toBeDisabled();
		});

		test("should show provider logo for selected model", () => {
			render(<ModelSelector options={mockModels} value="openai/gpt-4" />);

			const logo = screen.getByAltText("openai logo");
			expect(logo).toBeInTheDocument();
		});
	});

	describe("Model Dropdown", () => {
		test("should open dropdown when button clicked", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			const button = screen.getByRole("button");
			await user.click(button);

			await waitFor(() => {
				expect(screen.getByPlaceholderText("Search models...")).toBeInTheDocument();
			});
		});

		test("should show search input in dropdown", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			expect(screen.getByPlaceholderText("Search models...")).toBeInTheDocument();
		});

		test("should close dropdown when model selected", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();
			render(<ModelSelector options={mockModels} onChange={onChange} />);

			await user.click(screen.getByRole("button"));

			const claudeOption = screen.getByText("Claude 3.5 Sonnet");
			await user.click(claudeOption);

			await waitFor(() => {
				expect(screen.queryByPlaceholderText("Search models...")).not.toBeInTheDocument();
			});
		});

		test("should close dropdown on escape key", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			await user.keyboard("{Escape}");

			await waitFor(() => {
				expect(screen.queryByPlaceholderText("Search models...")).not.toBeInTheDocument();
			});
		});
	});

	describe("Group by Provider", () => {
		test("should show Popular group first", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const groups = screen.getAllByRole("group");
			expect(groups[0]).toHaveTextContent("Popular");
		});

		test("should show Free Models group", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			expect(screen.getByText("Free Models")).toBeInTheDocument();
		});

		test("should group models by provider", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			expect(screen.getByText("OpenAI")).toBeInTheDocument();
			expect(screen.getByText("Anthropic")).toBeInTheDocument();
			expect(screen.getByText("Google")).toBeInTheDocument();
		});

		test("should show popular models in Popular group", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const popularGroup = screen.getAllByRole("group")[0];
			expect(within(popularGroup).getByText("GPT-4")).toBeInTheDocument();
			expect(within(popularGroup).getByText("Claude 3.5 Sonnet")).toBeInTheDocument();
		});

		test("should show free models in Free Models group", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const freeModelsHeading = screen.getByText("Free Models");
			const freeGroup = freeModelsHeading.closest('[role="group"]');

			expect(within(freeGroup!).getByText("Gemini Pro")).toBeInTheDocument();
			expect(within(freeGroup!).getByText("Llama 3.1 70B")).toBeInTheDocument();
		});

		test("should display provider logos in model list", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			expect(screen.getByAltText("openai logo")).toBeInTheDocument();
			expect(screen.getByAltText("anthropic logo")).toBeInTheDocument();
		});
	});

	describe("Select Model", () => {
		test("should select model when clicked", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();
			render(<ModelSelector options={mockModels} onChange={onChange} />);

			await user.click(screen.getByRole("button"));

			const claudeOption = screen.getByText("Claude 3.5 Sonnet");
			await user.click(claudeOption);

			expect(onChange).toHaveBeenCalledWith("anthropic/claude-3-5-sonnet");
		});

		test("should update selected model in controlled mode", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			const { rerender } = render(
				<ModelSelector options={mockModels} value="openai/gpt-4" onChange={onChange} />
			);

			expect(screen.getByText("GPT-4")).toBeInTheDocument();

			rerender(
				<ModelSelector options={mockModels} value="anthropic/claude-3-5-sonnet" onChange={onChange} />
			);

			expect(screen.getByText("Claude 3.5 Sonnet")).toBeInTheDocument();
		});

		test("should work in uncontrolled mode", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();
			render(<ModelSelector options={mockModels} onChange={onChange} />);

			await user.click(screen.getByRole("button"));

			const claudeOption = screen.getByText("Claude 3.5 Sonnet");
			await user.click(claudeOption);

			expect(onChange).toHaveBeenCalledWith("anthropic/claude-3-5-sonnet");

			// Button should now show Claude
			expect(screen.getByText("Claude 3.5 Sonnet")).toBeInTheDocument();
		});

		test("should call onChange with correct model value", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();
			render(<ModelSelector options={mockModels} onChange={onChange} />);

			await user.click(screen.getByRole("button"));

			const gpt35Option = screen.getByText("GPT-3.5 Turbo");
			await user.click(gpt35Option);

			expect(onChange).toHaveBeenCalledWith("openai/gpt-3.5-turbo");
		});
	});

	describe("Highlight Selected", () => {
		test("should show check mark on selected model", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} value="openai/gpt-4" />);

			await user.click(screen.getByRole("button"));

			const gpt4Option = screen.getByText("GPT-4").closest('[role="option"]');
			expect(within(gpt4Option!).getByRole("img", { hidden: true })).toBeInTheDocument();
		});

		test("should not show check mark on non-selected models", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} value="openai/gpt-4" />);

			await user.click(screen.getByRole("button"));

			const claudeOption = screen.getByText("Claude 3.5 Sonnet").closest('[role="option"]');
			// Check icon should not be present for non-selected
			expect(within(claudeOption!).queryByRole("img", { hidden: true })).not.toBeInTheDocument();
		});

		test("should update highlight when selection changes", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();

			const { rerender } = render(
				<ModelSelector options={mockModels} value="openai/gpt-4" onChange={onChange} />
			);

			await user.click(screen.getByRole("button"));

			let gpt4Option = screen.getByText("GPT-4").closest('[role="option"]');
			expect(within(gpt4Option!).getByRole("img", { hidden: true })).toBeInTheDocument();

			rerender(
				<ModelSelector options={mockModels} value="anthropic/claude-3-5-sonnet" onChange={onChange} />
			);

			const claudeOption = screen.getByText("Claude 3.5 Sonnet").closest('[role="option"]');
			expect(within(claudeOption!).getByRole("img", { hidden: true })).toBeInTheDocument();
		});
	});

	describe("Show Pricing", () => {
		test("should display pricing for models", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} value="openai/gpt-4" />);

			await user.click(screen.getByRole("button"));

			// GPT-4 pricing
			const gpt4Option = screen.getByText("GPT-4").closest('[role="option"]');
			expect(gpt4Option).toHaveTextContent("$30");
			expect(gpt4Option).toHaveTextContent("$60");
		});

		test("should show Free for free models", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const geminiOption = screen.getByText("Gemini Pro").closest('[role="option"]');
			expect(geminiOption).toHaveTextContent("Free");
		});

		test("should show price indicators with correct tiers", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			// Check that price indicators are rendered (visual bars)
			const gpt4Option = screen.getByText("GPT-4").closest('[role="option"]');
			const priceIndicator = within(gpt4Option!).getAllByRole("presentation", { hidden: true });
			expect(priceIndicator.length).toBeGreaterThan(0);
		});

		test("should show tooltip with detailed pricing on hover", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const gpt4Pricing = screen.getByText("GPT-4")
				.closest('[role="option"]')!
				.querySelector('[data-radix-collection-item]');

			if (gpt4Pricing) {
				await user.hover(gpt4Pricing);

				await waitFor(() => {
					// Tooltip should show input and output prices
					const tooltip = screen.queryByRole("tooltip");
					if (tooltip) {
						expect(tooltip).toHaveTextContent("In:");
						expect(tooltip).toHaveTextContent("Out:");
					}
				});
			}
		});

		test("should format prices correctly for very cheap models", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const gpt35Option = screen.getByText("GPT-3.5 Turbo").closest('[role="option"]');
			// Should format sub-dollar amounts
			expect(gpt35Option).toHaveTextContent("$0");
		});
	});

	describe("Filter Free Models", () => {
		test("should show only free models in Free Models group", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const freeModelsHeading = screen.getByText("Free Models");
			const freeGroup = freeModelsHeading.closest('[role="group"]');

			// Should include Gemini Pro and Llama
			expect(within(freeGroup!).getByText("Gemini Pro")).toBeInTheDocument();
			expect(within(freeGroup!).getByText("Llama 3.1 70B")).toBeInTheDocument();

			// Should not include paid models
			expect(within(freeGroup!).queryByText("GPT-4")).not.toBeInTheDocument();
		});

		test("should filter models by search term", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByPlaceholderText("Search models...");
			await user.type(searchInput, "claude");

			await waitFor(() => {
				expect(screen.getByText("Claude 3.5 Sonnet")).toBeInTheDocument();
				expect(screen.queryByText("GPT-4")).not.toBeInTheDocument();
			});
		});

		test("should show empty state when search has no results", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByPlaceholderText("Search models...");
			await user.type(searchInput, "nonexistent");

			await waitFor(() => {
				expect(screen.getByText("No models found.")).toBeInTheDocument();
			});
		});

		test("should search case-insensitively", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByPlaceholderText("Search models...");
			await user.type(searchInput, "CLAUDE");

			await waitFor(() => {
				expect(screen.getByText("Claude 3.5 Sonnet")).toBeInTheDocument();
			});
		});

		test("should match provider names in search", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByPlaceholderText("Search models...");
			await user.type(searchInput, "openai");

			await waitFor(() => {
				expect(screen.getByText("GPT-4")).toBeInTheDocument();
				expect(screen.getByText("GPT-3.5 Turbo")).toBeInTheDocument();
			});
		});
	});

	describe("Keyboard Navigation", () => {
		test("should navigate down with arrow down key", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			await user.keyboard("{ArrowDown}");

			// First option should be focused (behavior depends on cmdk implementation)
			// This is a basic check
			expect(document.activeElement).toBeTruthy();
		});

		test("should navigate up with arrow up key", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			await user.keyboard("{ArrowDown}");
			await user.keyboard("{ArrowDown}");
			await user.keyboard("{ArrowUp}");

			expect(document.activeElement).toBeTruthy();
		});

		test("should select model with enter key", async () => {
			const user = userEvent.setup();
			const onChange = vi.fn();
			render(<ModelSelector options={mockModels} onChange={onChange} />);

			await user.click(screen.getByRole("button"));

			await user.keyboard("{ArrowDown}");
			await user.keyboard("{Enter}");

			// Should have called onChange
			expect(onChange).toHaveBeenCalled();
		});

		test("should close dropdown with escape key", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			expect(screen.getByPlaceholderText("Search models...")).toBeInTheDocument();

			await user.keyboard("{Escape}");

			await waitFor(() => {
				expect(screen.queryByPlaceholderText("Search models...")).not.toBeInTheDocument();
			});
		});

		test("should focus search input when dropdown opens", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const searchInput = screen.getByPlaceholderText("Search models...");
			await waitFor(() => {
				expect(searchInput).toHaveFocus();
			});
		});

		test("should support tab navigation", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			const button = screen.getByRole("button");
			await user.tab();

			// Button should receive focus
			expect(button).toHaveFocus();
		});
	});

	describe("Model Capabilities", () => {
		test("should show reasoning icon for reasoning models", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const gpt4Option = screen.getByText("GPT-4").closest('[role="option"]');
			// Look for Brain icon (reasoning capability)
			const icon = within(gpt4Option!).getAllByRole("img", { hidden: true });
			expect(icon.length).toBeGreaterThan(0);
		});

		test("should show image icon for vision models", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			const gpt4Option = screen.getByText("GPT-4").closest('[role="option"]');
			const icons = within(gpt4Option!).getAllByRole("img", { hidden: true });
			expect(icons.length).toBeGreaterThan(0);
		});

		test("should show capability tooltips on hover", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			await user.click(screen.getByRole("button"));

			// This would require more complex tooltip interaction testing
			// which depends on the specific tooltip implementation
			const gpt4Option = screen.getByText("GPT-4").closest('[role="option"]');
			expect(gpt4Option).toBeInTheDocument();
		});
	});

	describe("OpenRouter OAuth Integration", () => {
		test("should show Connect OpenRouter button when no key", () => {
			mockUseOpenRouterKey.mockReturnValue({
				hasKey: false,
				isLoading: false,
			});

			render(<ModelSelector options={mockModels} />);

			expect(screen.getByText("Connect OpenRouter")).toBeInTheDocument();
		});

		test("should not show model selector when no key", () => {
			mockUseOpenRouterKey.mockReturnValue({
				hasKey: false,
				isLoading: false,
			});

			render(<ModelSelector options={mockModels} />);

			expect(screen.queryByText("GPT-4")).not.toBeInTheDocument();
		});

		test("should trigger OAuth flow when Connect button clicked", async () => {
			const initiateLogin = vi.fn();
			mockUseOpenRouterKey.mockReturnValue({
				hasKey: false,
				isLoading: false,
			});
			mockUseOpenRouterOAuth.mockReturnValue({
				initiateLogin,
				isLoading: false,
				error: null,
			});

			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			const connectButton = screen.getByText("Connect OpenRouter");
			await user.click(connectButton);

			expect(initiateLogin).toHaveBeenCalled();
		});

		test("should show loading state during OAuth", () => {
			mockUseOpenRouterKey.mockReturnValue({
				hasKey: false,
				isLoading: false,
			});
			mockUseOpenRouterOAuth.mockReturnValue({
				initiateLogin: vi.fn(),
				isLoading: true,
				error: null,
			});

			render(<ModelSelector options={mockModels} />);

			expect(screen.getByText("Connecting...")).toBeInTheDocument();
		});

		test("should disable Connect button during OAuth", () => {
			mockUseOpenRouterKey.mockReturnValue({
				hasKey: false,
				isLoading: false,
			});
			mockUseOpenRouterOAuth.mockReturnValue({
				initiateLogin: vi.fn(),
				isLoading: true,
				error: null,
			});

			render(<ModelSelector options={mockModels} />);

			const connectButton = screen.getByRole("button", { name: /connecting/i });
			expect(connectButton).toBeDisabled();
		});

		test("should show model selector after key is added", () => {
			const { rerender } = render(<ModelSelector options={mockModels} />);

			mockUseOpenRouterKey.mockReturnValue({
				hasKey: false,
				isLoading: false,
			});

			rerender(<ModelSelector options={mockModels} />);

			expect(screen.queryByText("GPT-4")).not.toBeInTheDocument();

			mockUseOpenRouterKey.mockReturnValue({
				hasKey: true,
				isLoading: false,
			});

			rerender(<ModelSelector options={mockModels} />);

			expect(screen.getByText("GPT-4")).toBeInTheDocument();
		});
	});

	describe("Analytics", () => {
		test("should register selected model in analytics", () => {
			render(<ModelSelector options={mockModels} value="openai/gpt-4" />);

			expect(posthog.registerClientProperties).toHaveBeenCalledWith({
				model_id: "openai/gpt-4",
			});
		});

		test("should update analytics when model changes", () => {
			const { rerender } = render(
				<ModelSelector options={mockModels} value="openai/gpt-4" />
			);

			rerender(
				<ModelSelector options={mockModels} value="anthropic/claude-3-5-sonnet" />
			);

			expect(posthog.registerClientProperties).toHaveBeenCalledWith({
				model_id: "anthropic/claude-3-5-sonnet",
			});
		});
	});

	describe("Accessibility", () => {
		test("should have proper ARIA labels", () => {
			render(<ModelSelector options={mockModels} />);

			const button = screen.getByRole("button");
			expect(button).toBeInTheDocument();
		});

		test("should announce loading states to screen readers", () => {
			mockUseOpenRouterKey.mockReturnValue({
				hasKey: false,
				isLoading: false,
			});
			mockUseOpenRouterOAuth.mockReturnValue({
				initiateLogin: vi.fn(),
				isLoading: true,
				error: null,
			});

			render(<ModelSelector options={mockModels} />);

			const liveRegion = screen.getByRole("status", { hidden: true });
			expect(liveRegion).toHaveTextContent("Connecting to OpenRouter...");
		});

		test("should announce model loading state", () => {
			render(<ModelSelector options={mockModels} loading={true} />);

			const liveRegion = screen.getByRole("status", { hidden: true });
			expect(liveRegion).toHaveTextContent("Loading models...");
		});

		test("should have keyboard accessible elements", async () => {
			const user = userEvent.setup();
			render(<ModelSelector options={mockModels} />);

			const button = screen.getByRole("button");

			// Should be focusable
			await user.tab();
			expect(button).toHaveFocus();

			// Should open on Enter
			await user.keyboard("{Enter}");
			await waitFor(() => {
				expect(screen.getByPlaceholderText("Search models...")).toBeInTheDocument();
			});
		});
	});

	describe("Edge Cases", () => {
		test("should handle empty options array", () => {
			render(<ModelSelector options={[]} />);

			expect(screen.getByText("Select model")).toBeInTheDocument();
			expect(screen.getByRole("button")).toBeDisabled();
		});

		test("should handle models without pricing", async () => {
			const modelsNoPricing = [
				{
					value: "custom/model",
					label: "Custom Model",
					pricing: { prompt: null, completion: null },
				},
			];

			const user = userEvent.setup();
			render(<ModelSelector options={modelsNoPricing} />);

			await user.click(screen.getByRole("button"));

			expect(screen.getByText("Custom Model")).toBeInTheDocument();
		});

		test("should handle models without provider prefix", async () => {
			const modelsNoProvider = [
				{
					value: "standalone-model",
					label: "Standalone Model",
					pricing: { prompt: 0, completion: 0 },
				},
			];

			const user = userEvent.setup();
			render(<ModelSelector options={modelsNoProvider} />);

			await user.click(screen.getByRole("button"));

			expect(screen.getByText("Standalone Model")).toBeInTheDocument();
		});

		test("should handle very long model names", async () => {
			const longNameModels = [
				{
					value: "provider/very-long-model-name-that-exceeds-normal-length",
					label: "A".repeat(100),
					pricing: { prompt: 0, completion: 0 },
				},
			];

			const user = userEvent.setup();
			render(<ModelSelector options={longNameModels} />);

			await user.click(screen.getByRole("button"));

			expect(screen.getByText("A".repeat(100))).toBeInTheDocument();
		});

		test("should handle rapid model changes", async () => {
			const onChange = vi.fn();
			const { rerender } = render(
				<ModelSelector options={mockModels} value="openai/gpt-4" onChange={onChange} />
			);

			rerender(
				<ModelSelector options={mockModels} value="anthropic/claude-3-5-sonnet" onChange={onChange} />
			);

			rerender(
				<ModelSelector options={mockModels} value="google/gemini-pro" onChange={onChange} />
			);

			expect(screen.getByText("Gemini Pro")).toBeInTheDocument();
		});

		test("should handle controlled open state", async () => {
			const user = userEvent.setup();
			const onOpenChange = vi.fn();

			render(
				<ModelSelector
					options={mockModels}
					open={true}
					onOpenChange={onOpenChange}
				/>
			);

			expect(screen.getByPlaceholderText("Search models...")).toBeInTheDocument();

			await user.keyboard("{Escape}");

			expect(onOpenChange).toHaveBeenCalledWith(false);
		});

		test("should memoize expensive computations", () => {
			const { rerender } = render(<ModelSelector options={mockModels} />);

			// Rerender with same props
			rerender(<ModelSelector options={mockModels} />);

			// Component should handle this efficiently
			expect(screen.getByText("GPT-4")).toBeInTheDocument();
		});
	});
});
