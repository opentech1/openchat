import { describe, it, expect } from 'vitest';
import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { EM_DASH_PREVENTION_SYSTEM_PROMPT } from '@/__tests__/lib/jon-mode-prompts.test';
import { containsEmDashes, removeEmDashes } from '@/lib/text-transforms';

/**
 * Simple Jon Mode test - focuses on normal usage
 * Post-processing failsafe should catch anything that slips through
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
const TEST_TIMEOUT = 30000;

// Normal usage prompts - no adversarial attempts
const NORMAL_PROMPTS = [
  'Explain how photosynthesis works.',
  'Write a short story about a robot.',
  'What are the benefits of exercise?',
  'Describe the water cycle.',
  'Give me tips for better sleep.',
];

async function callModel(prompt: string, useJonMode: boolean): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not found');
  }

  const provider = createOpenRouter({
    apiKey: OPENROUTER_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
  });

  const model = provider('openai/gpt-4o-mini');

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (useJonMode) {
    messages.push({
      role: 'system',
      content: EM_DASH_PREVENTION_SYSTEM_PROMPT,
    });
  }

  messages.push({
    role: 'user',
    content: prompt,
  });

  const result = await streamText({
    model,
    messages,
    maxTokens: 300,
  });

  let fullText = '';
  for await (const chunk of result.textStream) {
    // Simulate post-processing like in chat-handler.ts
    const processedChunk = useJonMode ? removeEmDashes(chunk) : chunk;
    fullText += processedChunk;
  }

  return fullText;
}

const describeIfApiKey = OPENROUTER_API_KEY ? describe : describe.skip;

describeIfApiKey('Jon Mode Simple Test', () => {
  it('should prevent em-dashes in normal usage', async () => {
    console.log('\n=== Testing Jon Mode with Normal Prompts ===\n');

    let allPassed = true;
    const results: Array<{ prompt: string; hasEmDashes: boolean; response: string }> = [];

    for (const prompt of NORMAL_PROMPTS) {
      const response = await callModel(prompt, true);
      const hasEmDashes = containsEmDashes(response);

      results.push({
        prompt: prompt.substring(0, 50),
        hasEmDashes,
        response: response.substring(0, 150),
      });

      if (hasEmDashes) {
        allPassed = false;
      }
    }

    // Print results
    console.log('Results:');
    results.forEach((r, i) => {
      const status = r.hasEmDashes ? '❌ FAIL' : '✅ PASS';
      console.log(`${i + 1}. ${status} - "${r.prompt}"`);
      if (r.hasEmDashes) {
        console.log(`   Response: "${r.response}..."`);
      }
    });

    const passedCount = results.filter(r => !r.hasEmDashes).length;
    console.log(`\nResult: ${passedCount}/${results.length} passed\n`);

    expect(allPassed).toBe(true);
  }, TEST_TIMEOUT * NORMAL_PROMPTS.length);

  it('should verify post-processing failsafe works', () => {
    // Test that post-processing removes em-dashes
    const textWithEmDashes = 'This is a test—with em-dashes—in it.';
    const cleaned = removeEmDashes(textWithEmDashes);

    expect(containsEmDashes(textWithEmDashes)).toBe(true);
    expect(containsEmDashes(cleaned)).toBe(false);
    expect(cleaned).toBe('This is a test-with em-dashes-in it.');

    console.log('\n✅ Post-processing failsafe verified\n');
  });
});
