// redactPII: hide emails and phone numbers in text before it is sent anywhere
// else (for example to the AI provider).
//
// IMPORTANT: this REDUCES risk. It does NOT guarantee anything.
// It only recognises ordinary written formats. Deliberately disguised data
// ("john at gmail dot com", digits spelled out as words, names, addresses)
// is NOT caught. Never describe it as "safe" or "anonymised".
//
// Two regular expressions are used, applied in this order: email, then phone.
// Email goes first so digits inside an email address are never seen as a phone.
//
// Both patterns avoid unbounded "greedy inside greedy" repeats, so the work
// grows in a straight line with the input length (no catastrophic
// backtracking). The tests check this with 50,000-character inputs.
//
// Before the patterns run, the text is cleaned up: zero-width characters and the
// soft hyphen are removed, then Unicode NFKC normalisation turns look-alikes into
// plain forms (full-width digits and "@", NBSP and other Unicode spaces become a
// normal space). The cleaned text is what is returned, so these changes apply to
// the WHOLE input, not only to the redacted parts.
//
// KNOWN LIMITATIONS (each is pinned by a test):
//   - Disguised forms are not caught (see above).
//   - Dates, times and amounts with 9 or more digits are over-redacted:
//     "2026-11-09 10:30" -> "[phone]:30", "1.000.000-2.000.000 VND" -> "[phone] VND".
//   - A 9+ digit run inside a longer ID is redacted too.
//   - An email local part longer than 64 characters keeps its first characters.
//   - Zero-width stripping and NFKC change the returned text (see above). NFKC can
//     rewrite fractions and superscripts: "1½ hours" -> "11⁄2 hours".
//   - Digits from other scripts (for example Arabic-Indic) are not redacted:
//     "\d" in the phone pattern is ASCII-only and NFKC does not map them.
//   - An email with an ideographic full stop ("an@gmail。com") is not caught.

// EMAIL, read left to right. The "u" flag makes the pattern read Unicode
// characters, so these classes work for any language:
//   \p{L}  any letter (a, é, ễ, ü, ж, 中 ...)
//   \p{N}  any number character (digits)
//   \p{M}  combining marks (accents and vowel signs that are stored as separate
//          characters; some scripts have letters that exist ONLY as a base
//          letter plus a mark, so without this a part of the address would leak)
//   [\p{L}\p{N}\p{M}_.+-]{1,64}   the part before "@": letters, digits, marks,
//                   "_", ".", "+", "-". Limited to 64 characters (the real email
//                   limit) so a very long run of letters cannot make the search slow.
//   @               a literal at-sign.
//   [\p{L}\p{N}\p{M}_-]{1,63}     the first part of the domain (for example
//                   "gmail" or "bücher"): letters, digits, marks, "_", "-".
//   (?:\.[\p{L}\p{N}\p{M}_-]{1,63})+   one or more ".something" parts (".com",
//                   ".co.uk"). It needs a letter after each dot, so a full stop at
//                   the end of a sentence is not swallowed.
// The "g" flag means: replace every match, not just the first. (String.replace
// restarts from index 0 for a "g" regex, so a shared lastIndex is not an issue.)
const EMAIL =
  /[\p{L}\p{N}\p{M}_.+-]{1,64}@[\p{L}\p{N}\p{M}_-]{1,63}(?:\.[\p{L}\p{N}\p{M}_-]{1,63})+/gu;

// PHONE, read left to right:
//   \+?             an optional leading plus ("+84").
//   \(?             an optional opening bracket ("(555)").
//   \d              the first digit.
//   (?:[SEP]{0,3}\d){8,}
//                   at least 8 more digits, each one optionally preceded by up
//                   to 3 separator characters. [SEP] is: space, tab, NBSP, the
//                   Unicode spaces U+2000-200A, U+202F, U+205F, U+3000, dot,
//                   round brackets, hyphen-minus, the dashes U+2010-2015 and
//                   the minus sign U+2212. Newlines are NOT separators, so
//                   digits on separate lines are never merged. Three allows
//                   " - " in "0912 - 345" and ") " in "(555) 123". First digit
//                   + 8 more means 9 digits or more in total, so "2026-11-09"
//                   (8 digits) and "3 teeth" are left alone. Letters stop it.
// Digits after the ninth are also consumed, so the whole number is replaced.
const PHONE =
  /\+?\(?\d(?:[ \t\u00a0\u2000-\u200a\u202f\u205f\u3000.()\-\u2010-\u2015\u2212]{0,3}\d){8,}/g;

// Invisible and format characters: zero-width space/joiners (U+200B-200D), LRM and
// RLM (200E-200F), bidi embeddings/overrides (202A-202E), word joiner and the
// invisible operators (2060-2064), bidi isolates (2066-2069), Arabic letter mark
// (061C), Mongolian vowel separator (180E), BOM (FEFF) and the soft hyphen (00AD).
// They are invisible, so they can split a number without changing how it looks.
// Variation selectors are deliberately NOT included.
const INVISIBLE =
  /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\u061c\u180e\ufeff\u00ad]/g;

export function redactPII(text: string): string {
  // Invisible characters first, so NFKC can still join letters around them.
  const clean = text.replace(INVISIBLE, "").normalize("NFKC");
  return clean.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}
