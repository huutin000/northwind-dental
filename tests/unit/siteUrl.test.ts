import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "@/lib/siteUrl";

afterEach(() => vi.unstubAllEnvs());

describe("getSiteUrl", () => {
  it("falls back to localhost when the Vercel variable is missing", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    expect(getSiteUrl().href).toBe("http://localhost:3000/");
  });

  it("adds https:// to the host name that Vercel provides (it carries no scheme)", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "northwind-dental.example.com");
    expect(getSiteUrl().href).toBe("https://northwind-dental.example.com/");
  });

  it("ignores surrounding whitespace", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "  my-site.vercel.app \n");
    expect(getSiteUrl().origin).toBe("https://my-site.vercel.app");
  });

  it.each([
    "https://already-has-scheme.example.com",
    "host/with/path",
    "user@host.example.com",
    "host.example.com?x=1",
    "host with spaces",
    "-",
  ])("falls back to localhost for a value that is not a plain host name: %s", (value) => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", value);
    expect(getSiteUrl().href).toBe("http://localhost:3000/");
  });
});
