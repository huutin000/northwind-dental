# Northwind Dental

A demo project (not a real clinic): a boutique dental clinic website with an AI chat assistant.

## Images & Visual Assets
- All clinic and service photographic visuals are AI-generated rendered images created for this fictional clinic using an internal generative assistant. No photos of real people, real doctors, or trademarked logos are used.
- Hand-crafted SVG icons and illustrations complement the photography using the project's sky-blue design tokens (declared once in the `@theme` block in `app/globals.css`).
- Rendered images are optimized to WebP format with strict size budgets (Hero <= 110 KB, content images <= 60–95 KB).
- **Current status**: 6 of the 7 images in `public/images/` are used on the Home page (`hero-clinic.webp`, `cleaning.webp`, `reception.webp`, `treatment-room.webp`, `equipment-bay.webp`, `welcome.webp`). `waiting-lounge.webp` is a spare and is not used yet. The Services page utilizes 6 bespoke hand-crafted SVG clinical icons. Raw image generation sources are stored in `assets-src/` (git-ignored).

## Limitations
- Leads and rate-limit counters are kept in a key-value store (Upstash Redis) when its environment variables are set. Without it the app falls back to memory that belongs to a single server process. Serverless instances (for example on Vercel) do not share that memory, so a lead saved by one instance can be missing on `/leads` from another. A deployment must configure the key-value store; the memory fallback is only for local development and tests.
