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

  it("LeadForm never logs (no console.* call: it holds contact details)", () => {
    const src = readFileSync(join(root, "components", "LeadForm.tsx"), "utf8");
    expect(src).not.toMatch(/console\s*\./);
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
