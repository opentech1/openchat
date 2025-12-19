/**
 * Stream State Machine - Clean, predictable streaming state
 *
 * This replaces the fragmented state from the old codebase:
 * - activeStreamId, isConvexStreaming, redisStreamId, manuallyStopped, isStoppedRef
 *
 * Now we have ONE source of truth with clear state transitions.
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

export type StreamStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "stopping"
  | "error";

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

  // Actions
  startStream: (convexStreamId: string, messageId: string) => void;
  setRedisStreamId: (id: string) => void;
  appendContent: (chunk: string) => void;
  appendReasoning: (chunk: string) => void;
  completeStream: () => void;
  stopStream: () => void;
  errorStream: (error: string) => void;
  reset: () => void;
}

const initialState = {
  status: "idle" as StreamStatus,
  convexStreamId: null,
  redisStreamId: null,
  error: null,
  activeMessageId: null,
  content: "",
  reasoning: "",
};

export const useStreamStore = create<StreamState>()(
  devtools(
    (set) => ({
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
          "stream/start"
        ),

      setRedisStreamId: (id) =>
        set({ redisStreamId: id, status: "streaming" }, false, "stream/redis"),

      appendContent: (chunk) =>
        set(
          (state) => ({ content: state.content + chunk }),
          false,
          "stream/content"
        ),

      appendReasoning: (chunk) =>
        set(
          (state) => ({ reasoning: state.reasoning + chunk }),
          false,
          "stream/reasoning"
        ),

      completeStream: () =>
        set(
          {
            status: "idle",
            convexStreamId: null,
            redisStreamId: null,
            activeMessageId: null,
          },
          false,
          "stream/complete"
        ),

      stopStream: () =>
        set({ status: "stopping" }, false, "stream/stop"),

      errorStream: (error) =>
        set(
          {
            status: "error",
            error,
            convexStreamId: null,
            redisStreamId: null,
          },
          false,
          "stream/error"
        ),

      reset: () => set(initialState, false, "stream/reset"),
    }),
    { name: "stream-store" }
  )
);

// Selector hooks for optimized re-renders
export const useIsStreaming = () =>
  useStreamStore((s) => s.status === "streaming" || s.status === "connecting");

export const useStreamContent = () =>
  useStreamStore((s) => ({ content: s.content, reasoning: s.reasoning }));

export const useStreamError = () => useStreamStore((s) => s.error);
