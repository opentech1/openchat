/**
 * Chat State Management
 *
 * A reducer-based state management pattern for the chat component.
 * Centralizes all chat-related UI state and provides type-safe actions
 * for state mutations.
 *
 * @module lib/chat/chat-state
 */

/**
 * Represents a file attachment in the chat.
 */
export interface Attachment {
  /** Unique identifier for the attachment */
  id: string;
  /** Display name of the file */
  name: string;
  /** MIME type of the file */
  type: string;
  /** URL to access the file (can be blob URL or remote URL) */
  url: string;
  /** File size in bytes (optional) */
  size?: number;
}

/**
 * The complete state shape for the chat component.
 * Contains all UI-related state that needs to be tracked.
 */
export interface ChatState {
  /** Whether the user has submitted at least one message */
  hasSubmitted: boolean;
  /** Whether the user has manually scrolled (disables auto-scroll) */
  hasManuallyScrolled: boolean;
  /** Whether the upgrade dialog is currently displayed */
  showUpgradeDialog: boolean;
  /** Whether the sign-in prompt is currently displayed */
  showSignInPrompt: boolean;
  /** Whether the command palette dialog is open */
  commandDialogOpen: boolean;
  /** AI-generated suggested follow-up questions */
  suggestedQuestions: string[];
  /** List of file attachments pending or sent with the message */
  attachments: Attachment[];
  /** Current visibility setting for the chat */
  selectedVisibilityType: "public" | "private";
  /** Whether the AI is currently streaming a response */
  isStreaming: boolean;
  /** The ID of the currently active stream (null if not streaming) */
  activeStreamId: string | null;
  /** Whether the user manually stopped the current stream */
  manuallyStopped: boolean;
}

/**
 * Union type of all possible actions that can be dispatched to the chat reducer.
 * Each action has a `type` discriminant and optional `payload`.
 */
export type ChatAction =
  | { type: "SET_HAS_SUBMITTED"; payload: boolean }
  | { type: "SET_HAS_MANUALLY_SCROLLED"; payload: boolean }
  | { type: "SET_SHOW_UPGRADE_DIALOG"; payload: boolean }
  | { type: "SET_SHOW_SIGN_IN_PROMPT"; payload: boolean }
  | { type: "SET_COMMAND_DIALOG_OPEN"; payload: boolean }
  | { type: "SET_SUGGESTED_QUESTIONS"; payload: string[] }
  | { type: "SET_ATTACHMENTS"; payload: Attachment[] }
  | { type: "ADD_ATTACHMENT"; payload: Attachment }
  | { type: "REMOVE_ATTACHMENT"; payload: string }
  | { type: "SET_VISIBILITY"; payload: "public" | "private" }
  | { type: "SET_STREAMING"; payload: boolean }
  | { type: "SET_ACTIVE_STREAM_ID"; payload: string | null }
  | { type: "SET_MANUALLY_STOPPED"; payload: boolean }
  | { type: "START_STREAM"; payload: string }
  | { type: "STOP_STREAM" }
  | { type: "RESET_UI_STATE" };

/**
 * The main reducer function for chat state management.
 * Handles all state transitions based on dispatched actions.
 *
 * @param state - The current chat state
 * @param action - The action to process
 * @returns The new state after applying the action
 *
 * @example
 * ```tsx
 * const [state, dispatch] = useReducer(chatReducer, createInitialState());
 *
 * // Update a single field
 * dispatch({ type: 'SET_HAS_SUBMITTED', payload: true });
 *
 * // Start a stream with compound action
 * dispatch({ type: 'START_STREAM', payload: streamId });
 *
 * // Reset UI state
 * dispatch({ type: 'RESET_UI_STATE' });
 * ```
 */
export const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
  switch (action.type) {
    case "SET_HAS_SUBMITTED":
      return { ...state, hasSubmitted: action.payload };

    case "SET_HAS_MANUALLY_SCROLLED":
      return { ...state, hasManuallyScrolled: action.payload };

    case "SET_SHOW_UPGRADE_DIALOG":
      return { ...state, showUpgradeDialog: action.payload };

    case "SET_SHOW_SIGN_IN_PROMPT":
      return { ...state, showSignInPrompt: action.payload };

    case "SET_COMMAND_DIALOG_OPEN":
      return { ...state, commandDialogOpen: action.payload };

    case "SET_SUGGESTED_QUESTIONS":
      return { ...state, suggestedQuestions: action.payload };

    case "SET_ATTACHMENTS":
      return { ...state, attachments: action.payload };

    case "ADD_ATTACHMENT":
      return { ...state, attachments: [...state.attachments, action.payload] };

    case "REMOVE_ATTACHMENT":
      return {
        ...state,
        attachments: state.attachments.filter((a) => a.id !== action.payload),
      };

    case "SET_VISIBILITY":
      return { ...state, selectedVisibilityType: action.payload };

    case "SET_STREAMING":
      return { ...state, isStreaming: action.payload };

    case "SET_ACTIVE_STREAM_ID":
      return { ...state, activeStreamId: action.payload };

    case "SET_MANUALLY_STOPPED":
      return { ...state, manuallyStopped: action.payload };

    case "START_STREAM":
      // Compound action: sets streaming state, stream ID, and resets manual stop flag
      return {
        ...state,
        isStreaming: true,
        activeStreamId: action.payload,
        manuallyStopped: false,
      };

    case "STOP_STREAM":
      // Compound action: clears streaming state and stream ID
      return {
        ...state,
        isStreaming: false,
        activeStreamId: null,
      };

    case "RESET_UI_STATE":
      // Resets transient UI state while preserving persistent settings
      return {
        ...state,
        hasSubmitted: false,
        suggestedQuestions: [],
        attachments: [],
        isStreaming: false,
        activeStreamId: null,
        manuallyStopped: false,
      };

    default:
      return state;
  }
};

/**
 * Creates the initial state for the chat reducer.
 * Allows overriding specific fields for testing or specific use cases.
 *
 * @param overrides - Optional partial state to merge with defaults
 * @returns A complete ChatState object with all fields initialized
 *
 * @example
 * ```tsx
 * // Default initial state
 * const initialState = createInitialState();
 *
 * // With overrides for a public chat
 * const publicChatState = createInitialState({
 *   selectedVisibilityType: 'public',
 *   hasSubmitted: true,
 * });
 *
 * // Usage with useReducer
 * const [state, dispatch] = useReducer(chatReducer, createInitialState());
 * ```
 */
export const createInitialState = (overrides?: Partial<ChatState>): ChatState => ({
  hasSubmitted: false,
  hasManuallyScrolled: false,
  suggestedQuestions: [],
  attachments: [],
  showUpgradeDialog: false,
  showSignInPrompt: false,
  commandDialogOpen: false,
  selectedVisibilityType: "private",
  isStreaming: false,
  activeStreamId: null,
  manuallyStopped: false,
  ...overrides,
});
