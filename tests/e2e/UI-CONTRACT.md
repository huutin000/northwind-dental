# UI contract for the e2e suite

The Playwright tests (`tests/e2e/`) rely on exactly what is listed here. A UI redesign may change markup,
classes, layout and most copy, but it must keep this contract or update the tests in the same change.
Everything below was taken from the code (grep of `data-testid`, `role` and `aria-label`), not from memory.

Selector rules for the tests: `getByTestId` and `getByRole` only. No CSS classes. No pixel or snapshot
comparison. No fixed sleeps (use `expect` auto-wait).

## Routes

| Route | Kind | What the tests need |
|---|---|---|
| `/` | static | `h1`, `navigation` named "Main", `main` landmark |
| `/services` | static | `h1`, `navigation` named "Main", `main` |
| `/faq` | static | `h1`, `navigation` named "Main", `main` |
| `/contact` | static | `h1`, the lead form (see below) |
| `/leads` | dynamic, per session | `h1` "Your requests", `lead-notice`, `lead-empty` or `lead-list-item` |
| `POST /api/chat`, `POST /api/leads`, `GET /api/leads` | route handlers | status codes in "API contract" |

## Test ids

Page chrome
- `demo-banner` : the site-wide "This is a demo project, not a real clinic." note (role `note`), on every page.

Chat widget (`components/ChatWidget.tsx`, `components/chat/*`)
- `chat-toggle` : the round button, always present. Accessible name "Open chat with Northwind Dental" when closed,
  "Close chat" when open. `aria-expanded` is `true` when open. `aria-controls="chat-panel-region"`.
- `chat-panel` : the dialog (role `dialog`, name "Chat with the Northwind Dental demo assistant"). Exists only after the first open.
- `chat-input` : the message field. `chat-send` : the send button (role `button`, name "Send message").
- `chat-close` : the close button inside the panel.
- `chat-greeting` : the first assistant bubble (not a real turn).
- `chat-message-user`, `chat-message-assistant` : one element per real turn.
- `chat-source` : badge inside an assistant bubble. Text: "AI answer" (model/mock), "From our FAQ" (fallback), "Outside my scope".
- `chat-error` : error note after a failed send.
- `chat-contact-hint`, `chat-contact-link` : shown only under an assistant turn whose source is "Outside my scope". The link goes to `/contact#form-heading`.
- `chat-panel-error` : the failure box (role `dialog`, name "Chat") when the lazy panel chunk fails to load or render.
- `chat-retry` : the "Try again" button inside the failure box.
- Roles: `log` named "Conversation" (message list); `status` named "Thinking" while a reply is pending.

Lead form (`components/LeadForm.tsx`, `components/LeadNotice.tsx`) on `/contact`
- `lead-email`, `lead-name`, `lead-note` : the fields, each with a visible `<label>` (ids `lead-email`, `lead-name`, `lead-note`).
- `lead-submit` : the submit button. `lead-error` : assertive live region for submit errors (always mounted).
- `lead-success` : the confirmation box (focus target after success). `lead-view-link` : link to `/leads` inside it.
- `lead-notice` : the demo banner of the lead feature. Exact text: "This is a demo. Please use a fake email. Data is deleted after 24 hours."
  It is shown next to the form and at the top of `/leads`.
- Honeypot: `input[name="website"]` (id `lead-website`), inside an `aria-hidden` container, `tabindex="-1"`. It has no test id
  on purpose: tests must not fill it through the UI; the API tests send `website` directly.

Leads page (`app/leads/page.tsx`)
- `lead-empty` : empty state (no cookie, invalid cookie, no leads, or a store error).
- `lead-list-item` : one per stored lead, newest first. Contains the lead fields as plain text.

## Required copy (the only exact strings the tests may assert)

- Lead banner (above).
- 429 on the lead form: "You have reached the request limit for this demo. Please try again tomorrow."
- Chat source labels: "AI answer", "From our FAQ", "Outside my scope".
- The `hours` FAQ answer (scenario 3) is read from `lib/faq/data.ts` (entry id `hours`), never copied into the test.

## Behaviour that must be kept

Chat
1. The chat panel is lazy: before the first open `chat-panel` is not in the DOM and its chunk is not requested.
   Only `chat-toggle` ships in the initial bundle.
2. Opening moves focus to `chat-input` (when focus was on the toggle, the body or inside the widget).
3. Escape closes the panel only when focus is inside the widget, and focus returns to `chat-toggle`.
4. Close keeps the conversation: closing and reopening shows the same turns (the panel stays mounted, hidden with `display: none`;
   while closed it has no focusable elements). Only `chat-retry` creates a fresh panel and resets the conversation.
5. If the panel chunk fails to load, the rest of the page keeps working: header and `chat-toggle` stay visible, `chat-panel-error`
   with `chat-retry` appears; after the chunk is reachable again, `chat-retry` opens the panel and focuses `chat-input`.
   Closing and reopening a failed panel shows the same failure box until `chat-retry` is pressed.
6. Out-of-scope answers show `chat-contact-hint`; following `chat-contact-link` closes the panel and navigates to `/contact`.
7. The in-memory history reaches the lead request: after a chat, the `POST /api/leads` body carries the last real turns.
8. The mock provider answers "AI answer"; a question containing `__mock_429__` makes it fail, which must produce "From our FAQ" with
   the verbatim FAQ answer.

Lead
9. Requests are same-origin `POST` with `Content-Type: application/json`.
10. Client validation runs first: an invalid email focuses `lead-email` and shows an error linked by `aria-describedby`.
11. After success focus moves to `lead-success`. After a failed submit focus moves to the first invalid field or to `lead-error`.
12. The 4th lead of a session is answered with 429 and the message above. A lead is visible on `/leads` for the session that created it only.
13. Stored text is rendered as plain text (no HTML injection) on `/leads`.

Layout
14. No horizontal overflow (`scrollWidth <= clientWidth`) at the widths used by the sweep, on every route.
15. The demo banner and the main controls of each route stay visible at those widths. The header navigation (`navigation` named "Main") is always in the DOM and has two modes:
    - From 768 px up (Tailwind `md`): the four links (Services, Approach, FAQ, Contact) and "Book a visit" are visible inline.
    - Below 768 px: the links are collapsed behind a button named "Menu" (`getByRole("button", { name: "Menu" })`). This is a DELIBERATE DEVIATION from "navigation stays visible": on phones the links are hidden until the menu is opened. Tests must open the menu before looking for a link at those widths.
    - Required behaviour of the Menu button (`components/Header.tsx`): it has `aria-expanded` (`false` closed, `true` open) and `aria-controls="main-menu"`, which is the `id` of the link list. Opening it shows the links. `Escape` closes it and returns focus to the Menu button (it only reacts when focus is inside the navigation or on `body`; Escape with focus elsewhere, for example in the chat widget, is left alone). Activating any link closes the menu (and navigates). A route change also closes it.

## API contract (request fixture tests)

| Request | Expected |
|---|---|
| `POST /api/leads` without `Content-Type: application/json` | 415, no `Set-Cookie` |
| `POST /api/leads` with a foreign `Origin` | 403, no `Set-Cookie` |
| `POST /api/leads` with an invalid email | 400 |
| `POST /api/leads` with a non-empty `website` | 400, nothing stored |
| `POST /api/leads` valid | 201 `{ lead }` and a session cookie |
| 4th valid lead of a session | 429 |
| `GET /api/leads` without cookie | 200 `{ leads: [] }` |
