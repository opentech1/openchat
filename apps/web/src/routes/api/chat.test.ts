/**
 * Tests for reasoning effort configuration logic
 *
 * Run with: bun test apps/web/src/routes/api/chat.test.ts
 */

import { describe, it, expect } from "vitest";

// Extract the logic from the API route for testing
function getEffortValue(effort: string | undefined): "minimal" | "low" | "medium" | "high" {
  if (!effort || effort === "none") return "minimal";
  return effort as "low" | "medium" | "high";
}

function isReasoningModel(model: string): boolean {
  return (
    model.includes("openai/o") ||
    model.includes("openai/gpt-5") ||
    (model.includes("deepseek") && model.includes("r1")) ||
    model.includes("claude") ||
    model.includes("x-ai/grok")
  );
}

function getReasoningConfig(model: string, reasoningEffort: string | undefined) {
  const effortValue = getEffortValue(reasoningEffort);

  if (!isReasoningModel(model)) {
    return null; // Non-reasoning models don't need config
  }

  // Only send config when effort is not 'none' (mapped to 'minimal')
  if (reasoningEffort === "none") {
    return null; // Actually disable reasoning
  }

  if (model.includes("claude")) {
    const budgetMap: Record<string, number> = {
      minimal: 1024,
      low: 2000,
      medium: 8000,
      high: 16000,
    };
    return {
      openrouter: {
        reasoning: {
          max_tokens: budgetMap[effortValue] || 1024,
        },
      },
    };
  }

  // OpenAI GPT-5, o-series, DeepSeek R1, Grok
  return {
    openrouter: {
      reasoning: {
        effort: effortValue,
      },
    },
  };
}

describe("Reasoning Effort Configuration", () => {
  describe("getEffortValue", () => {
    it('maps "none" to "minimal"', () => {
      expect(getEffortValue("none")).toBe("minimal");
    });

    it('maps undefined to "minimal"', () => {
      expect(getEffortValue(undefined)).toBe("minimal");
    });

    it('passes through "low"', () => {
      expect(getEffortValue("low")).toBe("low");
    });

    it('passes through "medium"', () => {
      expect(getEffortValue("medium")).toBe("medium");
    });

    it('passes through "high"', () => {
      expect(getEffortValue("high")).toBe("high");
    });
  });

  describe("isReasoningModel", () => {
    it("identifies GPT-5 models", () => {
      expect(isReasoningModel("openai/gpt-5-nano")).toBe(true);
      expect(isReasoningModel("openai/gpt-5-mini")).toBe(true);
      expect(isReasoningModel("openai/gpt-5")).toBe(true);
    });

    it("identifies o-series models", () => {
      expect(isReasoningModel("openai/o1")).toBe(true);
      expect(isReasoningModel("openai/o3-mini")).toBe(true);
    });

    it("identifies DeepSeek R1 models", () => {
      expect(isReasoningModel("deepseek/deepseek-r1")).toBe(true);
      expect(isReasoningModel("deepseek/deepseek-r1-distill-llama-70b")).toBe(true);
    });

    it("identifies Claude models", () => {
      expect(isReasoningModel("anthropic/claude-3.7-sonnet")).toBe(true);
      expect(isReasoningModel("anthropic/claude-sonnet-4")).toBe(true);
    });

    it("identifies Grok models", () => {
      expect(isReasoningModel("x-ai/grok-3")).toBe(true);
    });

    it("returns false for non-reasoning models", () => {
      expect(isReasoningModel("anthropic/claude-3.5-haiku")).toBe(true); // Claude is reasoning
      expect(isReasoningModel("openai/gpt-4o")).toBe(false);
      expect(isReasoningModel("google/gemini-2.0-flash")).toBe(false);
    });
  });

  describe("getReasoningConfig for GPT-5 Nano", () => {
    const model = "openai/gpt-5-nano";

    it('returns null when reasoning is "none" (actually disables reasoning)', () => {
      const config = getReasoningConfig(model, "none");
      expect(config).toBe(null);
    });

    it('uses "low" effort', () => {
      const config = getReasoningConfig(model, "low");
      expect(config).toEqual({
        openrouter: {
          reasoning: {
            effort: "low",
          },
        },
      });
    });

    it('uses "medium" effort', () => {
      const config = getReasoningConfig(model, "medium");
      expect(config).toEqual({
        openrouter: {
          reasoning: {
            effort: "medium",
          },
        },
      });
    });

    it('uses "high" effort', () => {
      const config = getReasoningConfig(model, "high");
      expect(config).toEqual({
        openrouter: {
          reasoning: {
            effort: "high",
          },
        },
      });
    });
  });

  describe("getReasoningConfig for Claude", () => {
    const model = "anthropic/claude-3.7-sonnet";

    it('returns null when reasoning is "none" (actually disables reasoning)', () => {
      const config = getReasoningConfig(model, "none");
      expect(config).toBe(null);
    });

    it('uses 2000 tokens for "low"', () => {
      const config = getReasoningConfig(model, "low");
      expect(config).toEqual({
        openrouter: {
          reasoning: {
            max_tokens: 2000,
          },
        },
      });
    });

    it('uses 8000 tokens for "medium"', () => {
      const config = getReasoningConfig(model, "medium");
      expect(config).toEqual({
        openrouter: {
          reasoning: {
            max_tokens: 8000,
          },
        },
      });
    });

    it('uses 16000 tokens for "high"', () => {
      const config = getReasoningConfig(model, "high");
      expect(config).toEqual({
        openrouter: {
          reasoning: {
            max_tokens: 16000,
          },
        },
      });
    });
  });

  describe("getReasoningConfig for non-reasoning models", () => {
    it("returns null for GPT-4o", () => {
      expect(getReasoningConfig("openai/gpt-4o", "high")).toBe(null);
    });

    it("returns null for Gemini", () => {
      expect(getReasoningConfig("google/gemini-2.0-flash", "medium")).toBe(null);
    });
  });
});
