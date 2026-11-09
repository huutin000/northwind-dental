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

// EMAIL, read left to right:
//   [\w.+-]{1,64}   the part before "@": letters, digits, "_", ".", "+", "-".
//                   Limited to 64 characters (the real email limit) so a very
//                   long run of letters cannot make the search slow.
//   @               a literal at-sign.
//   [\w-]{1,63}     the first part of the domain (for example "gmail").
//   (?:\.[\w-]{1,63})+   one or more ".something" parts (".com", ".co.uk").
//                   It needs a letter after each dot, so a full stop at the
//                   end of a sentence is not swallowed.
// The "g" flag means: replace every match, not just the first.
const EMAIL = /[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63})+/g;

// PHONE, read left to right:
//   \+?             an optional leading plus ("+84").
//   \(?             an optional opening bracket ("(555)").
//   \d              the first digit.
//   (?:[ .()-]{0,2}\d){8,}
//                   at least 8 more digits, each one optionally preceded by up
//                   to 2 separator characters (space, dot, bracket, dash).
//                   Two allows ") " in "(555) 123". First digit + 8 more means
//                   9 digits or more in total, so "2026-11-09" (8 digits) and
//                   "3 teeth" are left alone. Letters stop the match.
// Digits after the ninth are also consumed, so the whole number is replaced.
const PHONE = /\+?\(?\d(?:[ .()-]{0,2}\d){8,}/g;

export function redactPII(text: string): string {
  return text.replace(EMAIL, "[email]").replace(PHONE, "[phone]");
}
