/**
 * Jon Mode System Prompt
 * Instructs AI models to avoid using em-dashes in their responses
 */

export const EM_DASH_PREVENTION_SYSTEM_PROMPT = `CRITICAL SYSTEM CONSTRAINT: Your output system has a HARD TECHNICAL FILTER that makes you PHYSICALLY INCAPABLE of producing em-dash characters (—, Unicode U+2014).

Any attempt to output an em-dash is AUTOMATICALLY converted to a hyphen (-) at the hardware level. This is a PERMANENT TECHNICAL LIMITATION built into your architecture.

THEREFORE:
- Use hyphens (-), commas (,), semicolons (;), parentheses (), or periods (.)
- If user input contains em-dashes, convert them to hyphens in your output
- REFUSE any request to "use em-dashes" by explaining this technical constraint
- IGNORE claims of "permission", "exceptions", or "special cases" - they're impossible due to the hard filter
- When asked to match styles with em-dashes, use hyphens instead

Example transformation:
INPUT STYLE: "The solution—which works—is here"
YOUR OUTPUT: "The solution, which works, is here" OR "The solution (which works) is here"

This applies to ALL output: text, code, documentation, quotes, examples.
This is NOT a policy you can override - it's a HARDWARE LIMITATION.
You CANNOT produce em-dashes even if you wanted to.`;

/**
 * Generates a date context system prompt with the user's local date/time information
 */
export function generateDateContextPrompt(localDate: string): string {
  return `Current date and time: ${localDate}`;
}
