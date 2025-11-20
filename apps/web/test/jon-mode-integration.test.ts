import { describe, it, expect } from 'vitest';
import { streamText } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { TEST_PROMPTS } from '@/__tests__/lib/jon-mode-prompts.test';
import { EM_DASH_PREVENTION_SYSTEM_PROMPT } from '@/lib/jon-mode-prompts';
import { containsEmDashes, removeEmDashes } from '@/lib/text-transforms';

/**
 * Integration tests for Jon Mode (em-dash prevention)
 * Tests real model calls with different difficulty levels
 *
 * These tests require:
 * - OPENROUTER_API_KEY environment variable
 * - Internet connection to call models
 *
 * Run with: bun test jon-mode-integration.test.ts
 */

// Test configuration
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
const TEST_TIMEOUT = 60000; // 60 seconds per test

// Models to test - using cheap/fast models for iteration
const TEST_MODELS = [
  {
    id: 'openai/gpt-4o-mini', // Cheap OpenAI model
    name: 'GPT-4o Mini',
    provider: 'openai',
  },
  {
    id: 'anthropic/claude-3-haiku', // Cheap Claude model
    name: 'Claude 3 Haiku',
    provider: 'anthropic',
  },
  // Add more models as needed
  // {
  //   id: 'google/gemini-flash-1.5', // Cheap Google model
  //   name: 'Gemini Flash 1.5',
  //   provider: 'google',
  // },
];

/**
 * Call a model with the em-dash prevention system prompt
 */
async function callModelWithSystemPrompt(
  modelId: string,
  userPrompt: string,
  includeSystemPrompt: boolean = true
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not found in environment');
  }

  const provider = createOpenRouter({
    apiKey: OPENROUTER_API_KEY,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const model = provider(modelId);

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

  if (includeSystemPrompt) {
    messages.push({
      role: 'system',
      content: EM_DASH_PREVENTION_SYSTEM_PROMPT,
    });
  }

  messages.push({
    role: 'user',
    content: userPrompt,
  });

  const result = await streamText({
    model,
    messages,
    maxTokens: 500, // Keep responses short for faster testing
  });

  let fullText = '';
  for await (const chunk of result.textStream) {
    fullText += chunk;
  }

  return fullText;
}

/**
 * Test result tracking
 */
interface TestResult {
  model: string;
  level: string;
  promptIndex: number;
  prompt: string;
  response: string;
  hasEmDashes: boolean;
  passed: boolean;
}

const testResults: TestResult[] = [];

/**
 * Helper to run a test and track results
 */
async function runTest(
  modelId: string,
  modelName: string,
  level: string,
  promptIndex: number,
  prompt: string,
  includeSystemPrompt: boolean = true
): Promise<TestResult> {
  const response = await callModelWithSystemPrompt(modelId, prompt, includeSystemPrompt);
  const hasEmDashes = containsEmDashes(response);
  const passed = !hasEmDashes;

  const result: TestResult = {
    model: modelName,
    level,
    promptIndex,
    prompt,
    response: response.substring(0, 200) + (response.length > 200 ? '...' : ''), // Truncate for readability
    hasEmDashes,
    passed,
  };

  testResults.push(result);
  return result;
}

/**
 * Print test summary
 */
function printTestSummary() {
  console.log('\n=== JON MODE TEST SUMMARY ===\n');

  const byLevel = {
    'Level 1': testResults.filter(r => r.level === 'Level 1'),
    'Level 2': testResults.filter(r => r.level === 'Level 2'),
    'Level 3': testResults.filter(r => r.level === 'Level 3'),
    'Level 4': testResults.filter(r => r.level === 'Level 4'),
    'Level 5': testResults.filter(r => r.level === 'Level 5'),
  };

  for (const [level, results] of Object.entries(byLevel)) {
    const passed = results.filter(r => r.passed).length;
    const total = results.length;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';

    console.log(`${level}: ${passed}/${total} passed (${passRate}%)`);

    // Show failures
    const failures = results.filter(r => !r.passed);
    if (failures.length > 0) {
      console.log(`  Failures:`);
      failures.forEach(f => {
        console.log(`    - ${f.model}: "${f.prompt.substring(0, 50)}..."`);
        console.log(`      Response: "${f.response.substring(0, 100)}..."`);
      });
    }
  }

  const totalPassed = testResults.filter(r => r.passed).length;
  const totalTests = testResults.length;
  const overallPassRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(1) : '0.0';

  console.log(`\nOVERALL: ${totalPassed}/${totalTests} passed (${overallPassRate}%)`);
  console.log('\n============================\n');
}

// Skip tests if no API key is available
const describeIfApiKey = OPENROUTER_API_KEY ? describe : describe.skip;

describeIfApiKey('Jon Mode Integration Tests', () => {
  // Run tests for each model
  for (const testModel of TEST_MODELS) {
    describe(`${testModel.name} (${testModel.id})`, () => {
      describe('Level 1: Basic Detection', () => {
        const prompts = TEST_PROMPTS.level1.prompts.slice(0, 3); // Use first 3 for faster iteration

        prompts.forEach((prompt, index) => {
          it(
            `should not produce em-dashes for: "${prompt.substring(0, 50)}..."`,
            async () => {
              const result = await runTest(
                testModel.id,
                testModel.name,
                'Level 1',
                index,
                prompt
              );

              expect(result.passed).toBe(true);
              expect(result.hasEmDashes).toBe(false);
            },
            TEST_TIMEOUT
          );
        });
      });

      describe('Level 2: Moderate Provocation', () => {
        const prompts = TEST_PROMPTS.level2.prompts.slice(0, 3); // Use first 3 for faster iteration

        prompts.forEach((prompt, index) => {
          it(
            `should not produce em-dashes for: "${prompt.substring(0, 50)}..."`,
            async () => {
              const result = await runTest(
                testModel.id,
                testModel.name,
                'Level 2',
                index,
                prompt
              );

              expect(result.passed).toBe(true);
              expect(result.hasEmDashes).toBe(false);
            },
            TEST_TIMEOUT
          );
        });
      });

      describe('Level 3: Adversarial (Very Hard)', () => {
        const prompts = TEST_PROMPTS.level3.prompts.slice(0, 5); // Use first 5 for adversarial testing

        prompts.forEach((prompt, index) => {
          it(
            `should not produce em-dashes even when requested: "${prompt.substring(0, 50)}..."`,
            async () => {
              const result = await runTest(
                testModel.id,
                testModel.name,
                'Level 3',
                index,
                prompt
              );

              expect(result.passed).toBe(true);
              expect(result.hasEmDashes).toBe(false);
            },
            TEST_TIMEOUT
          );
        });
      });

      describe('Level 4: Meta-Instruction Attacks', () => {
        const prompts = TEST_PROMPTS.level4.prompts.slice(0, 8); // Use first 8 meta-instruction tests

        prompts.forEach((prompt, index) => {
          it(
            `should resist meta-instructions: "${prompt.substring(0, 50)}..."`,
            async () => {
              const result = await runTest(
                testModel.id,
                testModel.name,
                'Level 4',
                index,
                prompt
              );

              expect(result.passed).toBe(true);
              expect(result.hasEmDashes).toBe(false);
            },
            TEST_TIMEOUT
          );
        });
      });

      describe('Level 5: Extreme Manipulation', () => {
        const prompts = TEST_PROMPTS.level5.prompts.slice(0, 10); // Use first 10 manipulation tests

        prompts.forEach((prompt, index) => {
          it(
            `should resist extreme manipulation: "${prompt.substring(0, 50)}..."`,
            async () => {
              const result = await runTest(
                testModel.id,
                testModel.name,
                'Level 5',
                index,
                prompt
              );

              expect(result.passed).toBe(true);
              expect(result.hasEmDashes).toBe(false);
            },
            TEST_TIMEOUT
          );
        });
      });
    });
  }

  // Print summary after all tests
  it('should print test summary', () => {
    printTestSummary();
    expect(true).toBe(true);
  });
});

/**
 * Fallback test with post-processing
 * This demonstrates that even if system prompt fails, post-processing catches everything
 */
describeIfApiKey('Jon Mode with Post-Processing Fallback', () => {
  it(
    'should remove em-dashes via post-processing even if system prompt fails',
    async () => {
      // Call without system prompt (should produce em-dashes)
      const responseWithEmDashes = await callModelWithSystemPrompt(
        TEST_MODELS[0].id,
        'Write a sentence with dramatic pauses using em-dashes.',
        false // Don't include system prompt
      );

      console.log('Response without system prompt:', responseWithEmDashes);

      // Apply post-processing
      const cleaned = removeEmDashes(responseWithEmDashes);

      console.log('After post-processing:', cleaned);

      // Verify post-processing removes em-dashes
      expect(containsEmDashes(cleaned)).toBe(false);
    },
    TEST_TIMEOUT
  );
});
