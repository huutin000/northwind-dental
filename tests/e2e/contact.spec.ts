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
