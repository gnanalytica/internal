/**
 * The Ask prompt, in a plain module rather than beside `askContext`.
 *
 * `actions.ts` is a `"use server"` file, and Next allows only async exports
 * from one — a const and a synchronous function there fail the build with
 * "Server Actions must be async functions". `tsc` does not see this; the build
 * is the only thing that does.
 */
export const ASK_SYSTEM =
  "You answer questions about a team's workspace using ONLY the provided docs and issues. " +
  "Be concise. If the context doesn't contain the answer, say so. Don't invent facts.";

export function askPrompt(question: string, blocks: string[]): string {
  return `Question: ${question}\n\nContext:\n\n${blocks.join("\n\n---\n\n").slice(0, 14000)}`;
}
