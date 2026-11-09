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

## Decisions already made
- `GROQ_MODEL=openai/gpt-oss-20b`. No streaming. `llama-3.1-8b-instant` is dropped (404 on this account).
- In Task 5 read only `choices[0].message.content`; never display a `reasoning` field.
- Keep `scripts/groq-smoke.mjs` until the end of Task 5 as the request-format reference, then ask the owner before deleting it.
