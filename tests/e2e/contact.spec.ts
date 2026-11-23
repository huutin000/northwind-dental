import { expect, test, type Locator, type Page } from "@playwright/test";
import { horizontalScroll, waitForHydrated } from "./helpers";

// The simulated appointment form on /contact (components/AppointmentForm.tsx). Selectors: roles, labels and visible
// text only (the component has no test ids). The form sends nothing: every test that submits also watches the network.
// The 1.2 s "sending" timer is driven with page.clock wherever a test looks inside that window, so nothing depends on
// machine speed and there is no fixed sleep.

const SERVICES = ["Check-up", "Cleaning", "Filling", "Whitening", "Root canal", "Crowns and bridges", "Children's dentistry"];
const MSG = {
  name: "Enter your full name.",
  phone: "Enter a phone number with at least 7 digits.",
  email: "Enter an email address like name@example.com.",
  service: "Choose a service.",
  when: "Pick a preferred date and time.",
};
const ONE_FIELD = "Check the field marked below, then send your request again.";

const nameField = (p: Page) => p.getByRole("textbox", { name: "Full name" });
const phoneField = (p: Page) => p.getByRole("textbox", { name: "Phone" });
const emailField = (p: Page) => p.getByRole("textbox", { name: "Email" });
const serviceField = (p: Page) => p.getByRole("combobox", { name: "Service" });
const dateField = (p: Page) => p.getByLabel("Preferred date");
const timeField = (p: Page) => p.getByLabel("Preferred time");
const notesField = (p: Page) => p.getByRole("textbox", { name: /Notes/ });
const sendButton = (p: Page) => p.getByRole("button", { name: "Send request" });
const banner = (p: Page) => p.getByRole("alert").filter({ hasText: "marked below" });
const sendingButton = (p: Page) => p.getByRole("button", { name: "Sending request" });
const receivedHeading = (p: Page) => p.getByRole("heading", { name: "Request received (demo)" });
const successPanel = (p: Page) => p.getByRole("status").filter({ has: receivedHeading(p) });

type Fill = { name: string; phone: string; email: string; service: string; date: string; time: string };
const VALID: Fill = {
  name: "Sam Lee",
  phone: "555 0100 123",
  email: "sam@example.com",
  service: "Cleaning",
  date: "2026-12-03",
  time: "10:30",
};

async function open(page: Page) {
  await page.goto("/contact");
  await waitForHydrated(sendButton(page));
}

/**
 * Opens /contact with a PAUSED fake clock (installed before navigation): the 1.2 s timer can only fire when the test
 * calls clock.runFor, so a slow runner can never make success arrive early.
 */
async function openWithClock(page: Page) {
  await page.clock.install({ time: new Date("2026-12-01T09:00:00") });
  await page.goto("/contact");
  await waitForHydrated(sendButton(page));
  await page.clock.pauseAt(new Date("2026-12-01T09:05:00"));
}

async function fill(page: Page, v: Partial<Fill> = {}) {
  const f = { ...VALID, ...v };
  await nameField(page).fill(f.name);
  await phoneField(page).fill(f.phone);
  await emailField(page).fill(f.email);
  await serviceField(page).selectOption(f.service);
  await dateField(page).fill(f.date);
  await timeField(page).fill(f.time);
}

/** Records every request to /api/* and every console message or page error (types only, never message text). */
function watch(page: Page) {
  const api: string[] = [];
  const out: string[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) api.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  page.on("console", (m) => out.push(`console.${m.type()}`));
  page.on("pageerror", () => out.push("pageerror"));
  return { api, out };
}

async function describedText(field: Locator): Promise<string> {
  const ids = (await field.getAttribute("aria-describedby")) ?? "";
  expect(ids, "aria-describedby must be set").not.toBe("");
  const texts: string[] = [];
  for (const id of ids.split(/\s+/)) texts.push(await field.page().locator(`[id="${id}"]`).innerText());
  return texts.join(" ").trim();
}

test.describe("AC-1 structure of /contact", () => {
  test("heading, groups, hours strip, Find us, demo note", async ({ page }) => {
    await page.goto("/contact");
    await expect(page).toHaveTitle(/Request an appointment/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Request an appointment");
    const form = page.getByRole("region", { name: "Appointment request form" });
    await expect(form.getByRole("group", { name: "About you" })).toBeVisible();
    await expect(form.getByRole("group", { name: "Your visit" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Opening hours" })).toBeVisible();
    await expect(page.getByText("Monday to Friday, 9:00 to 17:00.")).toBeVisible();
    await expect(page.getByText("Closed on weekends.")).toBeVisible();
    await expect(page.getByText("Preferred time (open 9:00 to 17:00)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Find us" })).toBeVisible();
    await expect(page.getByText("Fictional details for this demo.")).toBeVisible();
    await expect(page.getByText("Demo only. This form does not send anything.")).toBeVisible();
    await expect(sendButton(page)).toBeVisible();
    await expect(notesField(page)).toHaveValue("");
    await expect(page.locator("ul[aria-hidden='true'] li")).toHaveText(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  });

  test("the week strip is one row of 7 chips", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/contact");
    const tops = await page.locator("ul[aria-hidden='true'] li").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(tops).toHaveLength(7);
    expect(new Set(tops).size, "all chips on one row").toBe(1);
  });
});

test.describe("AC-2 service options", () => {
  test("exactly the placeholder plus seven services, in order", async ({ page }) => {
    await page.goto("/contact");
    const options = serviceField(page).locator("option");
    await expect(options).toHaveText(["Choose a service", ...SERVICES]);
    await expect(options.first()).toHaveAttribute("value", "");
    await expect(serviceField(page)).toHaveValue("");
  });
});

test.describe("AC-3 validation", () => {
  test("empty submit: alert with the count, all fields flagged and linked, focus on the first", async ({ page }) => {
    const w = watch(page);
    await open(page);
    await sendButton(page).click();

    await expect(banner(page)).toHaveText("Check the 5 fields marked below, then send your request again.");
    const checks: [Locator, string][] = [
      [nameField(page), MSG.name],
      [phoneField(page), MSG.phone],
      [emailField(page), MSG.email],
      [serviceField(page), MSG.service],
      [dateField(page), MSG.when],
      [timeField(page), MSG.when],
    ];
    for (const [field, message] of checks) {
      await expect(field).toHaveAttribute("aria-invalid", "true");
      expect(await describedText(field)).toBe(message);
      // red border is 2px; the default edge border is 1.5px
      expect(await field.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("2px");
    }
    await expect(nameField(page)).toBeFocused();
    await expect(notesField(page)).not.toHaveAttribute("aria-invalid", "true");
    expect(w.api, "validation must not call any API").toEqual([]);
    expect(w.out).toEqual([]);
  });

  test("focus goes to the first invalid field in order", async ({ page }) => {
    await open(page);
    await fill(page, { name: "", phone: "", email: "" });
    await sendButton(page).click();
    await expect(nameField(page)).toBeFocused();

    await nameField(page).fill("Sam");
    await sendButton(page).click();
    await expect(phoneField(page)).toBeFocused();

    await phoneField(page).fill("5550100");
    await sendButton(page).click();
    await expect(emailField(page)).toBeFocused();

    await emailField(page).fill("sam@example.com");
    await serviceField(page).selectOption("");
    await sendButton(page).click();
    await expect(serviceField(page)).toBeFocused();
  });

  test("F2: valid date + empty time flags only the time input; message described only from time", async ({ page }) => {
    await open(page);
    await fill(page);
    await timeField(page).fill("");
    await sendButton(page).click();
    await expect(timeField(page)).toBeFocused();
    await expect(timeField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(timeField(page)).toHaveAttribute("aria-describedby", "appt-when-error");
    await expect(dateField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(dateField(page)).not.toHaveAttribute("aria-describedby", /.+/);
    expect(await timeField(page).evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe("2px");
    expect(await dateField(page).evaluate((el) => getComputedStyle(el).borderTopWidth)).not.toBe("2px");
    await expect(page.getByText(MSG.when)).toHaveCount(1);
    await expect(banner(page)).toHaveText(ONE_FIELD);
    // The message clears only once BOTH are filled.
    await timeField(page).fill("10:30");
    await expect(page.getByText(MSG.when)).toHaveCount(0);
    await expect(timeField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  test("F2 mirror: valid time + empty date flags only the date input", async ({ page }) => {
    await open(page);
    await fill(page);
    await dateField(page).fill("");
    await sendButton(page).click();
    await expect(dateField(page)).toBeFocused();
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(dateField(page)).toHaveAttribute("aria-describedby", "appt-when-error");
    await expect(timeField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(timeField(page)).not.toHaveAttribute("aria-describedby", /.+/);
    await expect(page.getByText(MSG.when)).toHaveCount(1);
    await expect(banner(page)).toHaveText(ONE_FIELD);
    await dateField(page).fill("2026-12-03");
    await expect(page.getByText(MSG.when)).toHaveCount(0);
  });

  test("F2: both empty flags both; filling one keeps the message and flags only the other", async ({ page }) => {
    await open(page);
    await fill(page);
    await dateField(page).fill("");
    await timeField(page).fill("");
    await sendButton(page).click();
    await expect(dateField(page)).toBeFocused();
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(timeField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(MSG.when)).toHaveCount(1);
    await dateField(page).fill("2026-12-03");
    await expect(page.getByText(MSG.when)).toHaveCount(1);
    await expect(dateField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(timeField(page)).toHaveAttribute("aria-invalid", "true");
    await timeField(page).fill("10:30");
    await expect(page.getByText(MSG.when)).toHaveCount(0);
  });

  test("F3: the banner count is fixed at submit time while fields are fixed one by one", async ({ page }) => {
    await open(page);
    await fill(page, { phone: "", email: "" });
    await serviceField(page).selectOption("");
    await sendButton(page).click();
    const three = "Check the 3 fields marked below, then send your request again.";
    await expect(banner(page)).toHaveText(three);

    await phoneField(page).fill("5550100");
    await expect(page.getByText(MSG.phone)).toHaveCount(0);
    await expect(banner(page)).toHaveText(three);
    await emailField(page).fill("sam@example.com");
    await expect(page.getByText(MSG.email)).toHaveCount(0);
    await expect(banner(page)).toHaveText(three);
    // Fixing the last one removes the banner.
    await serviceField(page).selectOption("Filling");
    await expect(banner(page)).toHaveCount(0);

    // A new submit with exactly one error reads singular.
    await phoneField(page).fill("12");
    await sendButton(page).click();
    await expect(banner(page)).toHaveText(ONE_FIELD);
  });

  test("errors clear per field on edit; the other errors stay", async ({ page }) => {
    await open(page);
    await sendButton(page).click();
    await expect(banner(page)).toHaveText(/Check the 5 fields marked below/);

    await nameField(page).fill("S");
    await expect(page.getByText(MSG.name)).toHaveCount(0);
    await expect(nameField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(nameField(page)).not.toHaveAttribute("aria-describedby", /.+/);
    await expect(phoneField(page)).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText(MSG.phone)).toBeVisible();

    // Filling only the date keeps the shared message and flags only the empty time; filling both clears it.
    await dateField(page).fill("2026-12-03");
    await expect(page.getByText(MSG.when)).toHaveCount(1);
    await expect(dateField(page)).not.toHaveAttribute("aria-invalid", "true");
    await expect(timeField(page)).toHaveAttribute("aria-invalid", "true");
    await timeField(page).fill("10:30");
    await expect(page.getByText(MSG.when)).toHaveCount(0);
    await expect(timeField(page)).not.toHaveAttribute("aria-invalid", "true");
  });

  const phoneCases: [string, string, boolean][] = [
    ["6 digits", "555010", false],
    ["7 digits", "5550100", true],
    ["7 digits with spaces and dashes", "555-01 00", true],
    ["6 digits with separators", "(555) 01-0", false],
    ["letters only", "abcdefghij", false],
    ["empty", "", false],
  ];
  for (const [label, value, ok] of phoneCases) {
    test(`phone boundary: ${label} is ${ok ? "accepted" : "rejected"}`, async ({ page }) => {
      await open(page);
      await fill(page, { phone: value });
      await sendButton(page).click();
      if (ok) {
        await expect(page.getByText(MSG.phone)).toHaveCount(0);
        await expect(sendingButton(page)).toBeDisabled();
      } else {
        await expect(page.getByText(MSG.phone)).toBeVisible();
        await expect(phoneField(page)).toBeFocused();
        await expect(banner(page)).toHaveText(ONE_FIELD);
      }
    });
  }

  const emailCases: [string, boolean][] = [
    ["a@b.co", true],
    ["first.last+tag@example.com", true],
    ["  sam@example.com  ", true],
    ["sam@", false],
    ["sam@example", false],
    ["@example.com", false],
    ["sam example@x.com", false],
    ["sam@@example.com", false],
    ["", false],
  ];
  for (const [value, ok] of emailCases) {
    test(`email boundary: ${JSON.stringify(value)} is ${ok ? "accepted" : "rejected"}`, async ({ page }) => {
      await open(page);
      await fill(page, { email: value });
      await sendButton(page).click();
      if (ok) {
        await expect(page.getByText(MSG.email)).toHaveCount(0);
        await expect(sendingButton(page)).toBeDisabled();
      } else {
        await expect(page.getByText(MSG.email)).toBeVisible();
        await expect(emailField(page)).toBeFocused();
      }
    });
  }

  for (const value of ["", "   ", "\t  "]) {
    test(`name ${JSON.stringify(value)} is rejected (trimmed)`, async ({ page }) => {
      await open(page);
      await fill(page, { name: value });
      await sendButton(page).click();
      await expect(page.getByText(MSG.name)).toBeVisible();
      await expect(nameField(page)).toBeFocused();
    });
  }

  test("pressing Enter in a text field submits and validates", async ({ page }) => {
    await open(page);
    await nameField(page).press("Enter");
    await expect(banner(page)).toBeVisible();
  });
});

test.describe("AC-4 valid submit, sending, success, reset", () => {
  test("sending state, success panel with focus, recap, reset; no request to /api/*; no console output", async ({
    page,
  }) => {
    const w = watch(page);
    await openWithClock(page);
    await fill(page, { name: "  Sam Lee ", email: " sam@example.com " });
    await sendButton(page).click();

    // The clock is paused, so the whole sending state is stable while these assertions run.
    await expect(sendingButton(page)).toBeDisabled();
    await expect(page.locator("form[aria-busy='true']")).toHaveCount(1);
    await expect(banner(page)).toHaveCount(0);
    await expect(page.getByText("Demo only. This form does not send anything.")).toBeVisible();
    await expect(nameField(page)).toBeDisabled();
    // F5: the sr-only status is a sibling AFTER the form, not inside it.
    await expect(page.locator("form [role='status']")).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "Sending request" })).toHaveCount(1);
    await expect(receivedHeading(page)).toHaveCount(0);

    await page.clock.runFor(1200);
    const status = successPanel(page);
    await expect(status).toBeVisible();
    await expect(status).toBeFocused();
    await expect(sendButton(page)).toHaveCount(0);
    await expect(status.locator("dt")).toHaveText(["Name", "Service", "Preferred", "Contact"]);
    await expect(status.locator("dd")).toHaveText(["Sam Lee", "Cleaning", "Thursday 3 December, 10:30", "sam@example.com"]);
    await expect(status).toContainText("Nothing was sent");

    await page.getByRole("button", { name: "Make another request" }).click();
    await expect(nameField(page)).toBeFocused();
    for (const f of [nameField(page), phoneField(page), emailField(page), dateField(page), timeField(page), notesField(page)]) {
      await expect(f).toHaveValue("");
    }
    await expect(serviceField(page)).toHaveValue("");
    await expect(banner(page)).toHaveCount(0);

    expect(w.api, "the simulated form must not call any /api/ route").toEqual([]);
    expect(w.out).toEqual([]);
  });

  test("the sending state lasts exactly 1200 ms: still sending at 1199, done at 1200", async ({ page }) => {
    await openWithClock(page);
    await fill(page);
    await sendButton(page).click();
    await expect(sendingButton(page)).toBeDisabled();
    await page.clock.runFor(1199);
    await expect(sendingButton(page)).toBeDisabled();
    await expect(receivedHeading(page)).toHaveCount(0);
    await page.clock.runFor(1);
    await expect(receivedHeading(page)).toBeVisible();
  });

  test("a second submit during sending does not restart the timer", async ({ page }) => {
    const w = watch(page);
    await openWithClock(page);
    await fill(page);
    await sendButton(page).click();
    await expect(sendingButton(page)).toBeDisabled();
    await page.clock.runFor(600);
    // The button is disabled, so submit the form the way a script would.
    await page.locator("form").evaluate((f) => (f as HTMLFormElement).requestSubmit());
    await page.clock.runFor(599);
    await expect(receivedHeading(page)).toHaveCount(0);
    // 600 + 599 + 1 = 1200 ms after the FIRST click: success must be here (a restart would push it to 1800 ms).
    await page.clock.runFor(1);
    await expect(receivedHeading(page)).toHaveCount(1);
    expect(w.api).toEqual([]);
  });

  test("entered text is shown as plain text in the recap", async ({ page }) => {
    await open(page);
    const name = "<b>Sam</b> <img src=x onerror=window.__xss=1>";
    await fill(page, { name });
    await sendButton(page).click();
    const status = successPanel(page);
    await expect(status).toContainText(name);
    await expect(status.getByRole("img")).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("diacritics, emoji and a long unbroken email stay inside the card at 320 px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page);
    await fill(page, {
      name: "Đặng Thị Ngọc Hân 🦊",
      email: "bartholomew.fitzgerald@northwind-industries-holdings.example.com",
    });
    await sendButton(page).click();
    await expect(receivedHeading(page)).toBeVisible();
    const { scrollWidth, clientWidth } = await horizontalScroll(page);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});

test.describe("AC-5 no network, no storage, no console, timer cleared", () => {
  test("no storage written and no session cookie created by the form flow", async ({ page }) => {
    await open(page);
    const read = () => page.evaluate(() => ({ l: localStorage.length, s: sessionStorage.length }));
    const before = await read();
    await fill(page);
    await sendButton(page).click();
    await expect(receivedHeading(page)).toBeVisible();
    expect(await read()).toEqual(before);
    expect((await page.context().cookies()).filter((c) => c.name === "nd_session")).toEqual([]);
  });

  test("the 1200 ms timer is cleared when the form unmounts (client navigation away)", async ({ page }) => {
    const w = watch(page);
    await page.clock.install({ time: new Date("2026-12-01T09:00:00") });
    // Registered AFTER the clock, so it wraps the fake timers and records the ids of the 1200 ms timer.
    await page.addInitScript(() => {
      const t = { set: [] as unknown[], cleared: [] as unknown[] };
      (window as unknown as { __t: typeof t }).__t = t;
      const st = window.setTimeout.bind(window);
      const ct = window.clearTimeout.bind(window);
      window.setTimeout = ((fn: TimerHandler, ms?: number, ...a: unknown[]) => {
        const id = st(fn, ms, ...a);
        if (ms === 1200) t.set.push(id);
        return id;
      }) as typeof window.setTimeout;
      window.clearTimeout = ((id?: number) => {
        t.cleared.push(id);
        ct(id);
      }) as typeof window.clearTimeout;
    });
    await page.goto("/contact");
    await waitForHydrated(sendButton(page));
    await page.clock.pauseAt(new Date("2026-12-01T09:05:00"));
    await fill(page);
    await sendButton(page).click();
    await expect(sendingButton(page)).toBeDisabled();
    const read = () => page.evaluate(() => (window as unknown as { __t: { set: unknown[]; cleared: unknown[] } }).__t);
    const before = await read();
    expect(before.set, "exactly one 1200 ms timer is set").toHaveLength(1);
    expect(before.cleared).not.toContain(before.set[0]);

    // Client-side navigation unmounts the form without a reload (the init script and its record survive).
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "FAQ" }).click();
    await expect(page).toHaveURL(/\/faq/);
    await expect.poll(async () => (await read()).cleared).toContain(before.set[0]);
    await page.clock.runFor(5000);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(w.out).toEqual([]);
    expect(w.api).toEqual([]);
  });
});

test.describe("Round 2: alignment, stable button width, no name attributes", () => {
  /** top/bottom of an element and the number of text lines of a label (distinct tops of its text rects). */
  async function edges(l: Locator) {
    return l.evaluate((el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom };
    });
  }
  async function lineCount(l: Locator) {
    return l.evaluate((el) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
    });
  }

  for (const vp of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
  ]) {
    for (const state of ["idle", "error"] as const) {
      test(`date and time inputs share top and bottom, labels stay on one line, at ${vp.width} in the ${state} state`, async ({
        page,
      }) => {
        await page.setViewportSize(vp);
        await open(page);
        if (state === "error") {
          await sendButton(page).click();
          await expect(banner(page)).toBeVisible();
          await expect(dateField(page)).toHaveAttribute("aria-invalid", "true");
        }
        const d = await edges(dateField(page));
        const t = await edges(timeField(page));
        expect(Math.abs(d.top - t.top), `top date ${d.top} vs time ${t.top}`).toBeLessThanOrEqual(1);
        expect(Math.abs(d.bottom - t.bottom), `bottom date ${d.bottom} vs time ${t.bottom}`).toBeLessThanOrEqual(1);
        expect(await lineCount(page.locator("label[for='appt-time']")), "time label wraps").toBe(1);
        expect(await lineCount(page.locator("label[for='appt-date']")), "date label wraps").toBe(1);
      });
    }

    test(`the Send button keeps its width when it says "Sending request", and the note beside it keeps its size, at ${vp.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(vp);
      await openWithClock(page);
      await fill(page);
      const note = page.locator("p", { hasText: "Demo only. This form does not send anything." });
      const size = async (l: Locator) => {
        const b = (await l.boundingBox())!;
        return { w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10 };
      };
      const btnIdle = await size(sendButton(page));
      const noteIdle = await size(note);
      await sendButton(page).click();
      await expect(sendingButton(page)).toBeDisabled();
      expect(await size(sendingButton(page)), "button size while sending").toEqual(btnIdle);
      expect(await size(note), "note size while sending").toEqual(noteIdle);
    });
  }

  // When a visitor raises the browser's default text size, one label can wrap while the other does not. The inputs must
  // still line up. The test sets the root font size (everything is rem based, like a larger default text size) and
  // requires that at least one case really wraps a label, otherwise it would prove nothing.
  test("date and time inputs still share top and bottom when a label wraps (larger text size)", async ({ page }) => {
    let wrapped = false;
    for (const [width, rootPx] of [
      [768, 20],
      [768, 24],
      [1024, 24],
      [1440, 30],
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      await page.addStyleTag({ content: `html { font-size: ${rootPx}px; }` });
      const d = await edges(dateField(page));
      const t = await edges(timeField(page));
      const lines = (await lineCount(page.locator("label[for='appt-time']"))) + (await lineCount(page.locator("label[for='appt-date']")));
      if (lines > 2) wrapped = true;
      expect(Math.abs(d.top - t.top), `top at ${width}/${rootPx}px: date ${d.top} vs time ${t.top}`).toBeLessThanOrEqual(1);
      expect(Math.abs(d.bottom - t.bottom), `bottom at ${width}/${rootPx}px`).toBeLessThanOrEqual(1);
    }
    expect(wrapped, "no case wraps a label: raise the root font size").toBe(true);
  });

  test("no control of the form has a name attribute", async ({ page }) => {
    await open(page);
    await expect(page.locator("form [name]")).toHaveCount(0);
    await expect(page.locator("form input, form select, form textarea")).toHaveCount(7);
  });

  test("without JavaScript a native submit puts none of the typed values in the URL", async ({ browser, baseURL }) => {
    // A fresh context with JS off is the closest stand-in for "submit before React has hydrated": the browser then
    // handles the submit natively, as a GET to the page itself. This proves that, with no name attributes, nothing the
    // visitor typed can end up in the address bar, history or server logs through that path. It does NOT prove the
    // hydrated form (covered by the other tests) and does not show whether the page reloads.
    const ctx = await browser.newContext({ baseURL, javaScriptEnabled: false });
    try {
      const page = await ctx.newPage();
      await page.goto("/contact");
      await nameField(page).fill("Sam Lee");
      await phoneField(page).fill("555 0100 123");
      await emailField(page).fill("sam@example.com");
      await serviceField(page).selectOption("Cleaning");
      await dateField(page).fill("2026-12-03");
      await timeField(page).fill("10:30");
      await notesField(page).fill("typed note");
      const before = page.url();
      // The native submit must really navigate (to the page itself, with or without a query), else the check is vacuous.
      await Promise.all([page.waitForURL((u) => u.href !== before), nameField(page).press("Enter")]);
      expect(new URL(page.url()).pathname).toBe("/contact");
      const u = new URL(page.url());
      const raw = decodeURIComponent(page.url());
      expect(u.search === "" || u.search === "?", `query was ${u.search.length} characters`).toBe(true);
      for (const typed of ["Sam", "555", "example.com", "Cleaning", "2026-12-03", "10%3A30", "typed note"]) {
        expect(raw.includes(typed), "a typed value reached the URL").toBe(false);
      }
    } finally {
      await ctx.close();
    }
  });
});

test.describe("AC-6 form-heading anchor", () => {
  test("/contact#form-heading loads, the target exists and labels the form region", async ({ page }) => {
    await page.goto("/contact#form-heading");
    await expect(page.locator("#form-heading")).toHaveCount(1);
    await expect(page.locator("section[aria-labelledby='form-heading']")).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Appointment request form" })).toBeVisible();
    await expect(nameField(page)).toBeInViewport();
  });
});

test.describe("AC-7 target size and overflow", () => {
  for (const vp of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    test(`controls are at least 44 px high at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await open(page);
      const controls = [
        nameField(page),
        phoneField(page),
        emailField(page),
        serviceField(page),
        dateField(page),
        timeField(page),
        notesField(page),
        sendButton(page),
      ];
      for (const c of controls) {
        const box = await c.boundingBox();
        expect(box, "control must be rendered").not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      await fill(page);
      await sendButton(page).click();
      const another = page.getByRole("button", { name: "Make another request" });
      await expect(another).toBeVisible();
      expect((await another.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    });
  }

  const sizes = [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 667, height: 375 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
  ];
  for (const vp of sizes) {
    test(`no horizontal overflow in error and success states at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await open(page);
      await sendButton(page).click();
      await expect(banner(page)).toBeVisible();
      let h = await horizontalScroll(page);
      expect(h.scrollWidth, "error state").toBeLessThanOrEqual(h.clientWidth);
      await fill(page);
      await sendButton(page).click();
      await expect(receivedHeading(page)).toBeVisible();
      h = await horizontalScroll(page);
      expect(h.scrollWidth, "success state").toBeLessThanOrEqual(h.clientWidth);
    });
  }
});

// ---------------------------------------------------------------------------------------------------------------------
// Date and time pickers (components/appointment/*) and required marks. Roles, labels and visible text only.
// "Today" is pinned with page.clock.setFixedTime (Dec 1 2026, 12:00 UTC, in a UTC browser), which changes Date only:
// no timer is faked, so nothing here depends on machine speed and there is no fixed sleep.
// ---------------------------------------------------------------------------------------------------------------------

const calendarButton = (p: Page) => p.getByRole("button", { name: "Open calendar" });
const calendarDialog = (p: Page) => p.getByRole("dialog", { name: "Calendar" });
const timePickerButton = (p: Page) => p.getByRole("button", { name: "Open time picker" });
const timeDialog = (p: Page) => p.getByRole("dialog", { name: "Time picker" });
const dayButton = (p: Page, label: string) => calendarDialog(p).getByRole("button", { name: label, exact: true });
const hourButton = (p: Page, hh: string) => timeDialog(p).getByRole("button", { name: `Hour ${hh}`, exact: true });
const minuteButton = (p: Page, mm: string) => timeDialog(p).getByRole("button", { name: `Minute ${mm}`, exact: true });

const FIXED_NOW = new Date(Date.UTC(2026, 11, 1, 12, 0, 0));

async function openPinned(page: Page) {
  await page.clock.setFixedTime(FIXED_NOW);
  await open(page);
}

/** Fills everything except date and time, so a test can set those two through the pickers. */
async function fillWithoutWhen(page: Page) {
  await fill(page, { date: "", time: "" });
}

test.describe("Pickers: date popover", () => {
  test.use({ timezoneId: "UTC" });

  test("AC-2a: opens from 'Open calendar' with an English month title and weekday headers; picking a day writes 'Dec 3, 2026'; the recap still reads 'Thursday 3 December, 10:30'", async ({
    page,
  }) => {
    const w = watch(page);
    await openPinned(page);
    await expect(calendarDialog(page)).toBeHidden();
    await expect(calendarButton(page)).toHaveAttribute("aria-expanded", "false");

    await calendarButton(page).click();
    await expect(calendarDialog(page)).toBeVisible();
    await expect(calendarButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect(calendarDialog(page).getByText("December 2026", { exact: true })).toBeVisible();
    for (const h of ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]) {
      await expect(calendarDialog(page).getByText(h, { exact: true })).toHaveCount(1);
    }
    // Sunday first: Su is the first header.
    await expect(calendarDialog(page).locator("[aria-hidden='true'] > span")).toHaveText(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    await expect(calendarDialog(page).getByRole("button", { name: "Previous month" })).toBeVisible();
    await expect(calendarDialog(page).getByRole("button", { name: "Next month" })).toBeVisible();
    // With no value the calendar opens on today, which is marked with aria-current and holds the focus.
    await expect(dayButton(page, "Tuesday, December 1, 2026")).toHaveAttribute("aria-current", "date");
    await expect(dayButton(page, "Tuesday, December 1, 2026")).toBeFocused();
    await expect(calendarDialog(page).locator("[aria-current='date']")).toHaveCount(1);
    await expect(calendarDialog(page).locator("[aria-pressed='true']")).toHaveCount(0);

    await dayButton(page, "Thursday, December 3, 2026").click();
    await expect(calendarDialog(page)).toBeHidden();
    await expect(dateField(page)).toHaveValue("Dec 3, 2026");
    await expect(calendarButton(page)).toBeFocused();

    // Reopening shows the chosen day as pressed and focused.
    await calendarButton(page).click();
    await expect(dayButton(page, "Thursday, December 3, 2026")).toHaveAttribute("aria-pressed", "true");
    await expect(dayButton(page, "Thursday, December 3, 2026")).toBeFocused();
    await expect(calendarDialog(page).locator("[aria-pressed='true']")).toHaveCount(1);
    // The toggle button closes it again.
    await calendarButton(page).click();
    await expect(calendarDialog(page)).toBeHidden();

    // Finish through the time popover and submit: the recap keeps its own English format.
    await nameField(page).fill("Sam Lee");
    await phoneField(page).fill("555 0100 123");
    await emailField(page).fill("sam@example.com");
    await serviceField(page).selectOption("Cleaning");
    await timePickerButton(page).click();
    await hourButton(page, "10").click();
    await minuteButton(page, "30").click();
    await expect(timeField(page)).toHaveValue("10:30");
    await sendButton(page).click();
    await expect(successPanel(page).locator("dd")).toHaveText(["Sam Lee", "Cleaning", "Thursday 3 December, 10:30", "sam@example.com"]);
    expect(w.api).toEqual([]);
    expect(w.out).toEqual([]);
  });

  test("AC-2a: the popover opens on the month of the typed date and typing a valid date clears the date error", async ({ page }) => {
    await openPinned(page);
    await fillWithoutWhen(page);
    await timeField(page).fill("10:30");
    await sendButton(page).click();
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true");

    await dateField(page).fill("Mar 9, 2027");
    await expect(dateField(page)).not.toHaveAttribute("aria-invalid", "true");
    await calendarButton(page).click();
    await expect(calendarDialog(page).getByText("March 2027", { exact: true })).toBeVisible();
    await expect(dayButton(page, "Tuesday, March 9, 2027")).toBeFocused();
  });

  test("F1: the calendar trigger keeps its name and gets a description only when a date exists (pick, typed, junk, reset)", async ({
    page,
  }) => {
    await openPinned(page);
    await expect(calendarButton(page)).toHaveAccessibleName("Open calendar");
    await expect(calendarButton(page)).toHaveAccessibleDescription("");
    await expect(calendarButton(page)).not.toHaveAttribute("aria-describedby", /.+/);

    await calendarButton(page).click();
    await dayButton(page, "Thursday, December 3, 2026").click();
    await expect(calendarButton(page)).toBeFocused();
    await expect(calendarButton(page)).toHaveAccessibleDescription("Selected date: Thursday, December 3, 2026");
    await expect(calendarButton(page)).toHaveAccessibleName("Open calendar");

    await dateField(page).fill("dec 4 2026");
    await expect(calendarButton(page)).toHaveAccessibleDescription("Selected date: Friday, December 4, 2026");
    await dateField(page).fill("Feb 30, 2026");
    await expect(calendarButton(page)).toHaveAccessibleDescription("");
    await expect(calendarButton(page)).not.toHaveAttribute("aria-describedby", /.+/);

    await fill(page);
    await sendButton(page).click();
    await expect(receivedHeading(page)).toBeVisible();
    await page.getByRole("button", { name: "Make another request" }).click();
    await expect(calendarButton(page)).toHaveAccessibleDescription("");
  });

  test("F2: today is marked with aria-current and a dot child (no ring); the dot is brand on a plain cell and canvas on the selected cell", async ({
    page,
  }) => {
    await openPinned(page);
    await calendarButton(page).click();
    const today = dayButton(page, "Tuesday, December 1, 2026");
    await expect(calendarDialog(page).locator("[aria-current='date']")).toHaveCount(1);
    await expect(today).toHaveAttribute("aria-current", "date");
    const dot = today.locator("span[aria-hidden='true']");
    await expect(dot).toHaveCount(1);
    await expect(calendarDialog(page).locator("button span[aria-hidden='true']")).toHaveCount(1);
    const rgb = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(await rgb(dot), "unselected today: brand dot").toBe("rgb(3, 105, 161)");
    const dotBox = (await dot.boundingBox())!;
    const cellBox = (await today.boundingBox())!;
    expect(dotBox.width).toBeCloseTo(4, 0);
    expect(dotBox.y + dotBox.height, "dot sits inside the cell").toBeLessThanOrEqual(cellBox.y + cellBox.height);
    expect(dotBox.y, "dot is in the lower half of the cell").toBeGreaterThan(cellBox.y + cellBox.height / 2);
    await page.keyboard.press("ArrowRight");
    expect(await today.evaluate((el) => getComputedStyle(el).boxShadow), "no ring box-shadow").toBe("none");
    expect(await today.evaluate((el) => parseFloat(getComputedStyle(el).fontWeight)), "today is semibold").toBeGreaterThanOrEqual(600);

    await today.click();
    await calendarButton(page).click();
    const dot2 = today.locator("span[aria-hidden='true']");
    await expect(today).toHaveAttribute("aria-pressed", "true");
    expect(await rgb(dot2), "selected today: canvas dot").toBe("rgb(251, 248, 242)");
    expect(await rgb(today), "selected cell fill").toBe("rgb(3, 105, 161)");

    await calendarDialog(page).getByRole("button", { name: "Next month" }).click();
    await expect(calendarDialog(page).locator("[aria-current='date']")).toHaveCount(0);
    await expect(calendarDialog(page).locator("button span[aria-hidden='true']")).toHaveCount(0);
  });

  test("AC-2c: Escape closes the date popover and returns focus to 'Open calendar'", async ({ page }) => {
    await openPinned(page);
    await calendarButton(page).click();
    await expect(calendarDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(calendarDialog(page)).toBeHidden();
    await expect(calendarButton(page)).toBeFocused();
    await expect(calendarButton(page)).toHaveAttribute("aria-expanded", "false");
    // Escape with the popover closed does nothing harmful: the page and the form are still there.
    await page.keyboard.press("Escape");
    await expect(calendarButton(page)).toBeFocused();
    await expect(sendButton(page)).toBeVisible();
  });

  test("AC-2c: arrow keys move the day focus, PageDown/PageUp change the month, Enter picks", async ({ page }) => {
    await openPinned(page);
    await dateField(page).fill("2026-12-03");
    await calendarButton(page).click();
    await expect(dayButton(page, "Thursday, December 3, 2026")).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(dayButton(page, "Friday, December 4, 2026")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(dayButton(page, "Thursday, December 3, 2026")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(dayButton(page, "Thursday, December 10, 2026")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(dayButton(page, "Thursday, December 3, 2026")).toBeFocused();

    await page.keyboard.press("PageDown");
    await expect(calendarDialog(page).getByText("January 2027", { exact: true })).toBeVisible();
    await expect(dayButton(page, "Sunday, January 3, 2027")).toBeFocused();
    await page.keyboard.press("PageUp");
    await expect(calendarDialog(page).getByText("December 2026", { exact: true })).toBeVisible();
    await expect(dayButton(page, "Thursday, December 3, 2026")).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(calendarDialog(page)).toBeHidden();
    await expect(dateField(page)).toHaveValue("Dec 4, 2026");
    await expect(calendarButton(page)).toBeFocused();
  });

  test("AC-2c: arrow keys cross a month edge and PageDown from Jan 31 clamps to Feb 28", async ({ page }) => {
    await openPinned(page);
    await dateField(page).fill("2026-12-01");
    await calendarButton(page).click();
    await page.keyboard.press("ArrowLeft");
    await expect(calendarDialog(page).getByText("November 2026", { exact: true })).toBeVisible();
    await expect(dayButton(page, "Monday, November 30, 2026")).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(calendarDialog(page)).toBeHidden();
    await dateField(page).fill("2027-01-31");
    await calendarButton(page).click();
    await page.keyboard.press("PageDown");
    await expect(calendarDialog(page).getByText("February 2027", { exact: true })).toBeVisible();
    await expect(dayButton(page, "Sunday, February 28, 2027")).toBeFocused();
  });

  test("AC-2d: while the popover is open, typing a valid date moves the grid to that month and marks the day", async ({ page }) => {
    await openPinned(page);
    await calendarButton(page).click();
    await dayButton(page, "Thursday, December 3, 2026").click();
    await expect(dateField(page)).toHaveValue("Dec 3, 2026");
    await calendarButton(page).click();
    await expect(calendarDialog(page).getByText("December 2026", { exact: true })).toBeVisible();
    await dateField(page).fill("Mar 9, 2027");
    await expect(calendarDialog(page)).toBeVisible();
    await expect(calendarDialog(page).getByText("March 2027", { exact: true })).toBeVisible();
    await expect(dayButton(page, "Tuesday, March 9, 2027")).toHaveAttribute("aria-pressed", "true");
    await expect(calendarDialog(page).locator("[aria-pressed='true']")).toHaveCount(1);
    // Text that does not parse leaves the grid where it is.
    await dateField(page).fill("Mar 9, 20");
    await expect(calendarDialog(page).getByText("March 2027", { exact: true })).toBeVisible();
  });

  test("AC-2c: Escape during IME composition does not close either popover (isComposing and keyCode 229); a plain Escape does", async ({
    page,
  }) => {
    await openPinned(page);
    const press = (loc: Locator, init: { isComposing?: boolean; keyCode?: number }) =>
      loc.evaluate((el, i) => {
        const ev = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true, ...i });
        el.dispatchEvent(ev);
      }, init);

    await calendarButton(page).click();
    const day = dayButton(page, "Tuesday, December 1, 2026");
    await expect(day).toBeFocused();
    await press(day, { isComposing: true });
    await press(day, { keyCode: 229 });
    await expect(calendarDialog(page)).toBeVisible();
    await press(day, {});
    await expect(calendarDialog(page)).toBeHidden();
    await expect(calendarButton(page)).toBeFocused();

    await timePickerButton(page).click();
    const hour = hourButton(page, "09");
    await expect(hour).toBeFocused();
    await press(hour, { isComposing: true });
    await press(hour, { keyCode: 229 });
    await expect(timeDialog(page)).toBeVisible();
    await press(hour, {});
    await expect(timeDialog(page)).toBeHidden();
    await expect(timePickerButton(page)).toBeFocused();
  });

  test("AC-2c: Previous/Next month buttons change the month title; 42 labelled days are always shown", async ({ page }) => {
    await openPinned(page);
    await calendarButton(page).click();
    await calendarDialog(page).getByRole("button", { name: "Next month" }).click();
    await expect(calendarDialog(page).getByText("January 2027", { exact: true })).toBeVisible();
    await calendarDialog(page).getByRole("button", { name: "Previous month" }).click();
    await calendarDialog(page).getByRole("button", { name: "Previous month" }).click();
    await expect(calendarDialog(page).getByText("November 2026", { exact: true })).toBeVisible();
    await expect(calendarDialog(page).getByRole("button", { name: /^\w+, \w+ \d+, \d{4}$/ })).toHaveCount(42);
  });

  test("AC-2c: a pointer press outside the picker closes it", async ({ page }) => {
    await openPinned(page);
    await calendarButton(page).click();
    await expect(calendarDialog(page)).toBeVisible();
    await nameField(page).click();
    await expect(calendarDialog(page)).toBeHidden();
    await expect(nameField(page)).toBeFocused();
  });

  test("AC-2c: Tab within the picker keeps it open; focus moving to another field closes it", async ({ page }) => {
    await openPinned(page);
    await calendarButton(page).click();
    await expect(calendarDialog(page)).toBeVisible();
    await dateField(page).focus();
    await page.keyboard.press("Tab"); // to 'Open calendar' (same wrapper: stays open)
    await expect(calendarButton(page)).toBeFocused();
    await expect(calendarDialog(page)).toBeVisible();
    await timeField(page).focus();
    await expect(calendarDialog(page)).toBeHidden();
  });

  test("AC-2d: typed 'dec 3 2026' is normalised to 'Dec 3, 2026' on blur; other accepted formats too", async ({ page }) => {
    await openPinned(page);
    const cases: [string, string][] = [
      ["dec 3 2026", "Dec 3, 2026"],
      ["December 3, 2026", "Dec 3, 2026"],
      ["DEC 03, 2026", "Dec 3, 2026"],
      ["2026-12-03", "Dec 3, 2026"],
      ["2026-2-3", "Feb 3, 2026"],
    ];
    for (const [typed, shown] of cases) {
      await dateField(page).fill(typed);
      await dateField(page).blur();
      await expect(dateField(page), typed).toHaveValue(shown);
    }
  });

  test("AC-2d: a normalised typed date and time reach the recap", async ({ page }) => {
    await openPinned(page);
    await fillWithoutWhen(page);
    await dateField(page).fill("dec 3 2026");
    await dateField(page).blur();
    await timeField(page).fill("9:05");
    await timeField(page).blur();
    await expect(timeField(page)).toHaveValue("09:05");
    await sendButton(page).click();
    await expect(successPanel(page).locator("dd").nth(2)).toHaveText("Thursday 3 December, 09:05");
  });

  const junkDates = ["banana", "Feb 30, 2026", "Feb 29, 2027", "2026-13-01", "Dec 3, 26", "12/03/2026", "Dec 3"];
  for (const junk of junkDates) {
    test(`AC-2d: junk date ${JSON.stringify(junk)} stays as typed, is rejected on submit with the shared message and focus`, async ({
      page,
    }) => {
      const w = watch(page);
      await openPinned(page);
      await fill(page, { date: "" });
      await dateField(page).fill(junk);
      await dateField(page).blur();
      await expect(dateField(page)).toHaveValue(junk);
      await sendButton(page).click();
      await expect(page.getByText(MSG.when)).toHaveCount(1);
      await expect(dateField(page)).toHaveAttribute("aria-invalid", "true");
      await expect(dateField(page)).toHaveAttribute("aria-describedby", "appt-when-error");
      await expect(dateField(page)).toBeFocused();
      await expect(timeField(page)).not.toHaveAttribute("aria-invalid", "true");
      await expect(banner(page)).toHaveText(ONE_FIELD);
      await expect(receivedHeading(page)).toHaveCount(0);
      expect(w.api).toEqual([]);
    });
  }

  test("AC-2d: a date that is typed wrong and then corrected submits", async ({ page }) => {
    await openPinned(page);
    await fill(page, { date: "Feb 30, 2026" });
    await sendButton(page).click();
    await expect(dateField(page)).toHaveAttribute("aria-invalid", "true");
    await dateField(page).fill("Feb 27, 2026");
    await expect(page.getByText(MSG.when)).toHaveCount(0);
    await sendButton(page).click();
    await expect(successPanel(page).locator("dd").nth(2)).toHaveText("Friday 27 February, 10:30");
  });

  test("AC-2d: 'Make another request' empties the date and time text and the popover works again", async ({ page }) => {
    await openPinned(page);
    await fill(page);
    await dateField(page).blur();
    await sendButton(page).click();
    await expect(receivedHeading(page)).toBeVisible();
    await page.getByRole("button", { name: "Make another request" }).click();
    await expect(dateField(page)).toHaveValue("");
    await expect(timeField(page)).toHaveValue("");
    await calendarButton(page).click();
    await expect(calendarDialog(page).getByText("December 2026", { exact: true })).toBeVisible();
    await expect(calendarDialog(page).locator("[aria-pressed='true']")).toHaveCount(0);
  });
});

test.describe("Pickers: time popover", () => {
  test.use({ timezoneId: "UTC" });

  test("AC-2b: pick hour 10 then minute 30 writes '10:30'; the hour keeps the popover open, the minute closes it", async ({
    page,
  }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    await expect(timeDialog(page)).toBeVisible();
    await expect(timePickerButton(page)).toHaveAttribute("aria-expanded", "true");
    await expect(hourButton(page, "09")).toBeFocused();

    await hourButton(page, "10").click();
    await expect(timeDialog(page)).toBeVisible();
    await expect(timeField(page)).toHaveValue("10:00");
    await expect(hourButton(page, "10")).toHaveAttribute("aria-pressed", "true");
    await minuteButton(page, "30").click();
    await expect(timeDialog(page)).toBeHidden();
    await expect(timeField(page)).toHaveValue("10:30");
    await expect(timePickerButton(page)).toBeFocused();

    await timePickerButton(page).click();
    await expect(hourButton(page, "10")).toBeFocused();
    await expect(hourButton(page, "10")).toHaveAttribute("aria-pressed", "true");
    await expect(minuteButton(page, "30")).toHaveAttribute("aria-pressed", "true");
    await expect(timeDialog(page).locator("[aria-pressed='true']")).toHaveCount(2);
  });

  test("AC-2b: the hour grid is exactly 09 to 17 and the minutes are 00, 15, 30, 45 (24-hour, no AM/PM)", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    const hours = timeDialog(page).getByRole("button", { name: /^Hour / });
    await expect(hours).toHaveCount(9);
    await expect(hours.first()).toHaveText("09");
    await expect(hours.last()).toHaveText("17");
    await expect(timeDialog(page).getByRole("button", { name: "Hour 08" })).toHaveCount(0);
    await expect(timeDialog(page).getByRole("button", { name: "Hour 18" })).toHaveCount(0);
    await expect(timeDialog(page).getByRole("button", { name: /^Minute / })).toHaveText(["00", "15", "30", "45"]);
    await expect(timeDialog(page).getByText(/\b(AM|PM)\b/i)).toHaveCount(0);
  });

  test("AC-2b: with no hour chosen yet the minute buttons are disabled; choosing an hour enables them", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    for (const mm of ["00", "15", "30", "45"]) await expect(minuteButton(page, mm)).toBeDisabled();
    await hourButton(page, "13").click();
    for (const mm of ["00", "15", "30", "45"]) await expect(minuteButton(page, mm)).toBeEnabled();
  });

  test("AC-2b: hour 17 disables minutes 15, 30 and 45 and leaves 00; 16 allows all (boundary)", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    await hourButton(page, "16").click();
    for (const mm of ["00", "15", "30", "45"]) await expect(minuteButton(page, mm)).toBeEnabled();
    await hourButton(page, "17").click();
    await expect(minuteButton(page, "00")).toBeEnabled();
    for (const mm of ["15", "30", "45"]) await expect(minuteButton(page, mm)).toBeDisabled();
    await expect(timeField(page)).toHaveValue("17:00");
    await minuteButton(page, "30").dispatchEvent("click");
    await expect(timeField(page)).toHaveValue("17:00");
    await expect(timeDialog(page)).toBeVisible();
    await minuteButton(page, "00").click();
    await expect(timeDialog(page)).toBeHidden();
    await expect(timeField(page)).toHaveValue("17:00");
  });

  test("AC-2b: switching the hour keeps the minute when it is allowed and resets it to 00 for hour 17", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    await hourButton(page, "10").click();
    await minuteButton(page, "45").click();
    await expect(timeField(page)).toHaveValue("10:45");
    await timePickerButton(page).click();
    await hourButton(page, "11").click();
    await expect(timeField(page)).toHaveValue("11:45");
    await hourButton(page, "17").click();
    await expect(timeField(page)).toHaveValue("17:00");
    await hourButton(page, "09").click();
    await expect(timeField(page)).toHaveValue("09:00");
  });

  test("AC-2b: a typed time outside the grid still opens the popover on the first hour", async ({ page }) => {
    await openPinned(page);
    await timeField(page).fill("20:15");
    await timePickerButton(page).click();
    await expect(hourButton(page, "09")).toBeFocused();
    await expect(minuteButton(page, "15")).toHaveAttribute("aria-pressed", "true");
    // Only the closing hour (17) restricts minutes: hour 20 is not 17, so all four stay enabled.
    for (const mm of ["00", "15", "30", "45"]) await expect(minuteButton(page, mm)).toBeEnabled();
  });

  test("F1: the time trigger keeps its name and gets a description only when a time exists (pick, typed, junk)", async ({ page }) => {
    await openPinned(page);
    await expect(timePickerButton(page)).toHaveAccessibleName("Open time picker");
    await expect(timePickerButton(page)).toHaveAccessibleDescription("");
    await expect(timePickerButton(page)).not.toHaveAttribute("aria-describedby", /.+/);

    await timePickerButton(page).click();
    await hourButton(page, "10").click();
    await minuteButton(page, "30").click();
    await expect(timePickerButton(page)).toBeFocused();
    await expect(timePickerButton(page)).toHaveAccessibleDescription("Selected time: 10:30");
    await expect(timePickerButton(page)).toHaveAccessibleName("Open time picker");

    await timeField(page).fill("9:05");
    await expect(timePickerButton(page)).toHaveAccessibleDescription("Selected time: 09:05");
    await timeField(page).fill("abc");
    await expect(timePickerButton(page)).toHaveAccessibleDescription("");
    await expect(timePickerButton(page)).not.toHaveAttribute("aria-describedby", /.+/);
  });

  test("AC-2c: Escape closes the time popover and returns focus to 'Open time picker'; the picked hour is kept", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    await expect(timeDialog(page)).toBeVisible();
    await hourButton(page, "10").click();
    await page.keyboard.press("Escape");
    await expect(timeDialog(page)).toBeHidden();
    await expect(timePickerButton(page)).toBeFocused();
    await expect(timePickerButton(page)).toHaveAttribute("aria-expanded", "false");
    await expect(timeField(page)).toHaveValue("10:00");
  });

  test("AC-2c: arrow keys, Home and End move through the hours (3 columns) and the minutes", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    await expect(hourButton(page, "09")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(hourButton(page, "10")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(hourButton(page, "13")).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(hourButton(page, "10")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await expect(hourButton(page, "09")).toBeFocused();
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowUp");
    await expect(hourButton(page, "09")).toBeFocused();
    await page.keyboard.press("End");
    await expect(hourButton(page, "17")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowDown");
    await expect(hourButton(page, "17")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(hourButton(page, "09")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(timeField(page)).toHaveValue("09:00");
    await expect(timeDialog(page)).toBeVisible();
    await minuteButton(page, "00").focus();
    await page.keyboard.press("ArrowRight");
    await expect(minuteButton(page, "15")).toBeFocused();
    await page.keyboard.press("End");
    await expect(minuteButton(page, "45")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(minuteButton(page, "45")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(minuteButton(page, "00")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Enter");
    await expect(timeDialog(page)).toBeHidden();
    await expect(timeField(page)).toHaveValue("09:30");
  });

  test("AC-2c: at hour 17 the minute keys skip the disabled minutes", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    await hourButton(page, "17").click();
    await minuteButton(page, "00").focus();
    await page.keyboard.press("ArrowRight");
    await expect(minuteButton(page, "00")).toBeFocused();
    await page.keyboard.press("End");
    await expect(minuteButton(page, "00")).toBeFocused();
  });

  test("AC-2c: a pointer press outside closes the time popover", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    await expect(timeDialog(page)).toBeVisible();
    await nameField(page).click();
    await expect(timeDialog(page)).toBeHidden();
  });

  test("AC-2d: typed '9:30' becomes '09:30' on blur", async ({ page }) => {
    await openPinned(page);
    await timeField(page).fill("9:30");
    await timeField(page).blur();
    await expect(timeField(page)).toHaveValue("09:30");
  });

  for (const junk of ["abc", "24:00", "10:60", "10:5", "1030", "10:30 am"]) {
    test(`AC-2d: junk time ${JSON.stringify(junk)} stays as typed and is rejected on submit`, async ({ page }) => {
      await openPinned(page);
      await fill(page, { time: junk });
      await timeField(page).blur();
      await expect(timeField(page)).toHaveValue(junk);
      await sendButton(page).click();
      await expect(page.getByText(MSG.when)).toHaveCount(1);
      await expect(timeField(page)).toHaveAttribute("aria-invalid", "true");
      await expect(timeField(page)).toBeFocused();
      await expect(dateField(page)).not.toHaveAttribute("aria-invalid", "true");
      await expect(receivedHeading(page)).toHaveCount(0);
    });
  }

  test("AC-2d: a parseable time outside clinic hours (20:15) is accepted, as before (documents current behaviour: no hours rule)", async ({
    page,
  }) => {
    await openPinned(page);
    await fill(page, { time: "20:15" });
    await sendButton(page).click();
    await expect(successPanel(page).locator("dd").nth(2)).toHaveText("Thursday 3 December, 20:15");
  });
});

test.describe("Pickers: a Vietnamese browser locale does not leak into the picker (the original bug)", () => {
  test.use({ locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh" });

  const VIET = /Tháng|Thứ|Chủ nhật|\bT[2-7]\b|\bCN\b|Giờ|Phút|Lịch/;

  /** All text and all accessible names (aria-label) inside a dialog. */
  async function dialogStrings(dialog: Locator): Promise<string[]> {
    return dialog.evaluate((el) => {
      const out = [el.textContent ?? "", el.getAttribute("aria-label") ?? ""];
      for (const n of el.querySelectorAll("[aria-label]")) out.push(n.getAttribute("aria-label") ?? "");
      return out;
    });
  }

  test("AC-2e: precondition: the browser really runs in vi-VN (its own Intl prints a Vietnamese month)", async ({ page }) => {
    await openPinned(page);
    expect(await page.evaluate(() => navigator.language)).toBe("vi-VN");
    const viMonth = await page.evaluate(() => new Intl.DateTimeFormat(undefined, { month: "long" }).format(new Date(2026, 11, 3)));
    expect(viMonth, "the locale must produce a Vietnamese month, otherwise the next tests prove nothing").toMatch(/háng/);
  });

  test("AC-2e: calendar title, weekday headers, day names and the shown date are English under vi-VN", async ({ page }) => {
    await openPinned(page);
    await calendarButton(page).click();
    await expect(calendarDialog(page)).toBeVisible();
    await expect(calendarDialog(page).getByText("December 2026", { exact: true })).toBeVisible();
    await expect(calendarDialog(page).locator("[aria-hidden='true'] > span")).toHaveText(["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]);
    for (const s of await dialogStrings(calendarDialog(page))) {
      expect(s).not.toMatch(VIET);
      expect(s, "no non-ASCII text in the calendar").toMatch(/^[\x00-\x7F]*$/);
    }
    // Today (Dec 1 in Ho Chi Minh time) is a Tuesday, in English.
    await expect(dayButton(page, "Tuesday, December 1, 2026")).toHaveAttribute("aria-current", "date");

    await dayButton(page, "Thursday, December 3, 2026").click();
    const shown = await dateField(page).inputValue();
    expect(shown).toBe("Dec 3, 2026");
    expect(shown).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
    await expect(dateField(page)).toHaveAttribute("placeholder", "e.g. Dec 3, 2026");
  });

  test("AC-2e: the time picker is English with 24-hour digits under vi-VN", async ({ page }) => {
    await openPinned(page);
    await timePickerButton(page).click();
    await expect(timeDialog(page)).toBeVisible();
    await expect(timeDialog(page).getByText("Hour", { exact: true })).toBeVisible();
    await expect(timeDialog(page).getByText("Minute", { exact: true })).toBeVisible();
    for (const s of await dialogStrings(timeDialog(page))) {
      expect(s).not.toMatch(VIET);
      expect(s).toMatch(/^[\x00-\x7F]*$/);
    }
    await hourButton(page, "10").click();
    await minuteButton(page, "30").click();
    await expect(timeField(page)).toHaveValue("10:30");
    await expect(timeField(page)).toHaveAttribute("placeholder", "e.g. 10:30");
  });

  test("AC-2e: the full flow under vi-VN ends with the English recap", async ({ page }) => {
    await openPinned(page);
    await fillWithoutWhen(page);
    await calendarButton(page).click();
    await dayButton(page, "Thursday, December 3, 2026").click();
    await timePickerButton(page).click();
    await hourButton(page, "10").click();
    await minuteButton(page, "30").click();
    await sendButton(page).click();
    await expect(successPanel(page).locator("dd").nth(2)).toHaveText("Thursday 3 December, 10:30");
    await page.getByRole("button", { name: "Make another request" }).click();
    await dateField(page).fill("dec 3 2026");
    await dateField(page).blur();
    await expect(dateField(page)).toHaveValue("Dec 3, 2026");
  });
});

test.describe("Pickers: required marks", () => {
  const REQUIRED: [string, string][] = [
    ["appt-name", "Full name"],
    ["appt-phone", "Phone"],
    ["appt-email", "Email"],
    ["appt-service", "Service"],
    ["appt-date", "Preferred date"],
    ["appt-time", "Preferred time"],
  ];

  test("AC-2f: each of the six required labels shows a visible '*' (aria-hidden) at its end and its control is required", async ({
    page,
  }) => {
    await page.goto("/contact");
    for (const [id, text] of REQUIRED) {
      const label = page.locator(`label[for='${id}']`);
      const star = label.locator("span[aria-hidden='true']", { hasText: "*" });
      await expect(star, id).toHaveCount(1);
      await expect(star, id).toBeVisible();
      await expect(star, id).toHaveText("*");
      await expect(label, id).toContainText(text);
      expect(((await label.textContent()) ?? "").trim().endsWith("*"), `${id}: star at the end`).toBe(true);
      const control = page.locator(`#${id}`);
      await expect(control, id).toHaveJSProperty("required", true);
      await expect(control, id).toHaveAttribute("required", "");
    }
  });

  test("AC-2f: Notes is optional: no '*' in its label and its textarea is not required", async ({ page }) => {
    await page.goto("/contact");
    const label = page.locator("label[for='appt-notes']");
    await expect(label).toContainText("Notes");
    await expect(label).toContainText("(optional)");
    expect(((await label.textContent()) ?? "").includes("*")).toBe(false);
    await expect(label.locator("span[aria-hidden='true']")).toHaveCount(0);
    await expect(notesField(page)).toHaveJSProperty("required", false);
    await expect(notesField(page)).not.toHaveAttribute("required", /.*/);
  });

  test("AC-2f: exactly six controls are required (the picker buttons are not) and there are seven stars (6 labels + the note)", async ({
    page,
  }) => {
    await page.goto("/contact");
    await expect(page.locator("form [required]")).toHaveCount(6);
    await expect(page.locator("form button[required]")).toHaveCount(0);
    await expect(page.locator("form span[aria-hidden='true']", { hasText: /^\*$/ })).toHaveCount(7);
  });

  test("AC-2f: the note 'Fields marked * are required.' is visible, above the first group, with an sr-only 'with an asterisk'", async ({
    page,
  }) => {
    await page.goto("/contact");
    const note = page.locator("form p", { hasText: "are required" });
    await expect(note).toHaveCount(1);
    await expect(note).toBeVisible();
    await expect(note).toContainText("Fields marked");
    await expect(note).toContainText("are required.");
    await expect(note.locator("span[aria-hidden='true']")).toHaveText("*");
    await expect(note.locator("span.sr-only")).toHaveText("with an asterisk");
    const noteBox = (await note.boundingBox())!;
    const groupBox = (await page.getByRole("group", { name: "About you" }).boundingBox())!;
    expect(noteBox.y, "the note sits above the first fieldset").toBeLessThan(groupBox.y);
    // The note is outside the fieldsets: the group name stays exactly "About you".
    await expect(page.getByRole("group", { name: "About you", exact: true })).toBeVisible();
  });

  test("AC-2f: accessible names are exactly the label text (the star adds nothing)", async ({ page }) => {
    await page.goto("/contact");
    await expect(nameField(page)).toHaveAccessibleName("Full name");
    await expect(phoneField(page)).toHaveAccessibleName("Phone");
    await expect(emailField(page)).toHaveAccessibleName("Email");
    await expect(serviceField(page)).toHaveAccessibleName("Service");
    await expect(dateField(page)).toHaveAccessibleName("Preferred date");
    await expect(timeField(page)).toHaveAccessibleName("Preferred time (open 9:00 to 17:00)");
    await expect(notesField(page)).toHaveAccessibleName("Notes (optional)");
    await expect(calendarButton(page)).toHaveAccessibleName("Open calendar");
    await expect(timePickerButton(page)).toHaveAccessibleName("Open time picker");
    await expect(page.getByRole("textbox", { name: "Full name", exact: true })).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "Preferred date", exact: true })).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "Preferred time (open 9:00 to 17:00)", exact: true })).toHaveCount(1);
  });
});

test.describe("Pickers: popovers stay inside the viewport and cause no horizontal scroll", () => {
  test.use({ timezoneId: "UTC" });

  const sizes = [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ];

  /**
   * The dialog box must lie inside the viewport horizontally, and every enabled control inside it must be the element
   * that really receives a pointer at its centre (nothing, such as the fixed chat button or the phone booking bar,
   * covers it, and no ancestor clips it).
   */
  async function expectInside(page: Page, dialog: Locator, what: string) {
    // Centre it: the popover must be usable after a normal scroll, not only when it touches the bottom edge.
    await dialog.evaluate((el) => el.scrollIntoView({ block: "center" }));
    const vw = page.viewportSize()!.width;
    const box = (await dialog.boundingBox())!;
    expect(box.x, `${what} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `${what} right edge`).toBeLessThanOrEqual(vw);
    const h = await horizontalScroll(page);
    expect(h.scrollWidth, `${what} open: horizontal scroll`).toBeLessThanOrEqual(h.clientWidth);
    const covered = await dialog.evaluate((el) => {
      const bad: string[] = [];
      for (const b of el.querySelectorAll("button:not([disabled])")) {
        const r = b.getBoundingClientRect();
        if (r.width === 0) continue;
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (y < 0 || y > innerHeight) {
          bad.push(`${b.getAttribute("aria-label")} is off-screen at y=${Math.round(y)}`);
          continue;
        }
        const hit = document.elementFromPoint(x, y);
        if (!hit || !(hit === b || b.contains(hit))) bad.push(`${b.getAttribute("aria-label")} is covered by ${hit?.tagName} ${hit?.getAttribute("aria-label") ?? hit?.getAttribute("data-testid") ?? hit?.textContent?.slice(0, 20)}`);
      }
      return bad;
    });
    expect(covered, `${what}: controls covered, clipped or off-screen`).toEqual([]);
  }

  for (const vp of sizes) {
    test(`AC-2g: date popover at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openPinned(page);
      await calendarButton(page).click();
      await expect(calendarDialog(page)).toBeVisible();
      await expectInside(page, calendarDialog(page), "calendar");
      await calendarDialog(page).getByRole("button", { name: "Next month" }).click();
      await expectInside(page, calendarDialog(page), "calendar, next month");
    });

    test(`AC-2g: time popover at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openPinned(page);
      await timePickerButton(page).click();
      await expect(timeDialog(page)).toBeVisible();
      await hourButton(page, "10").click();
      await expectInside(page, timeDialog(page), "time picker");
    });

    test(`AC-2g: date popover in the error state at ${vp.width}x${vp.height}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await openPinned(page);
      await sendButton(page).click();
      await expect(banner(page)).toBeVisible();
      await calendarButton(page).click();
      await expect(calendarDialog(page)).toBeVisible();
      await expectInside(page, calendarDialog(page), "calendar (error state)");
    });
  }

  test("AC-2g: the picker buttons are at least 44 px high and wide", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPinned(page);
    for (const b of [calendarButton(page), timePickerButton(page)]) {
      const box = (await b.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await calendarButton(page).click();
    for (const name of ["Previous month", "Next month"]) {
      const box = (await calendarDialog(page).getByRole("button", { name }).boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });
});
