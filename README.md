# Northwind Dental

A demo project (not a real clinic): a boutique dental clinic website with an AI chat assistant.

## Images & Visual Assets
- All clinic and service photographic visuals are AI-generated rendered images created for this fictional clinic using an internal generative assistant. No photos of real people, real doctors, or trademarked logos are used.
- Hand-crafted SVG icons and illustrations complement the photography using the project's sky-blue design tokens (declared once in the `@theme` block in `app/globals.css`).
- Rendered images are optimized to WebP format with strict size budgets (Hero <= 110 KB, content images <= 60–95 KB).
- **Current status**: 6 of the 7 images in `public/images/` are used on the Home page (`hero-clinic.webp`, `cleaning.webp`, `reception.webp`, `treatment-room.webp`, `equipment-bay.webp`, `welcome.webp`). `waiting-lounge.webp` is a spare and is not used yet. The Services page utilizes 6 bespoke hand-crafted SVG clinical icons. Raw image generation sources are stored in `assets-src/` (git-ignored).

## Limitations
- Leads and rate-limit counters are kept in a key-value store (Upstash Redis) when its environment variables are set. Without it the app falls back to memory that belongs to a single server process. Serverless instances (for example on Vercel) do not share that memory, so a lead saved by one instance can be missing on `/leads` from another. A deployment must configure the key-value store; the memory fallback is only for local development and tests.

## End-to-end tests

The Playwright suite in `tests/e2e/` drives the real production build in Chromium (desktop and a 375x667 phone project). It covers the chat answers and badges (AI answer, FAQ fallback, out of scope), the chat widget behaviour (conversation kept on close and reopen, Escape and focus, lazy panel chunk, chunk failure and "Try again"), the lead form and the `/leads` page (success, the 3-per-session limit, per-session isolation, plain-text rendering, client validation, chat history in the lead request), the request guard and lead API status codes, and a viewport sweep (no horizontal overflow on five routes at ten sizes). `tests/e2e/UI-CONTRACT.md` lists the test ids, roles and copy the tests rely on.

```bash
npx playwright install chromium   # once
npm run build
npm run test:e2e
npx playwright show-report        # HTML report in playwright-report/
```

The suite starts `next start` on port 3400 (it fails if the port is taken or if `npm run build` was not run). The server always runs with mock AI, a fake session secret and no key-value store (the four KV variables are forced to a blank value), whatever your shell or local env file contains, so it never reaches Groq or Upstash. Leads and counters live in server memory, and each test uses its own browser context, so tests do not share a session.

### Live tests (`@live`, manual only)

`tests/e2e/live.spec.ts` sends real questions to Groq (one in scope, two off-topic questions, one prompt-injection attempt). It is never part of `npm run test:e2e` and is never run in CI. It costs Groq quota. To run it yourself, set `GROQ_API_KEY` (required) and `GROQ_MODEL` (optional, default `openai/gpt-oss-20b`) in your own PowerShell session, for example by loading your local env file in that shell, then run:

```powershell
npm run build; npm run test:e2e:live
```

It uses port 3401, never uses the key-value store, and stops with a clear error if `GROQ_API_KEY` is not set. Model answers vary, so the assertions are tolerant (badge, no error, refusal topics, no price or time, no system prompt text).
