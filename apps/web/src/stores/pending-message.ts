/**
 * Pending Message Store
 *
 * Temporarily stores a message when creating a new chat, so we can:
 * 1. Create the chat
 * 2. Navigate immediately to /c/{chatId}
 * 3. Auto-send the message from the new page (where useChat uses the correct id)
 *
 * This ensures streaming works seamlessly across navigation because
 * the useChat hook on the new page uses id={chatId} from the start.
 */

import { create } from "zustand";

interface ChatFileAttachment {
  type: "file";
  mediaType: string;
  filename?: string;
  url: string;
}

interface PendingMessage {
  chatId: string;
  text: string;
  files?: Array<ChatFileAttachment>;
}

interface PendingMessageStore {
  pending: PendingMessage | null;
  set: (message: PendingMessage) => void;
  clear: () => void;
  consume: (chatId: string) => PendingMessage | null;
}

export const usePendingMessageStore = create<PendingMessageStore>((set, get) => ({
  pending: null,

  set: (message) => set({ pending: message }),

  clear: () => set({ pending: null }),

  // Get and clear the pending message if it matches the chatId
  consume: (chatId) => {
    const { pending } = get();
    if (pending && pending.chatId === chatId) {
      set({ pending: null });
      return pending;
    }
    return null;
  },
}));
