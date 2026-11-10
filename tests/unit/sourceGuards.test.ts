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
