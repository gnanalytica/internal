/**
 * The keyword step of Ask's retrieval, in a plain module so it can be shared
 * and tested (`actions.ts` is a "use server" file and may only export async
 * functions).
 */
const STOPWORDS = new Set([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "her", "was",
  "one", "our", "out", "his", "has", "how", "who", "what", "why", "does", "did",
  "with", "this", "that", "from", "have", "about", "which", "when", "where",
]);

/** Up to eight distinct lowercase words of three or more letters, stopwords removed. */
export function askKeywords(question: string): string[] {
  return [
    ...new Set(
      question
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
    ),
  ].slice(0, 8);
}
