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
| `/contact` | static | `h1` "Request an appointment", the simulated appointment form (see below) |
| `POST /api/chat` | route handlers | status codes in "API contract" |

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

Appointment form (`components/AppointmentForm.tsx`) on `/contact` (SIMULATION: sends nothing, no test ids; tests use roles, labels and visible text)
- Region "Appointment request form" (`section[aria-labelledby="form-heading"]`, sr-only `h2#form-heading`; the chat link `/contact#form-heading` targets it).
- Required note: a `p` above the first fieldset reads "Fields marked * are required." (the visible `*` is `aria-hidden`; an sr-only "with an asterisk" follows it).
- Groups (`fieldset` + `legend`): "About you" (textboxes "Full name", "Phone", "Email"), "Your visit" (combobox "Service", labels "Preferred date" and "Preferred time (open 9:00 to 17:00)", textbox "Notes (optional)").
- Required marks: the labels of Full name, Phone, Email, Service, Preferred date and Preferred time end with an `aria-hidden` `*` (error-ink colour), and exactly those six controls have `required` (the form keeps `noValidate`, so validation is still ours). Notes has no `*` and is not required. The `*` is not part of any accessible name: names stay "Full name", "Phone", "Email", "Service", "Preferred date", "Preferred time (open 9:00 to 17:00)", "Notes (optional)".
- Date and time are hand-written pickers (no native `type=date` / `type=time`, so the browser locale never changes their text). Each is a text input (ids `appt-date`, `appt-time`, same labels) plus an icon button: "Open calendar" and "Open time picker" (`aria-haspopup="dialog"`, `aria-expanded`; the name never changes. While a value exists the button has `aria-describedby` pointing at an sr-only "Selected date: Thursday, December 3, 2026" / "Selected time: 10:30"; with no value there is no description). The popover is `role="dialog"` named "Calendar" / "Time picker" (`hidden` when closed). Text is always English.
  - Date text: shown as `Dec 3, 2026` (the placeholder is "e.g. Dec 3, 2026"). Accepted when typed: `Dec 3, 2026`, `December 3, 2026`, `dec 3 2026`, `2026-12-03` (month names case-insensitive; invalid dates such as Feb 30 are not accepted). On blur an accepted text is rewritten to `Dec 3, 2026`; unreadable text is left as typed and counts as empty (the "Pick a preferred date and time." error).
  - Time text: 24-hour `HH:MM` (`10:30`); `9:30` is accepted and becomes `09:30` on blur; anything else counts as empty.
  - Calendar: month title "December 2026"; weekday headers Su Mo Tu We Th Fr Sa (Sunday first, `aria-hidden`); Previous month / Next month buttons; always 6 weeks; day buttons are named like "Thursday, December 3, 2026" with `aria-pressed` (chosen day) and `aria-current="date"` (today; marked by semibold text plus a 4px `aria-hidden` dot, brand on a plain cell and canvas on the selected cell, never a ring). Opens with focus on the chosen day, else today. Keys on a day: arrows move by day or week, PageUp/PageDown change the month (day clamps, Jan 31 -> Feb 28), Enter picks.
  - Time picker: hour buttons "Hour 09" to "Hour 17" (3 columns), minute buttons "Minute 00/15/30/45" (disabled until an hour exists; at hour 17 only "Minute 00" is enabled, every other hour allows all four). Picking an hour keeps the popover open (the minute is kept when allowed, else 00); picking a minute closes it. Keys: arrows, Home, End.
  - Both: picking a day or a minute closes the popover and focuses the "Open ..." button (picking an hour keeps the time popover open); while the calendar is open, typing a valid date moves the grid to that month; Escape is ignored during IME composition; Escape closes it and focuses the "Open ..." button as well; a pointer press outside, or focus moving to another field, closes it. Clinic hours are not enforced (20:15 is accepted, as before).
- Service options in order: "Choose a service" (value empty), Check-up, Cleaning, Filling, Whitening, Root canal, Crowns and bridges, Children's dentistry.
- None of the controls has a `name` attribute (a native submit before hydration cannot put typed data in the URL); tests locate controls by role, label or id. The Send button keeps its width in the "Sending request" state from `sm` up, and the date and time inputs share top and bottom edges.
- Buttons: "Send request" (while sending: "Sending request", disabled; the form has `aria-busy="true"`; the sr-only `role="status"` "Sending request" paragraph is a sibling AFTER the form), "Make another request" (success panel).
- Invalid submit: `role="alert"` banner: exactly 1 message reads "Check the field marked below, then send your request again."; N >= 2 reads "Check the N fields marked below, then send your request again." (N = number of messages, date and time share one; N is fixed at submit time and does not change while the visitor edits; the banner disappears when no error remains); each invalid field has `aria-invalid="true"` and `aria-describedby` pointing at its message; focus goes to the first invalid field (set after the error state is committed). For date and time only the EMPTY input(s) are flagged and linked to the shared message (date filled + time empty flags only the time, and the mirror; both empty flags both); the message clears only once both are filled.
- Messages: "Enter your full name.", "Enter a phone number with at least 7 digits.", "Enter an email address like name@example.com.", "Choose a service.", "Pick a preferred date and time.".
- Success: `role="status"` panel with focus, heading "Request received (demo)", `dl` recap (Name, Service, Preferred, Contact) as plain text. "Make another request" resets and focuses "Full name".
- "Demo only. This form does not send anything." is visible in the form state. The form makes NO request to `/api/*` and uses no storage.

## Required copy (the only exact strings the tests may assert)

- Appointment form messages and headings (listed above).
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
6. Out-of-scope answers show `chat-contact-hint`; following `chat-contact-link` closes the panel and navigates to `/contact#form-heading`.
8. The mock provider answers "AI answer"; a question containing `__mock_429__` makes it fail, which must produce "From our FAQ" with
   the verbatim FAQ answer.

Appointment form
9a. Client validation only; a valid submit shows "Sending request" for exactly 1200 ms (tests drive it with `page.clock`, no fixed sleeps), then the success panel (focus on it). The timer is cleared when the form unmounts. No network call.
9b. Out-of-scope chat answers link to `/contact#form-heading`; that anchor exists on the new page.

Layout
14. No horizontal overflow (`scrollWidth <= clientWidth`) at the widths used by the sweep, on every route.
15. The demo banner and the main controls of each route stay visible at those widths. The header navigation (`navigation` named "Main") is always in the DOM and has two modes:
    - From 768 px up (Tailwind `md`): the four links (Services, Approach, FAQ, Contact) and "Book a visit" are visible inline.
    - Below 768 px: the links are collapsed behind a button named "Menu" (`getByRole("button", { name: "Menu" })`). This is a DELIBERATE DEVIATION from "navigation stays visible": on phones the links are hidden until the menu is opened. Tests must open the menu before looking for a link at those widths.
    - Required behaviour of the Menu button (`components/Header.tsx`): it has `aria-expanded` (`false` closed, `true` open) and `aria-controls="main-menu"`, which is the `id` of the link list. Opening it shows the links. `Escape` closes it and returns focus to the Menu button (it only reacts when focus is inside the navigation or on `body`; Escape with focus elsewhere, for example in the chat widget, is left alone). Activating any link closes the menu (and navigates). A route change also closes it.

## API contract (request fixture tests)

| Request | Expected |
|---|---|
| `POST /api/chat` with `Content-Type` `text/plain`, `application/x-www-form-urlencoded` or `application/jsonx` | 415, no `Set-Cookie` (`tests/e2e/chatGuard.spec.ts`) |
| `POST /api/chat` with `Content-Type: application/json` and a foreign `Origin` | 403, no `Set-Cookie` (`tests/e2e/chatGuard.spec.ts`) |
| `POST /api/chat` with `Sec-Fetch-Site: cross-site` | 403, no `Set-Cookie` (`tests/e2e/chatGuard.spec.ts`) |
| `POST /api/chat` same-origin (`application/json`, same `Origin`, `Sec-Fetch-Site: same-origin`), in-scope question | 200 with `source: "ai"` in mock mode (`tests/e2e/chatGuard.spec.ts`) |
