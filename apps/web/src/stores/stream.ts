/**
 * Stream State Machine - Clean, predictable streaming state
 *
 * This replaces the fragmented state from the old codebase:
 * - activeStreamId, isConvexStreaming, redisStreamId, manuallyStopped, isStoppedRef
 *
 * Now we have ONE source of truth with clear state transitions.
 *
 * RESUMABLE STREAMING:
 * When a stream is active, we persist {chatId, streamId, lastEventId, content}
 * to localStorage. On page reload, we can resume from Redis SSE endpoint.
 */

import { create } from "zustand";
import { devtools, persist, createJSONStorage } from "zustand/middleware";

export type StreamStatus = "idle" | "connecting" | "streaming" | "stopping" | "error" | "resuming";

interface ActiveStream {
  chatId: string;
  messageId: string;
  streamId: string;
  lastEventId: string;
  content: string;
  reasoning: string;
  startedAt: number;
}

interface StreamState {
  // Current stream state
  status: StreamStatus;
  convexStreamId: string | null;
  redisStreamId: string | null;
  error: string | null;

  // Current message being streamed
  activeMessageId: string | null;
  content: string;
  reasoning: string;

  // Resumable stream data (persisted to localStorage)
  activeStream: ActiveStream | null;

  // Actions
  startStream: (convexStreamId: string, messageId: string) => void;
  setRedisStreamId: (id: string, chatId: string) => void;
  appendContent: (chunk: string) => void;
  appendReasoning: (chunk: string) => void;
  updateLastEventId: (eventId: string) => void;
  completeStream: () => void;
  stopStream: () => void;
  errorStream: (error: string) => void;
  setResuming: () => void;
  reset: () => void;
  getActiveStreamForChat: (chatId: string) => ActiveStream | null;
}

const initialState = {
  status: "idle" as StreamStatus,
  convexStreamId: null,
  redisStreamId: null,
  error: null,
  activeMessageId: null,
  content: "",
  reasoning: "",
  activeStream: null,
};

export const useStreamStore = create<StreamState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        startStream: (convexStreamId, messageId) =>
          set(
            {
              status: "connecting",
              convexStreamId,
              activeMessageId: messageId,
              content: "",
              reasoning: "",
              error: null,
            },
            false,
            "stream/start",
          ),

        setRedisStreamId: (id, chatId) =>
          set(
            (state) => ({
              redisStreamId: id,
              status: "streaming",
              activeStream: {
                chatId,
                messageId: state.activeMessageId || "",
                streamId: id,
                lastEventId: "0",
                content: state.content,
                reasoning: state.reasoning,
                startedAt: Date.now(),
              },
            }),
            false,
            "stream/redis",
          ),

        appendContent: (chunk) =>
          set(
            (state) => ({
              content: state.content + chunk,
              activeStream: state.activeStream
                ? { ...state.activeStream, content: state.activeStream.content + chunk }
                : null,
            }),
            false,
            "stream/content",
          ),

        appendReasoning: (chunk) =>
          set(
            (state) => ({
              reasoning: state.reasoning + chunk,
              activeStream: state.activeStream
                ? { ...state.activeStream, reasoning: state.activeStream.reasoning + chunk }
                : null,
            }),
            false,
            "stream/reasoning",
          ),

        updateLastEventId: (eventId) =>
          set(
            (state) => ({
              activeStream: state.activeStream
                ? { ...state.activeStream, lastEventId: eventId }
                : null,
            }),
            false,
            "stream/lastEventId",
          ),

        completeStream: () =>
          set(
            {
              status: "idle",
              convexStreamId: null,
              redisStreamId: null,
              activeMessageId: null,
              activeStream: null,
            },
            false,
            "stream/complete",
          ),

        stopStream: () =>
          set({ status: "stopping", activeStream: null }, false, "stream/stop"),

        errorStream: (error) =>
          set(
            {
              status: "error",
              error,
              convexStreamId: null,
              redisStreamId: null,
              activeStream: null,
            },
            false,
            "stream/error",
          ),

        setResuming: () => set({ status: "resuming" }, false, "stream/resuming"),

        reset: () => set(initialState, false, "stream/reset"),

        getActiveStreamForChat: (chatId) => {
          const stream = get().activeStream;
          if (!stream) return null;
          if (stream.chatId !== chatId) return null;
          // Expire streams older than 10 minutes
          if (Date.now() - stream.startedAt > 10 * 60 * 1000) {
            set({ activeStream: null }, false, "stream/expired");
            return null;
          }
          return stream;
        },
      }),
      {
        name: "openchat-stream",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          activeStream: state.activeStream,
        }),
      },
    ),
    { name: "stream-store" },
  ),
);

export const useIsStreaming = () =>
  useStreamStore(
    (s) => s.status === "streaming" || s.status === "connecting" || s.status === "resuming",
  );

export const useStreamContent = () =>
  useStreamStore((s) => ({ content: s.content, reasoning: s.reasoning }));

export const useStreamError = () => useStreamStore((s) => s.error);

export const useActiveStream = () => useStreamStore((s) => s.activeStream);
