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
- retrieve: splitting negative contractions leaves stems that are not stopwords (`don`, `doesn`, `isn`, `aren`, `won`, `didn`, `haven`, `wouldn`, plus "why"). Example: "Why doesn't the clinic open on Sundays?" scores 1/3 = 0.333 (< 0.35). Since the owner's routing decision `handleChat` no longer gates on the threshold (the model is called for any match), so this is now only a scoring-quality item (it still matters for the fallback ordering and for `retrieve` tests). Fix: add those stems and "why" to `STOPWORDS` and add a fixture row for that question.
- redactPII: because the email local part accepts `\p{L}`, in scripts written without spaces (for example Chinese) it can swallow up to 64 letters before the "@": "请发到abc@x.com" becomes "[email]" (over-redaction, nothing leaks). Add it to the `redactPII.ts` header and pin it with a test. It is already in the README "Limitations" list below.
- tests: no test covers U+FEFF, U+2060, U+200C/D and U+202B-202D in `INVISIBLE`; removing U+FEFF would still pass. Add rows for them.
- `doc/northwind-dental-HANDOFF.md` still names `vitest.config.ts` (now `vitest.config.mts`); the doc is untracked and is the owner's file, so only mention it.

## Deferred MINOR findings (Task 5-6 review; items 1-4 were fixed on the owner's approval, only the last stays open)
- FIXED: the redact-before-truncate test now uses NFKC-expanding characters (mutation-checked); `ProviderError.message` is logged only when it matches `/^[\w .:-]{1,60}$/`; the log call is wrapped in its own try/catch; the fallback paths return the out-of-scope reply when the best score is below `OUT_OF_SCOPE_THRESHOLD`.
- OPEN (owner accepted the trade-off): in fallback mode (`AI_MODE` unset or `off`, or the provider fails) long multi-topic in-scope questions score below 0.35 and get the out-of-scope reply with the topic list. Measured: booking 0.273, pricing 0.250, fillings 0.091, location 0.333, first-visit 0.333, all refused in fallback mode and all answered when the model is reachable. Pinned by a fixture. Do not "fix" it by lowering the threshold without re-measuring the hard negatives.
- `finish_reason: "length"` falls back to the FAQ. If gpt-oss reasoning tokens use up much of the 300-token budget, fallbacks could become common and silently replace AI answers (visible as `[chat] provider failure: upstream (groq reply truncated)` in logs). In the Task 11 `@live` run, count those lines before discussing a higher `MAX_TOKENS` (a spec value). Whether "length" is the only truncation value Groq uses is unverified.

## Known limitation (accepted by the owner): date/time over-redaction
- `redactPII` treats any run of 9 or more digits with separators as a phone number, so dates, times and amounts are over-redacted. Example: "Can I come 2026-11-09 10:30?" reaches `retrieve` and the model as "Can I come [phone]:30?" (pinned by a test, not changed). Booking questions that carry a date plus a time lose that part. Over-redacting is preferred to leaking a phone number.

## Notes for Task 11 (@live Playwright scenario)
- Besides the in-scope question and the prompt-injection question, the `@live` scenario must send two off-topic questions that the keyword retriever lets through: "what is the price of bitcoin" and "what time is it in Tokyo". Expected: the chatbot REFUSES (a polite refusal that it can only help with the clinic's services, hours, booking, costs, preparation and aftercare, optionally suggesting to leave contact details); the reply must not contain a price or a time. Run by hand with a real key, never in CI.

- Scenario 7 (owner request, in addition to the plan's six E2E scenarios): panel chunk failure. Use `page.route` to abort the network request for the lazy `ChatPanel` chunk (match the chunk that is fetched only on first open; find its URL pattern from the build output), click the chat toggle, and assert that the page did NOT break: the site header and the chat toggle are still visible and a "Try again" button (`data-testid="chat-retry"`) is visible. Then remove the route (`page.unroute`), click "Try again" and assert the panel opens (`chat-panel` visible, focus in `chat-input`). This guards the error boundary around the lazy panel.
- Responsive overflow test (owner request): add ONE Playwright test that loops over the viewport sizes 320x568, 360x640, 390x844, 430x932, 667x375 (landscape phone), 768x1024, 1024x768, 1440x900 and 1920x1080 on the four pages `/`, `/services`, `/faq`, `/contact` with `page.setViewportSize`, and asserts `document.documentElement.scrollWidth <= document.documentElement.clientWidth` for each combination. Do NOT add a new Playwright project and do not add dependencies; reuse the existing project(s) and the mock server.

## Responsive verification routine (owner request; redo after GATE M3 closes and after any later UI change)
- With `chrome-devtools`: scan the four pages at 320, 360, 390, 430, 768, 1024, 1440, 1920 and the landscape phone 667x375; measure `scrollWidth` vs `clientWidth`, take screenshots, and report which page and width overflows or breaks. Open and close the ChatWidget at 320, 768, 1440, 667x375 (and 1920): the panel must stay inside the viewport, use a `dvh`-based max-height with inner scrolling, never cover the Send button, and sit at the bottom-right corner. Check 200% desktop zoom (1280x800 -> 640x400 CSS px, 1920x1080 -> 960x540): no lost content, no horizontal overflow. Report real results as a width x page table. Fix only real defects; no tablet-specific design; no new dependency.

## Follow-ups from the Task 7 check (owner to decide)
- ChatWidget on very wide screens: the toggle stays in the bottom-right corner of the viewport (16 px from the edges) but is 136 px right of the content column at 1440 px and 376 px at 1920 px. Option: anchor it to the content column on wide screens.
- FIXED (owner-approved fix pass): after a failed send the typed text is restored into the input (only if the input is empty), the unsent bubble is removed and the error note stays; the panel chunk has a hand-written class error boundary with a "Try again" button that really re-imports the chunk; the chat input is focused only when the focus is on `body` or inside the widget; Escape closes only when the focus is inside the widget; the panel scrolls to the bottom when it reopens. Verified in Chrome and independently reviewed (verdict APPROVE).
- Open MINOR items from that review (owner to decide, none blocks): (M1) `role="alert"` is still on the load-failure box in `PanelBoundary.tsx` (the chat error note no longer has it); drop it and give the dialog `aria-describedby`, or keep it on purpose. (M2) a bubble marked "unsent" looks like a sent one when the visitor already typed a new draft; style it and add an sr-only "(not sent)". (M3) after "Try again" the focused button disappears and focus falls to `body`; focus the loading box (`tabIndex=-1`) when allowed. (M4) ignore `keyCode === 229` in the Escape handler for Safari IME. (M5) the failure box says "Chat could not load." even for a render bug of an already loaded panel; use wording such as "Chat is unavailable right now.". (M6) closing and reopening after a failure shows the stale failure box without retrying. Test gap: only Task 11 scenario 7 and manual checks cover the boundary (no DOM tests exist).
- At the first screen the fixed toggle partly overlaps some wide rows (3-14 percent of the element, never the element's centre): for example the hero button at 320x568 (8 px) and FAQ rows at 360-768 px. It scrolls away; no change planned.

## Notes for Task 6 and Task 9 (from the M2 review)
- HARD REQUIREMENT for Task 6: the chat system prompt must itself instruct the model to refuse off-topic (non-clinic) questions. Since `handleChat` now calls the model whenever any FAQ entry matches, the system prompt is the main off-topic defence (see "Chat routing" under Decisions).
- Prefix rate-limit keys by purpose (`chat:<sessionId>`, `lead:<sessionId>`) so the chat limit (20 / 10 min) and the lead limit (3 / session) never share one counter in the default store.
- The limit is per session cookie and the server issues a new cookie when one is missing, so a client that drops cookies always gets a fresh counter. This is a known limit of the design; do not describe the rate limiter as abuse-proof.
- `retrieve` is keyword-based: an off-topic question that shares a word with the FAQ gets a match. `handleChat` now calls the model for any match, so the system prompt is the off-topic defence (see "Chat routing" under Decisions).
- Task 6 runs `redactPII` on the message and on every client-sent history item, then `retrieve` on the redacted message. `retrieve` already ignores the `[phone]` / `[email]` markers.

## Decisions already made
- `GROQ_MODEL=openai/gpt-oss-20b`. No streaming. `llama-3.1-8b-instant` is dropped (404 on this account).
- The Groq provider (Task 5) reads `choices[0].message.content`, plus `choices[0].finish_reason` ONLY to detect truncation (`length` means fall back to the FAQ answer). It never reads, returns or displays a `reasoning` field.
- `scripts/groq-smoke.mjs` was deleted after Task 5 (owner approved). The Groq request format now lives in `lib/ai/groqProvider.ts` and `tests/unit/provider.test.ts`.
- Chat routing (owner decision, replaces the threshold gate in spec section 5 step 5): `handleChat` calls the model whenever AT LEAST ONE FAQ entry matches (score > 0). The fixed out-of-scope reply is returned only when NOTHING matches. `OUT_OF_SCOPE_THRESHOLD` stays exported from `lib/faq/retrieve.ts` as a confidence measure for tests and tuning, but `handleChat` does not use it on the model path. Reason (measured): 5 of 8 realistic multi-part in-scope questions scored 0.09-0.33 and would have been refused without calling the model. The system prompt is therefore the main off-topic defence and the `@live` scenario (Task 11) must keep testing it. FALLBACK GUARD (owner decision, second rule): when there is no provider (`AI_MODE` unset or `off`) or the provider fails or returns nothing, `handleChat` returns the verbatim best FAQ answer (`faq-fallback`) only when the best score is at least `OUT_OF_SCOPE_THRESHOLD`; a weaker match returns the out-of-scope reply (`out-of-scope`), which now lists the FAQ topics. Example: "Write a poem about the first Roman emperor" reaches the model when one exists, and gets the out-of-scope reply in fallback mode.
- Allowed logging exception (owner decision): when the provider fails, `handleChat` writes ONE `console.warn`: `[chat] provider failure: <kind> (<message>)` with the fixed `ProviderError` message (for example `[chat] provider failure: upstream (groq http 500)`), `[chat] provider failure: unexpected` for a non-ProviderError, or `[chat] provider failure: empty reply` when the model returns nothing. Never log message text, history, email, FAQ text, response bodies, keys or env values. Nothing else logs.
- Task 7 direction (owner decision): the `ChatWidget` is hand-written with native elements and the existing design tokens. No shadcn/ui, no new dependencies, lazy-loaded, built with the `frontend-design` skill.
