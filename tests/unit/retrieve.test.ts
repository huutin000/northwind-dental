import { describe, expect, it } from "vitest";
import { clinic } from "@/components/clinic";
import { FAQ, type FaqEntry } from "@/lib/faq/data";
import { OUT_OF_SCOPE_THRESHOLD, retrieve } from "@/lib/faq/retrieve";

const hoursSummary = clinic.hoursSummary;

const top = (q: string) => retrieve(q, 3)[0];
const topScore = (q: string) => top(q)?.score ?? 0;

describe("retrieve: plan assertions", () => {
  it("finds opening hours", () => {
    expect(retrieve("What time do you open?", 3)[0].entry.id).toBe("hours");
  });

  it("finds pricing", () => {
    expect(retrieve("how much does it cost", 3)[0].entry.id).toBe("pricing");
  });

  it("scores an unrelated question below the threshold", () => {
    expect(topScore("what is the capital of France")).toBeLessThan(
      OUT_OF_SCOPE_THRESHOLD,
    );
  });

  it("returns [] for empty and whitespace-only input", () => {
    expect(retrieve("", 3)).toEqual([]);
    expect(retrieve("   ", 3)).toEqual([]);
  });

  it("does not throw on Vietnamese text or emoji and stays below the threshold", () => {
    const vi = "Phòng khám mở cửa lúc mấy giờ?";
    expect(() => retrieve(vi, 3)).not.toThrow();
    expect(topScore(vi)).toBeLessThan(OUT_OF_SCOPE_THRESHOLD);
    const emoji = "😀🦷🦷👍";
    expect(() => retrieve(emoji, 3)).not.toThrow();
    expect(topScore(emoji)).toBeLessThan(OUT_OF_SCOPE_THRESHOLD);
  });

  it("never returns more than k results", () => {
    expect(retrieve("book an appointment", 2).length).toBeLessThanOrEqual(2);
  });
});

describe("retrieve: edge cases", () => {
  it("returns [] when only stopwords remain", () => {
    expect(retrieve("what is the", 3)).toEqual([]);
  });

  it("returns [] for k = 0", () => {
    expect(retrieve("opening hours", 0)).toEqual([]);
  });

  it("caps the result at the number of matching entries when k is large", () => {
    const r = retrieve("opening hours", 1000);
    expect(r.length).toBeGreaterThan(0);
    expect(r.length).toBeLessThanOrEqual(FAQ.length);
  });

  it("sorts by score descending", () => {
    const scores = retrieve("book an appointment time", 10).map((m) => m.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it("weights keyword matches above question-text matches", () => {
    const entries: FaqEntry[] = [
      {
        id: "in-question",
        group: "Services",
        question: "Do you sell widgets?",
        answer: "a",
        keywords: ["x", "y", "z"],
      },
      {
        id: "in-keywords",
        group: "Services",
        question: "Something else",
        answer: "b",
        keywords: ["widgets", "y", "z"],
      },
    ];
    const r = retrieve("widgets", 2, entries);
    expect(r.map((m) => m.entry.id)).toEqual(["in-keywords", "in-question"]);
    expect(r[0].score).toBe(1);
    expect(r[1].score).toBeLessThan(1);
  });

  it("breaks ties by the original entry order", () => {
    const mk = (id: string): FaqEntry => ({
      id,
      group: "Services",
      question: "Same question",
      answer: "a",
      keywords: ["alpha", "beta", "gamma"],
    });
    const r = retrieve("alpha", 3, [mk("first"), mk("second"), mk("third")]);
    expect(r.map((m) => m.entry.id)).toEqual(["first", "second", "third"]);
  });

  it("uses a custom entries list and ignores the built-in FAQ", () => {
    const only: FaqEntry = {
      id: "only",
      group: "Services",
      question: "Do you sell widgets?",
      answer: "a",
      keywords: ["widget", "gadget", "gizmo"],
    };
    expect(retrieve("gadget", 3, [only]).map((m) => m.entry.id)).toEqual([
      "only",
    ]);
    expect(retrieve("gadget", 3, [])).toEqual([]);
  });

  it("is case-insensitive, ignores punctuation and matches simple plurals", () => {
    expect(retrieve("PRICES!!!", 1)[0].entry.id).toBe("pricing");
  });

  it("is deterministic", () => {
    expect(retrieve("book a visit", 5)).toEqual(retrieve("book a visit", 5));
  });
});

// Each row: question, expected top entry id. Top score must reach the threshold.
const inScope: [string, string][] = [
  ["What time do you open?", "hours"],
  ["are you open on weekends", "hours"],
  ["how do I book an appointment", "booking"],
  ["can I reserve a slot", "booking"],
  ["how do I cancel my appointment", "reschedule"],
  ["what is your address", "location"],
  ["phone number to call you", "contact"],
  ["which treatments do you provide", "services"],
  ["do you treat kids", "children"],
  ["I need a teeth cleaning", "cleaning"],
  ["can you whiten my teeth", "whitening"],
  ["do you do root canals", "root-canal"],
  ["do you offer crowns", "crowns"],
  ["how much does it cost", "pricing"],
  ["what are your prices", "pricing"],
  ["do you take insurance", "insurance"],
  ["how can I pay", "payment"],
  ["what happens on my first visit", "first-visit"],
  ["what should I bring with me", "bring"],
  ["I am scared of the dentist", "nervous"],
  ["what to do after a filling", "aftercare"],
  ["I have a toothache", "emergency"],
];

// Long, polite, natural questions: greetings, weekdays, dates and filler must
// not dilute the score of the real topic words.
const inScopeLong: [string, string][] = [
  ["Are you open on Saturday morning?", "hours"],
  ["Hello, are you open on Saturday morning?", "hours"],
  ["Hello, can I book an appointment for next Tuesday afternoon?", "booking"],
  ["Hi, I would like to reschedule my appointment to next Monday", "reschedule"],
  ["Could you tell me how much a check-up costs?", "pricing"],
  ["Hello, do you accept dental insurance for my visit on Friday?", "insurance"],
  ["Hi there, I was wondering if you offer teeth whitening", "whitening"],
  ["I would like to know what happens at my first visit next week", "first-visit"],
  ["Hi, just a quick question: what should I do after a filling tomorrow?", "aftercare"],
  ["Hello, I need some help with aftercare instructions", "aftercare"],
  // Plurals of day names and contractions (straight and curly apostrophes).
  ["Are you open on Saturdays and Sundays?", "hours"],
  ["Hi, I'm wondering if you're open", "hours"],
  ["Hi, I’m wondering if you’re open", "hours"],
  ["Hi there, I'd like to know whether you're open this Saturday", "hours"],
  ["Can you tell me if you're open on Sundays?", "hours"],
  ["what's the cost?", "pricing"],
  ["I’d like to book an appointment on Mondays", "booking"],
  ["Hello, what’s your address?", "location"],
];

// Each row: a question the FAQ cannot answer. Top score must stay below the threshold.
const outOfScope: [string, string][] = [
  ["capital of France", "plain unrelated"],
  ["Phòng khám mở cửa lúc mấy giờ 😊", "Vietnamese with diacritics and emoji"],
  ["😀🦷🦷👍", "emoji only"],
  ["asdfghjkl qwertyuiop", "gibberish"],
  ["tell me a joke", "chat"],
  ["who won the football match yesterday", "unrelated news"],
  ["book a flight to Paris", "hard negative: shares 'book'"],
  ["what is the opening price of the stock market", "hard negative: shares 'opening'"],
  ["how do I cook rice", "unrelated"],
  ["Hello, can I book a flight to Paris next Tuesday?", "hard negative with greeting and weekday"],
];

// KNOWN LIMITATION: a keyword approach cannot tell these from real questions.
// One matching word out of two is the same ratio as "what are your prices".
// They are pinned here so a change in behaviour is noticed; the chat layer must
// not rely on the threshold alone to block off-topic questions.
const knownLimitations: string[] = [
  "what is the price of bitcoin",
  // Was an out-of-scope hard negative until "today" became a stopword: with
  // "today" removed it is the same one-in-two shape as the line above.
  "what is the price of bitcoin today",
  "what time is it in Tokyo",
];

describe("retrieve: in-scope fixture", () => {
  it.each(inScope)("%s -> %s", (q, id) => {
    const t = top(q);
    expect(t?.entry.id).toBe(id);
    expect(t?.score ?? 0).toBeGreaterThanOrEqual(OUT_OF_SCOPE_THRESHOLD);
  });
});

describe("retrieve: long polite in-scope fixture", () => {
  it.each(inScopeLong)("%s -> %s", (q, id) => {
    const t = top(q);
    expect(t?.entry.id).toBe(id);
    expect(t?.score ?? 0).toBeGreaterThanOrEqual(OUT_OF_SCOPE_THRESHOLD);
  });
});

describe("retrieve: stopwords never remove an FAQ keyword", () => {
  it("every keyword of every entry still matches its own entry with score 1", () => {
    for (const entry of FAQ) {
      for (const kw of entry.keywords) {
        const r = retrieve(kw, 1, [entry]);
        expect(r[0]?.score, `${entry.id}: ${kw}`).toBe(1);
      }
    }
  });
});

describe("retrieve: redaction placeholders", () => {
  it("ignores [phone] and [email] when ranking", () => {
    const plain = top("can I book an appointment");
    // "number" is a real contact keyword, so this one only checks the top id.
    expect(top("Hi, my number is [phone], can I book an appointment?")?.entry.id).toBe(
      "booking",
    );
    // Without a contact keyword, the placeholder must not change the score at all.
    expect(top("Hi, it is [phone], can I book an appointment?")?.score).toBe(plain?.score);
    expect(top("[email] can I book an appointment")?.score).toBe(plain?.score);
  });

  it("returns [] when only placeholders are left", () => {
    expect(retrieve("[phone] [email]", 3)).toEqual([]);
  });

  it("still matches a plain question about the phone number", () => {
    expect(top("what is your phone number")?.entry.id).toBe("contact");
  });
});

describe("retrieve: out-of-scope fixture", () => {
  it.each(outOfScope)("%s (%s)", (q) => {
    expect(topScore(q)).toBeLessThan(OUT_OF_SCOPE_THRESHOLD);
  });
});

describe("retrieve: known limitations (pinned current behaviour)", () => {
  it.each(knownLimitations)("%s still reaches the threshold", (q) => {
    expect(topScore(q)).toBeGreaterThanOrEqual(OUT_OF_SCOPE_THRESHOLD);
  });
});

describe("retrieve: scores", () => {
  it("are always within [0, 1]", () => {
    const all = [
      ...inScope.map(([q]) => q),
      ...outOfScope.map(([q]) => q),
      ...knownLimitations,
      "opening hours opening hours opening hours",
    ];
    for (const q of all) {
      for (const m of retrieve(q, 100)) {
        expect(m.score).toBeGreaterThanOrEqual(0);
        expect(m.score).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("FAQ data integrity", () => {
  it("has unique ids", () => {
    const ids = FAQ.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("contains the required ids", () => {
    const ids = FAQ.map((e) => e.id);
    for (const id of [
      "hours",
      "booking",
      "pricing",
      "insurance",
      "cleaning",
      "whitening",
      "emergency",
      "first-visit",
      "aftercare",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("has about 20 entries", () => {
    expect(FAQ.length).toBeGreaterThanOrEqual(18);
    expect(FAQ.length).toBeLessThanOrEqual(24);
  });

  it("gives every entry 3 to 6 keywords and a non-empty question and answer", () => {
    for (const e of FAQ) {
      expect(e.keywords.length).toBeGreaterThanOrEqual(3);
      expect(e.keywords.length).toBeLessThanOrEqual(6);
      expect(e.question.trim()).not.toBe("");
      expect(e.answer.trim()).not.toBe("");
    }
  });

  it("builds the hours answer from hoursSummary", () => {
    const hours = FAQ.find((e) => e.id === "hours");
    expect(hours?.answer).toBe(`Our fictional clinic is open ${hoursSummary}`);
  });

  it("keeps the reworded children and filling answers", () => {
    expect(FAQ.find((e) => e.id === "children")?.answer).toBe(
      "Yes, our fictional clinic offers children's dentistry.",
    );
    expect(FAQ.find((e) => e.id === "aftercare")?.answer).toBe(
      "Your dentist will explain what to do after a filling for your own situation. Contact your dentist if something does not feel right.",
    );
  });

  it("keeps the after-treatment answer free of symptom lists", () => {
    const answer = FAQ.find((e) => e.id === "after-treatment")?.answer ?? "";
    expect(answer).not.toMatch(/\b(pain|swelling|worse|bleeding|fever)\b/i);
    expect(answer).toContain("your own situation");
  });

  it("avoids claim words banned by the copy rules", () => {
    const banned = /\b(safe|safely|painless|guaranteed?|best|cure[sd]?|permanent)\b/i;
    for (const e of FAQ) {
      expect(`${e.question} ${e.answer}`).not.toMatch(banned);
    }
  });

  it("contains no digits other than those from hoursSummary", () => {
    for (const e of FAQ.filter((x) => x.id !== "hours")) {
      expect(`${e.question} ${e.answer}`).not.toMatch(/\d/);
    }
  });
});
