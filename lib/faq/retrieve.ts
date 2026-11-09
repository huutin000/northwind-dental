import { FAQ, type FaqEntry } from "./data";

/**
 * HOW SCORING WORKS
 *
 * 1. Clean the question: lower-case it, split it into words, drop filler words
 *    ("what", "do", "you", ...) and cut a plural "s" ("prices" -> "price").
 * 2. For each remaining question word, look at one FAQ entry:
 *      - the word is in the entry's `keywords`        -> worth 1.0 point
 *      - else the word is in the entry's question text -> worth 0.5 points
 *      - else                                          -> worth 0 points
 * 3. Score = points / number of question words. This is always between 0 and 1.
 *    A score of 1 means every word of the question hit a keyword.
 * 4. Sort entries by score (best first). Entries with score 0 are not returned.
 *
 * Worked example: "What time do you open?"
 *    Words after cleaning: "time", "open" ("what", "do", "you" are dropped).
 *    Entry "hours" has the keywords "time" and "open", so 1.0 + 1.0 = 2.0 points.
 *    Score = 2.0 / 2 words = 1.0.
 *    Entry "booking" has neither word anywhere, so it scores 0 and is left out.
 *
 * Worked example (out of scope): "what is the capital of France"
 *    Words after cleaning: "capital", "france". No entry contains either word,
 *    so nothing scores above 0 and the result is empty.
 */

/** Below this top score the question counts as out of scope (not answerable from the FAQ). */
export const OUT_OF_SCOPE_THRESHOLD = 0.35;

export type FaqMatch = { entry: FaqEntry; score: number };

/** Points for a question word found in an entry's keywords. */
const KEYWORD_POINTS = 1;
/** Points for a question word found only in the entry's question text. */
const QUESTION_POINTS = 0.5;

/** Filler words that carry no topic. Words every FAQ shares (clinic, teeth, ...) are included. */
const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "am", "was", "were", "be", "do", "does", "did",
  "i", "you", "your", "my", "me", "we", "our", "it", "its", "of", "to", "in",
  "on", "at", "for", "and", "or", "with", "about", "if", "any", "have", "has",
  "get", "can", "could", "would", "should", "will", "there", "this", "that",
  "what", "how", "when", "where", "which", "who", "please", "tell",
  "clinic", "northwind", "dental", "teeth", "tooth",
]);

/** Cut a trailing plural "s" so "prices" matches "price". Keeps "address" and short words. */
function singular(word: string): string {
  return word.length > 3 && word.endsWith("s") && !word.endsWith("ss")
    ? word.slice(0, -1)
    : word;
}

/** Step 1: text -> list of clean words. Letters and digits of any language count as word characters. */
function toWords(text: string): string[] {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return words.filter((w) => !STOPWORDS.has(w)).map(singular);
}

/** Step 2 and 3: points one entry earns for the question words, divided by the word count. */
function scoreEntry(questionWords: string[], entry: FaqEntry): number {
  const keywordSet = new Set(entry.keywords.flatMap(toWords));
  const questionSet = new Set(toWords(entry.question));

  let points = 0;
  for (const word of questionWords) {
    if (keywordSet.has(word)) points += KEYWORD_POINTS;
    else if (questionSet.has(word)) points += QUESTION_POINTS;
  }
  return points / questionWords.length;
}

/**
 * Return up to `k` best-matching entries, best first. Entries with score 0 are
 * left out, so an empty list means "nothing in the FAQ matches".
 * Ties keep the original order of `entries`, so the result is deterministic.
 */
export function retrieve(
  question: string,
  k: number,
  entries: FaqEntry[] = FAQ,
): FaqMatch[] {
  // A repeated word counts once, so "hours hours hours" cannot inflate a score.
  const questionWords = [...new Set(toWords(question))];
  // Empty text, emoji only, or only filler words: nothing to match.
  if (questionWords.length === 0 || k <= 0) return [];

  return entries
    .map((entry, index) => ({ entry, index, score: scoreEntry(questionWords, entry) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, k)
    .map(({ entry, score }) => ({ entry, score }));
}
