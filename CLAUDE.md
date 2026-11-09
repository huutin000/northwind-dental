# Northwind Dental — project rules (standing)

Project role: dev
Spec and plan: `doc/northwind-dental-HANDOFF.md` (Vietnamese). Owner: Hữu Tín. Replies to the owner are in Vietnamese; everything written into this repo is English.

## UI work: always use the frontend-design skill
- Every UI task (pages, components, layout, colors, images, illustrations) MUST use the skill `frontend-design:frontend-design`.
- Get the exact skill name from the skill list (`/skills`) and invoke it BEFORE writing any UI code. If it is not available, stop and report BLOCKED; do not write UI code without it.

## Color and design tokens
- Dominant tone: sky blue. Primary buttons use `sky-700` (#0369a1) or darker so white text reaches a contrast of at least 4.5:1. Light backgrounds use `sky-50`.
- Declare colors once as design tokens (CSS variables / the Tailwind `@theme` block in `app/globals.css`). Do not scatter raw hex codes through components.
- Verify contrast ratios by calculation or tooling and report them as measured, not assumed.
- Accepted exception to "no raw hex": `app/opengraph-image.tsx` and `app/icon.svg` keep raw hex values because they render outside the page CSS and cannot read the tokens. Each file must carry a comment pointing to the `@theme` block in `app/globals.css` with a name-to-hex mapping, and its hex values must equal the token values.

## Images and illustrations
- Illustrations are hand-written SVG that follows the palette above. No photos of real people. No new dependencies (no icon packs, no image libraries).
- Every image has meaningful `alt` text. Purely decorative images and SVGs use `aria-hidden="true"` (and empty `alt` for `<img>`).

## ChatWidget performance (Task 7)
- `ChatWidget` must be lazy-loaded: only the toggle button ships in the initial bundle; the chat UI and its logic load when the user opens the widget (e.g. `next/dynamic` or a dynamic `import()` on first open).
- After Task 7, re-measure Lighthouse (Performance, Accessibility, SEO, mobile, home page, 3 runs, pinned `lighthouse@13.5.0` or newer pinned version) and report the real numbers against the M1 baseline. Do not claim "no regression" without the measurement.

## Copy rules
- No medical, safety or outcome claims in site copy (safe, painless, guaranteed, best, cure, permanent, and similar). Describe what a visit involves, not what it achieves. No invented numbers, ratings, testimonials or photos of real people.

## Tools before manual work
- Before asking the owner to do something by hand, check whether an available tool, MCP server or skill can do it (example: `chrome-devtools` for Lighthouse and screenshots; the CLI is run through `npx --package chrome-devtools-mcp@1.12.0 chrome-devtools ...` with `--no-usage-statistics --no-performance-crux`).
- If a task is something Claude cannot do, or does poorly: use the `find-skills` skill to look for a suitable skill. Do NOT install anything on your own. Give the owner a list with: skill name, source, what it does, install command, risks. Wait for approval, then install at project scope only (no `-g`) and use it.

## Standing rules (unchanged)
- Never `git commit`, `git push`, merge or deploy without the owner's explicit approval. Commit steps in the plan are only a proposed message.
- No dependencies beyond: Next.js, React, TypeScript, Tailwind, ESLint, Vitest, Playwright. The only exception is the key-value store client in Task 8, added only after the owner approves the provider.
- Write PASS only after the command was actually run and its real result seen. Say what was not run.
- Never read, print, log or commit secrets. Do not read or name the owner's local env file in commands (a hook blocks it; do not work around the hook). No message or email content in logs.
- Stop at every GATE (M0–M6) and report in Vietnamese.

## Accepted risks (owner decision)
- `npm audit` reports 8 moderate vulnerabilities, all in devDependencies (`eslint-config-next` -> `typescript-eslint` -> `minimatch`, advisory GHSA-g3hv-75wg-m249). Production tree: 0. The owner knowingly accepts this. Do NOT run `npm audit fix` and do NOT downgrade `eslint-config-next` (the only suggested fix is a major downgrade to 15.5.29). Report any NEW vulnerability introduced by a new dependency; it is not covered by this acceptance.

## Small follow-ups (UI polish pass later, not now)
- FAQ accordion on desktop: when a `<details>` is open and focused, the answer sits about 8px below the focus ring and looks cramped. Add spacing in the later UI pass.
- `metadataBase` is not set (build warning). Set it at deploy time in M6.
- FAQ data must keep the reworded answers (children's dentistry, filling aftercare). The `hours` answer is built as a fixed prefix plus `clinic.hoursSummary` from `components/clinic.ts` and must always contain that string verbatim (one source of truth, pinned by a test).
- README "Limitations" (Task 13) must state plainly, without the word "guarantee": the PII filter reduces risk but is not complete (disguised forms such as "john at gmail dot com", names and addresses are not caught; dates, times and amounts with 9+ digits are over-redacted; a local part longer than 64 characters leaves its first characters; 9+ digit runs inside longer IDs are redacted; digits from other scripts and an ideographic full stop in an email are not caught; in scripts written without spaces (for example Chinese) an email can swallow up to 64 letters before the "@" (over-redaction); NFKC normalisation and invisible-character stripping change the text, for example "1½" becomes "11⁄2"); FAQ retrieval is keyword-based, so some off-topic questions that share a word with the FAQ (for example "what is the price of bitcoin") can still reach the model, which is why the system prompt must also refuse off-topic questions; the in-memory rate limiter is per instance and best-effort (fails open when its key cap is reached).

## Deferred MINOR findings (final M2 review, verdict APPROVE; fix in a later pass)
- retrieve: splitting negative contractions leaves stems that are not stopwords (`don`, `doesn`, `isn`, `aren`, `won`, `didn`, `haven`, `wouldn`, plus "why"). Example: "Why doesn't the clinic open on Sundays?" scores 1/3 = 0.333 (< 0.35) and would be refused as out of scope. Fix: add those stems and "why" to `STOPWORDS` and add a fixture row for that question.
- redactPII: because the email local part accepts `\p{L}`, in scripts written without spaces (for example Chinese) it can swallow up to 64 letters before the "@": "请发到abc@x.com" becomes "[email]" (over-redaction, nothing leaks). Add it to the `redactPII.ts` header and pin it with a test. It is already in the README "Limitations" list below.
- tests: no test covers U+FEFF, U+2060, U+200C/D and U+202B-202D in `INVISIBLE`; removing U+FEFF would still pass. Add rows for them.
- `doc/northwind-dental-HANDOFF.md` still names `vitest.config.ts` (now `vitest.config.mts`); the doc is untracked and is the owner's file, so only mention it.

## Known limitation (accepted by the owner): date/time over-redaction
- `redactPII` treats any run of 9 or more digits with separators as a phone number, so dates, times and amounts are over-redacted. Example: "Can I come 2026-11-09 10:30?" reaches `retrieve` and the model as "Can I come [phone]:30?" (pinned by a test, not changed). Booking questions that carry a date plus a time lose that part. Over-redacting is preferred to leaking a phone number.

## Notes for Task 11 (@live Playwright scenario)
- Besides the in-scope question and the prompt-injection question, the `@live` scenario must send two off-topic questions that the keyword retriever lets through: "what is the price of bitcoin" and "what time is it in Tokyo". Expected: the chatbot REFUSES (a polite refusal that it can only help with the clinic's services, hours, booking, costs, preparation and aftercare, optionally suggesting to leave contact details); the reply must not contain a price or a time. Run by hand with a real key, never in CI.

## Notes for Task 6 and Task 9 (from the M2 review)
- HARD REQUIREMENT for Task 6: the chat system prompt must itself instruct the model to refuse off-topic (non-clinic) questions. The retrieve threshold is only a first filter and must never be the only defence.
- Prefix rate-limit keys by purpose (`chat:<sessionId>`, `lead:<sessionId>`) so the chat limit (20 / 10 min) and the lead limit (3 / session) never share one counter in the default store.
- The limit is per session cookie and the server issues a new cookie when one is missing, so a client that drops cookies always gets a fresh counter. This is a known limit of the design; do not describe the rate limiter as abuse-proof.
- `retrieve` is keyword-based: some off-topic questions still reach the threshold. The system prompt must also refuse off-topic questions, and the chat layer must not rely on the threshold alone.
- Task 6 runs `redactPII` on the message and on every client-sent history item, then `retrieve` on the redacted message. `retrieve` already ignores the `[phone]` / `[email]` markers.

## Decisions already made
- `GROQ_MODEL=openai/gpt-oss-20b`. No streaming. `llama-3.1-8b-instant` is dropped (404 on this account).
- In Task 5 read only `choices[0].message.content`; never display a `reasoning` field.
- Keep `scripts/groq-smoke.mjs` until the end of Task 5 as the request-format reference, then ask the owner before deleting it.
