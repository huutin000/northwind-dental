import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("source guards", () => {
  it("no raw HTML injection anywhere in app/, components/ or lib/", () => {
    const needle = ["dangerously", "SetInnerHTML"].join("");
    const hits = ["app", "components", "lib"]
      .flatMap((d) => sourceFiles(join(root, d)))
      .filter((f) => readFileSync(f, "utf8").includes(needle));
    expect(hits).toEqual([]);
  });

  it("AC-4: components/chat/** and ChatWidget have no raw HTML injection (innerHTML, outerHTML, insertAdjacentHTML, document.write)", () => {
    const files = [...sourceFiles(join(root, "components", "chat")), join(root, "components", "ChatWidget.tsx")];
    expect(files.length).toBeGreaterThan(1);
    const bad = ["dangerously" + "SetInnerHTML", "innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const word of bad) expect(src.includes(word), `${f} uses ${word}`).toBe(false);
    }
  });

  it("AC-4: no NEXT_PUBLIC_ variable name contains KEY or GROQ anywhere in the source", () => {
    const files = [
      ...["app", "components", "lib"].flatMap((d) => sourceFiles(join(root, d))),
      join(root, "next.config.ts"),
    ];
    const hits: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const m of src.matchAll(/NEXT_PUBLIC_[A-Za-z0-9_]*/g)) {
        if (/KEY|GROQ/i.test(m[0])) hits.push(`${f}: ${m[0]}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("AppointmentForm is a pure front-end simulation: no network, no storage, no logging, no raw hex", () => {
    const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const src = strip(readFileSync(join(root, "components", "AppointmentForm.tsx"), "utf8"));
    expect(src.length).toBeGreaterThan(500);
    for (const re of [
      /\bfetch\s*\(/,
      /XMLHttpRequest/,
      /sendBeacon/,
      /WebSocket/,
      /EventSource/,
      /\/api\//,
      /localStorage/,
      /sessionStorage/,
      /document\.cookie/,
      /indexedDB/,
      /console\s*\./,
      /dangerously/i,
      /innerHTML/,
    ]) {
      expect(src, String(re)).not.toMatch(re);
    }
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // Structural check of the timer clean-up. It proves that the handle returned by setTimeout is stored in a ref and
    // that a useEffect cleanup function (arrow returning an arrow, or `return () =>`) calls clearTimeout on that same
    // ref. It does NOT prove the cleanup runs at runtime; the e2e test "the 1200 ms timer is cleared when the form
    // unmounts" (tests/e2e/contact.spec.ts) records the real setTimeout and clearTimeout ids for that.
    const stored = src.match(/(\w+)\.current\s*=\s*setTimeout\(/);
    expect(stored, "the setTimeout handle must be kept in a ref").not.toBeNull();
    const ref = stored![1];
    const cleanup = new RegExp(
      String.raw`useEffect\(\s*\(\)\s*=>\s*(?:\(\)\s*=>|\{[^}]*return\s*\(\)\s*=>)\s*\{[^}]*clearTimeout\(\s*` + ref + String.raw`\.current`,
    );
    expect(src, "clearTimeout(ref.current) must sit in a useEffect cleanup").toMatch(cleanup);
    // The component must not import chat code.
    expect(src).not.toMatch(/from\s+["'][^"']*chat/i);
  });

  it("the /contact page uses design tokens only (no raw hex) and no network call", () => {
    const src = readFileSync(join(root, "app", "(site)", "contact", "page.tsx"), "utf8");
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(src).not.toMatch(/\bfetch\s*\(|console\s*\./);
  });

  it("chat widget files never log and never touch browser storage", () => {
    for (const rel of [["components", "chat", "ChatPanel.tsx"], ["components", "ChatWidget.tsx"]]) {
      const src = readFileSync(join(root, ...rel), "utf8");
      expect(src, rel.join("/")).not.toMatch(/console\s*\./);
      for (const word of ["localStorage", "sessionStorage", "document.cookie"]) {
        expect(src.includes(word), `${rel.join("/")} uses ${word}`).toBe(false);
      }
    }
  });
});
