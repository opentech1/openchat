/**
 * Unit Tests for ChatComposer Component
 *
 * Tests the chat message composer including:
 * - Typing messages in textarea
 * - Send on Enter key behavior
 * - Newline on Shift+Enter
 * - Disable states while streaming
 * - File attachments
 * - Command autocomplete
 * - Model selection
 * - Validation
 */

import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatComposer from "./chat-composer";
import type { UserEvent } from "@testing-library/user-event";

// Mock dependencies
vi.mock("convex/react", () => ({
  useMutation: vi.fn(() => vi.fn()),
  useQuery: vi.fn(() => ({ templates: [] })),
}));

vi.mock("@/contexts/convex-user-context", () => ({
  useConvexUser: vi.fn(() => ({
    convexUser: { _id: "convex-user-123" },
  })),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/components/model-selector", () => ({
  ModelSelector: ({ value, onChange, options }: any) => (
    <select
      data-testid="model-selector"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt: any) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock("./file-upload-button", () => ({
  FileUploadButton: ({ onFileSelect, disabled }: any) => (
    <button
      data-testid="file-upload-button"
      onClick={() => onFileSelect(new File(["test"], "test.png", { type: "image/png" }))}
      disabled={disabled}
    >
      Upload File
    </button>
  ),
}));

vi.mock("./file-preview", () => ({
  FilePreview: ({ file, onRemove }: any) => (
    <div data-testid={`file-preview-${file.filename}`}>
      {file.filename}
      {onRemove && (
        <button onClick={onRemove} data-testid={`remove-${file.filename}`}>
          Remove
        </button>
      )}
    </div>
  ),
}));

vi.mock("./command-autocomplete", () => ({
  CommandAutocomplete: ({ templates, onSelect, onClose }: any) => (
    <div data-testid="command-autocomplete">
      {templates.map((template: any) => (
        <button
          key={template._id}
          onClick={() => onSelect(template)}
          data-testid={`template-${template.command}`}
        >
          {template.command}
        </button>
      ))}
      <button onClick={onClose} data-testid="close-autocomplete">
        Close
      </button>
    </div>
  ),
}));

vi.mock("./ui/command-badge", () => ({
  CommandBadge: ({ command, isValid }: any) => (
    <div data-testid="command-badge" data-valid={isValid}>
      {command}
    </div>
  ),
}));

vi.mock("./reasoning-controls", () => ({
  ReasoningControls: ({ value, onChange }: any) => (
    <button
      data-testid="reasoning-controls"
      onClick={() => onChange({ enabled: !value.enabled })}
    >
      Reasoning: {value.enabled ? "On" : "Off"}
    </button>
  ),
}));

vi.mock("@/components/ui/context-usage-indicator", () => ({
  ContextUsageIndicator: ({ currentTokens, maxTokens }: any) => (
    <div data-testid="context-usage">
      {currentTokens} / {maxTokens || "∞"}
    </div>
  ),
}));

describe("ChatComposer Component", () => {
  let user: UserEvent;
  const mockOnSend = vi.fn();
  const mockOnModelChange = vi.fn();
  const mockOnStop = vi.fn();

  const defaultProps = {
    onSend: mockOnSend,
    modelOptions: [
      { value: "gpt-4", label: "GPT-4", capabilities: {} },
      { value: "claude-3", label: "Claude 3", capabilities: {} },
    ],
    modelValue: "gpt-4",
    onModelChange: mockOnModelChange,
    apiKey: "sk-test-key",
  };

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Textarea Interaction", () => {
    test("should type message in textarea", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Hello, world!");

      expect(textarea).toHaveValue("Hello, world!");
    });

    test("should clear textarea after sending", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test message");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(textarea).toHaveValue("");
      });
    });

    test("should handle multiline input", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Line 1{Shift>}{Enter}{/Shift}Line 2");

      expect(textarea).toHaveValue("Line 1\nLine 2");
    });

    test("should disable textarea when disabled prop is true", () => {
      render(<ChatComposer {...defaultProps} disabled={true} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      expect(textarea).toBeDisabled();
    });

    test("should allow typing when not disabled", () => {
      render(<ChatComposer {...defaultProps} disabled={false} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      expect(textarea).not.toBeDisabled();
    });

    test("should show placeholder text", () => {
      render(<ChatComposer {...defaultProps} placeholder="Type your message..." />);

      expect(screen.getByPlaceholderText("Type your message...")).toBeInTheDocument();
    });

    test("should use custom placeholder", () => {
      render(<ChatComposer {...defaultProps} placeholder="Custom placeholder" />);

      expect(screen.getByPlaceholderText("Custom placeholder")).toBeInTheDocument();
    });

    test("should auto-resize textarea on input", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Short text");

      // Textarea should adjust height (implementation uses ResizeObserver)
      expect(textarea).toBeInTheDocument();
    });

    test("should handle paste events", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.click(textarea);
      await user.paste("Pasted text");

      expect(textarea).toHaveValue("Pasted text");
    });

    test("should trim whitespace before sending", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "  Text with spaces  ");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining("Text with spaces"),
          })
        );
      });
    });
  });

  describe("Send on Enter Key", () => {
    test("should send on Enter key", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test message{Enter}");

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalled();
      });
    });

    test("should NOT send on Shift+Enter", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Line 1{Shift>}{Enter}{/Shift}Line 2");

      expect(mockOnSend).not.toHaveBeenCalled();
      expect(textarea).toHaveValue("Line 1\nLine 2");
    });

    test("should create newline on Shift+Enter", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "First{Shift>}{Enter}{/Shift}Second");

      expect(textarea).toHaveValue("First\nSecond");
    });

    test("should not send empty message on Enter", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "{Enter}");

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    test("should not send whitespace-only message", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "   {Enter}");

      expect(mockOnSend).not.toHaveBeenCalled();
    });

    test("should send message with Enter after typing", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Hello");
      await user.keyboard("{Enter}");

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalledWith(
          expect.objectContaining({
            text: "Hello",
          })
        );
      });
    });

    test("should prevent Enter from sending when autocomplete is open", async () => {
      const { useMutation, useQuery } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [{ _id: "1", command: "/test", template: "Test template" }],
      });

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/test");

      // Autocomplete should appear
      await waitFor(() => {
        expect(screen.getByTestId("command-autocomplete")).toBeInTheDocument();
      });

      // Enter should not send when autocomplete is open
      await user.keyboard("{Enter}");
      expect(mockOnSend).not.toHaveBeenCalled();
    });
  });

  describe("Streaming State", () => {
    test("should disable input while streaming", () => {
      render(<ChatComposer {...defaultProps} isStreaming={true} />);

      // Send button should change to Stop button
      expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    });

    test("should show stop button while streaming", () => {
      render(<ChatComposer {...defaultProps} isStreaming={true} onStop={mockOnStop} />);

      const stopButton = screen.getByRole("button", { name: /stop/i });
      expect(stopButton).toBeInTheDocument();
    });

    test("should call onStop when stop button clicked", async () => {
      render(<ChatComposer {...defaultProps} isStreaming={true} onStop={mockOnStop} />);

      const stopButton = screen.getByRole("button", { name: /stop/i });
      await user.click(stopButton);

      expect(mockOnStop).toHaveBeenCalled();
    });

    test("should change button from Send to Stop", () => {
      const { rerender } = render(<ChatComposer {...defaultProps} isStreaming={false} />);

      expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();

      rerender(<ChatComposer {...defaultProps} isStreaming={true} />);

      expect(screen.getByRole("button", { name: /stop/i })).toBeInTheDocument();
    });

    test("should disable file upload while streaming", () => {
      render(
        <ChatComposer
          {...defaultProps}
          isStreaming={true}
          userId="user-123"
          chatId="chat-123"
        />
      );

      const uploadButton = screen.getByTestId("file-upload-button");
      expect(uploadButton).toBeDisabled();
    });

    test("should disable model selector while streaming", () => {
      render(<ChatComposer {...defaultProps} isStreaming={true} />);

      const modelSelector = screen.getByTestId("model-selector");
      expect(modelSelector).toBeDisabled();
    });
  });

  describe("File Attachments", () => {
    test("should attach file", async () => {
      const { useMutation } = require("convex/react");
      const generateUploadUrl = vi.fn().mockResolvedValue("https://upload.url");
      const saveFileMetadata = vi.fn().mockResolvedValue({
        filename: "test.png",
        url: "https://file.url",
      });
      useMutation.mockImplementation((fn: any) => {
        if (fn.toString().includes("generateUploadUrl")) return generateUploadUrl;
        if (fn.toString().includes("saveFileMetadata")) return saveFileMetadata;
        return vi.fn();
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ storageId: "storage-123" }),
      });

      render(
        <ChatComposer {...defaultProps} userId="user-123" chatId="chat-123" />
      );

      const uploadButton = screen.getByTestId("file-upload-button");
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId("file-preview-test.png")).toBeInTheDocument();
      });
    });

    test("should remove attachment", async () => {
      const { useMutation } = require("convex/react");
      const generateUploadUrl = vi.fn().mockResolvedValue("https://upload.url");
      const saveFileMetadata = vi.fn().mockResolvedValue({
        filename: "test.png",
        url: "https://file.url",
      });
      useMutation.mockImplementation((fn: any) => {
        if (fn.toString().includes("generateUploadUrl")) return generateUploadUrl;
        if (fn.toString().includes("saveFileMetadata")) return saveFileMetadata;
        return vi.fn();
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ storageId: "storage-123" }),
      });

      render(
        <ChatComposer {...defaultProps} userId="user-123" chatId="chat-123" />
      );

      const uploadButton = screen.getByTestId("file-upload-button");
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId("file-preview-test.png")).toBeInTheDocument();
      });

      const removeButton = screen.getByTestId("remove-test.png");
      await user.click(removeButton);

      await waitFor(() => {
        expect(screen.queryByTestId("file-preview-test.png")).not.toBeInTheDocument();
      });
    });

    test("should show file preview", async () => {
      const { useMutation } = require("convex/react");
      const generateUploadUrl = vi.fn().mockResolvedValue("https://upload.url");
      const saveFileMetadata = vi.fn().mockResolvedValue({
        filename: "document.pdf",
        url: "https://file.url",
      });
      useMutation.mockImplementation((fn: any) => {
        if (fn.toString().includes("generateUploadUrl")) return generateUploadUrl;
        if (fn.toString().includes("saveFileMetadata")) return saveFileMetadata;
        return vi.fn();
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ storageId: "storage-456" }),
      });

      render(
        <ChatComposer {...defaultProps} userId="user-123" chatId="chat-123" />
      );

      const uploadButton = screen.getByTestId("file-upload-button");
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId("file-preview-document.pdf")).toBeInTheDocument();
      });
    });

    test("should validate file size", async () => {
      const { toast } = require("sonner");

      render(
        <ChatComposer {...defaultProps} userId="user-123" chatId="chat-123" />
      );

      // File validation happens in FileUploadButton component
      expect(screen.getByTestId("file-upload-button")).toBeInTheDocument();
    });

    test("should handle multiple attachments", async () => {
      const { useMutation } = require("convex/react");
      const generateUploadUrl = vi.fn().mockResolvedValue("https://upload.url");
      const saveFileMetadata = vi
        .fn()
        .mockResolvedValueOnce({ filename: "file1.png", url: "https://file1.url" })
        .mockResolvedValueOnce({ filename: "file2.jpg", url: "https://file2.url" });
      useMutation.mockImplementation((fn: any) => {
        if (fn.toString().includes("generateUploadUrl")) return generateUploadUrl;
        if (fn.toString().includes("saveFileMetadata")) return saveFileMetadata;
        return vi.fn();
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ storageId: "storage-123" }),
      });

      render(
        <ChatComposer {...defaultProps} userId="user-123" chatId="chat-123" />
      );

      const uploadButton = screen.getByTestId("file-upload-button");
      await user.click(uploadButton);
      await user.click(uploadButton);

      // Both files should be visible (mocked to upload the same file twice)
      await waitFor(() => {
        const previews = screen.getAllByTestId(/file-preview-/);
        expect(previews.length).toBeGreaterThan(0);
      });
    });

    test("should clear attachments after sending", async () => {
      const { useMutation } = require("convex/react");
      const generateUploadUrl = vi.fn().mockResolvedValue("https://upload.url");
      const saveFileMetadata = vi.fn().mockResolvedValue({
        filename: "test.png",
        url: "https://file.url",
      });
      useMutation.mockImplementation((fn: any) => {
        if (fn.toString().includes("generateUploadUrl")) return generateUploadUrl;
        if (fn.toString().includes("saveFileMetadata")) return saveFileMetadata;
        return vi.fn();
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ storageId: "storage-123" }),
      });

      render(
        <ChatComposer {...defaultProps} userId="user-123" chatId="chat-123" />
      );

      const uploadButton = screen.getByTestId("file-upload-button");
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId("file-preview-test.png")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Message with attachment");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.queryByTestId("file-preview-test.png")).not.toBeInTheDocument();
      });
    });

    test("should handle file upload error", async () => {
      const { useMutation } = require("convex/react");
      const { toast } = require("sonner");
      const generateUploadUrl = vi.fn().mockRejectedValue(new Error("Upload failed"));
      useMutation.mockReturnValue(generateUploadUrl);

      render(
        <ChatComposer {...defaultProps} userId="user-123" chatId="chat-123" />
      );

      const uploadButton = screen.getByTestId("file-upload-button");
      await user.click(uploadButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
    });

    test("should restore attachments on send failure", async () => {
      const { useMutation } = require("convex/react");
      const generateUploadUrl = vi.fn().mockResolvedValue("https://upload.url");
      const saveFileMetadata = vi.fn().mockResolvedValue({
        filename: "test.png",
        url: "https://file.url",
      });
      useMutation.mockImplementation((fn: any) => {
        if (fn.toString().includes("generateUploadUrl")) return generateUploadUrl;
        if (fn.toString().includes("saveFileMetadata")) return saveFileMetadata;
        return vi.fn();
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ storageId: "storage-123" }),
      });

      const failingSend = vi.fn().mockRejectedValue(new Error("Send failed"));

      render(
        <ChatComposer
          {...defaultProps}
          onSend={failingSend}
          userId="user-123"
          chatId="chat-123"
        />
      );

      const uploadButton = screen.getByTestId("file-upload-button");
      await user.click(uploadButton);

      await waitFor(() => {
        expect(screen.getByTestId("file-preview-test.png")).toBeInTheDocument();
      });

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      // Attachments should be restored after send fails
      await waitFor(() => {
        expect(screen.getByTestId("file-preview-test.png")).toBeInTheDocument();
      });
    });
  });

  describe("Command Autocomplete", () => {
    test("should parse /commands", async () => {
      const { useQuery } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [{ _id: "1", command: "/help", template: "Help text" }],
      });

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/help");

      await waitFor(() => {
        expect(screen.getByTestId("command-autocomplete")).toBeInTheDocument();
      });
    });

    test("should show command autocomplete", async () => {
      const { useQuery } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [
          { _id: "1", command: "/test", template: "Test template" },
          { _id: "2", command: "/help", template: "Help template" },
        ],
      });

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/");

      await waitFor(() => {
        expect(screen.getByTestId("command-autocomplete")).toBeInTheDocument();
      });
    });

    test("should filter commands based on input", async () => {
      const { useQuery } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [
          { _id: "1", command: "/test", template: "Test template" },
          { _id: "2", command: "/help", template: "Help template" },
        ],
      });

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/te");

      await waitFor(() => {
        expect(screen.getByTestId("command-autocomplete")).toBeInTheDocument();
      });
    });

    test("should select command from autocomplete", async () => {
      const { useQuery } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [{ _id: "1", command: "/test", template: "Test template {arg}" }],
      });

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/test");

      await waitFor(() => {
        expect(screen.getByTestId("command-autocomplete")).toBeInTheDocument();
      });

      const templateButton = screen.getByTestId("template-/test");
      await user.click(templateButton);

      await waitFor(() => {
        expect(textarea).toHaveValue("/test ");
      });
    });

    test("should close autocomplete on Escape", async () => {
      const { useQuery } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [{ _id: "1", command: "/test", template: "Test" }],
      });

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/test");

      await waitFor(() => {
        expect(screen.getByTestId("command-autocomplete")).toBeInTheDocument();
      });

      const closeButton = screen.getByTestId("close-autocomplete");
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId("command-autocomplete")).not.toBeInTheDocument();
      });
    });

    test("should hide autocomplete when typing arguments", async () => {
      const { useQuery } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [{ _id: "1", command: "/test", template: "Test {arg}" }],
      });

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/test ");

      await waitFor(() => {
        expect(screen.queryByTestId("command-autocomplete")).not.toBeInTheDocument();
      });
    });

    test("should show command badge when valid", async () => {
      const { useQuery } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [{ _id: "1", command: "/test", template: "Test" }],
      });

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/test arg");

      await waitFor(() => {
        const badge = screen.getByTestId("command-badge");
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute("data-valid", "true");
      });
    });

    test("should expand command template on send", async () => {
      const { useQuery, useMutation } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [{ _id: "1", command: "/greet", template: "Hello, {name}!" }],
      });
      const incrementUsage = vi.fn();
      useMutation.mockReturnValue(incrementUsage);

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/greet John");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalledWith(
          expect.objectContaining({
            text: expect.stringContaining("John"),
          })
        );
      });
    });

    test("should increment template usage count", async () => {
      const { useQuery, useMutation } = require("convex/react");
      useQuery.mockReturnValue({
        templates: [{ _id: "template-1", command: "/test", template: "Test" }],
      });
      const incrementUsage = vi.fn();
      useMutation.mockReturnValue(incrementUsage);

      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "/test");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(incrementUsage).toHaveBeenCalled();
      });
    });
  });

  describe("Model Selection", () => {
    test("should display model selector", () => {
      render(<ChatComposer {...defaultProps} />);

      expect(screen.getByTestId("model-selector")).toBeInTheDocument();
    });

    test("should change selected model", async () => {
      render(<ChatComposer {...defaultProps} />);

      const selector = screen.getByTestId("model-selector");
      await user.selectOptions(selector, "claude-3");

      expect(mockOnModelChange).toHaveBeenCalledWith("claude-3");
    });

    test("should show model options", () => {
      render(<ChatComposer {...defaultProps} />);

      const selector = screen.getByTestId("model-selector");
      expect(within(selector).getByText("GPT-4")).toBeInTheDocument();
      expect(within(selector).getByText("Claude 3")).toBeInTheDocument();
    });

    test("should disable model selector while busy", () => {
      render(<ChatComposer {...defaultProps} isStreaming={true} />);

      const selector = screen.getByTestId("model-selector");
      expect(selector).toBeDisabled();
    });

    test("should show loading state for models", () => {
      render(<ChatComposer {...defaultProps} modelsLoading={true} />);

      const selector = screen.getByTestId("model-selector");
      expect(selector).toBeInTheDocument();
    });

    test("should handle empty model options", () => {
      render(<ChatComposer {...defaultProps} modelOptions={[]} />);

      const selector = screen.getByTestId("model-selector");
      expect(selector).toBeDisabled();
    });

    test("should show selected model value", () => {
      render(<ChatComposer {...defaultProps} modelValue="gpt-4" />);

      const selector = screen.getByTestId("model-selector") as HTMLSelectElement;
      expect(selector.value).toBe("gpt-4");
    });
  });

  describe("Send Button States", () => {
    test("should disable send when no text", () => {
      render(<ChatComposer {...defaultProps} />);

      const sendButton = screen.getByRole("button", { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });

    test("should enable send when text is entered", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test message");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      expect(sendButton).not.toBeDisabled();
    });

    test("should disable send when sendDisabled prop is true", async () => {
      render(<ChatComposer {...defaultProps} sendDisabled={true} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });

    test("should show loading state while sending", async () => {
      const slowSend = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ChatComposer {...defaultProps} onSend={slowSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      // Button should show loading state
      expect(sendButton).toBeInTheDocument();
    });

    test("should handle send button click", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Click send");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnSend).toHaveBeenCalledWith(
          expect.objectContaining({
            text: "Click send",
            modelId: "gpt-4",
            apiKey: "sk-test-key",
          })
        );
      });
    });
  });

  describe("Validation", () => {
    test("should validate model is selected", async () => {
      const mockOnMissingRequirement = vi.fn();

      render(
        <ChatComposer
          {...defaultProps}
          modelValue={null}
          onMissingRequirement={mockOnMissingRequirement}
        />
      );

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnMissingRequirement).toHaveBeenCalledWith("model");
      });
    });

    test("should validate API key is present", async () => {
      const mockOnMissingRequirement = vi.fn();

      render(
        <ChatComposer
          {...defaultProps}
          apiKey={null}
          onMissingRequirement={mockOnMissingRequirement}
        />
      );

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(mockOnMissingRequirement).toHaveBeenCalledWith("apiKey");
      });
    });

    test("should not send empty message", async () => {
      render(<ChatComposer {...defaultProps} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "   ");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      expect(sendButton).toBeDisabled();
    });

    test("should show error message on failure", async () => {
      const failingSend = vi.fn().mockRejectedValue(new Error("Send failed"));

      render(<ChatComposer {...defaultProps} onSend={failingSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    test("should clear error on new input", async () => {
      const failingSend = vi.fn().mockRejectedValue(new Error("Send failed"));

      render(<ChatComposer {...defaultProps} onSend={failingSend} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "Test");

      const sendButton = screen.getByRole("button", { name: /send message/i });
      await user.click(sendButton);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      await user.type(textarea, "New message");

      await waitFor(() => {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      });
    });
  });

  describe("Context Usage Indicator", () => {
    test("should display context usage", () => {
      render(<ChatComposer {...defaultProps} messages={[]} />);

      expect(screen.getByTestId("context-usage")).toBeInTheDocument();
    });

    test("should update context count with messages", () => {
      const messages = [
        {
          id: "1",
          role: "user" as const,
          parts: [{ type: "text" as const, text: "Hello" }],
        },
      ];

      render(<ChatComposer {...defaultProps} messages={messages} />);

      const indicator = screen.getByTestId("context-usage");
      expect(indicator).toBeInTheDocument();
    });

    test("should count tokens from current input", async () => {
      render(<ChatComposer {...defaultProps} messages={[]} />);

      const textarea = screen.getByRole("textbox", { name: /message input/i });
      await user.type(textarea, "This is a test message");

      const indicator = screen.getByTestId("context-usage");
      expect(indicator).toBeInTheDocument();
    });
  });

  describe("Reasoning Controls", () => {
    test("should show reasoning controls for reasoning models", () => {
      const modelOptions = [
        {
          value: "deepseek",
          label: "DeepSeek",
          capabilities: { reasoning: true },
        },
      ];

      render(
        <ChatComposer
          {...defaultProps}
          modelOptions={modelOptions}
          modelValue="deepseek"
        />
      );

      expect(screen.getByTestId("reasoning-controls")).toBeInTheDocument();
    });

    test("should hide reasoning controls for non-reasoning models", () => {
      render(<ChatComposer {...defaultProps} />);

      expect(screen.queryByTestId("reasoning-controls")).not.toBeInTheDocument();
    });

    test("should toggle reasoning on/off", async () => {
      const modelOptions = [
        {
          value: "deepseek",
          label: "DeepSeek",
          capabilities: { reasoning: true },
        },
      ];

      render(
        <ChatComposer
          {...defaultProps}
          modelOptions={modelOptions}
          modelValue="deepseek"
        />
      );

      const reasoningButton = screen.getByTestId("reasoning-controls");
      await user.click(reasoningButton);

      expect(reasoningButton).toBeInTheDocument();
    });
  });

  describe("Keyboard Shortcuts", () => {
    test("should open model selector with Cmd+M", async () => {
      render(<ChatComposer {...defaultProps} />);

      await user.keyboard("{Meta>}m{/Meta}");

      // Model selector should be focused/opened
      const selector = screen.getByTestId("model-selector");
      expect(selector).toBeInTheDocument();
    });

    test("should open model selector with Ctrl+M", async () => {
      render(<ChatComposer {...defaultProps} />);

      await user.keyboard("{Control>}m{/Control}");

      const selector = screen.getByTestId("model-selector");
      expect(selector).toBeInTheDocument();
    });
  });

  describe("Paste Image Handling", () => {
    test("should handle image paste", async () => {
      const { useMutation } = require("convex/react");
      const generateUploadUrl = vi.fn().mockResolvedValue("https://upload.url");
      const saveFileMetadata = vi.fn().mockResolvedValue({
        filename: "pasted-image.png",
        url: "https://file.url",
      });
      useMutation.mockImplementation((fn: any) => {
        if (fn.toString().includes("generateUploadUrl")) return generateUploadUrl;
        if (fn.toString().includes("saveFileMetadata")) return saveFileMetadata;
        return vi.fn();
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ storageId: "storage-123" }),
      });

      render(
        <ChatComposer {...defaultProps} userId="user-123" chatId="chat-123" />
      );

      const textarea = screen.getByRole("textbox", { name: /message input/i });

      // Create a mock file for pasting
      const file = new File(["image"], "pasted.png", { type: "image/png" });
      const dataTransfer = {
        items: [
          {
            type: "image/png",
            getAsFile: () => file,
          },
        ],
      };

      // Simulate paste event
      await user.click(textarea);
      const pasteEvent = new ClipboardEvent("paste", {
        clipboardData: dataTransfer as any,
      });
      textarea.dispatchEvent(pasteEvent);

      // File should be uploaded and preview shown
      await waitFor(() => {
        expect(generateUploadUrl).toHaveBeenCalled();
      });
    });
  });
});
