import { expect, test } from "@playwright/test";

// The icon set: app/icon.svg, app/icon.png (512x512), app/apple-icon.png (180x180) and the theme color.
// Next.js turns the files into <link> tags with a content hash in the URL; the test reads the tags from
// the served HTML and then fetches each URL, so a renamed file or a wrong size fails here.
// There is deliberately no favicon.ico. #0369a1 is --color-brand in the @theme block of app/globals.css.

const BRAND = "#0369a1";

/** Width and height from the PNG header (IHDR chunk), after the 8-byte signature. */
function pngSize(body: Buffer): { width: number; height: number } {
  expect(body.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  return { width: body.readUInt32BE(16), height: body.readUInt32BE(20) };
}

test("icon links point to real icons with the right type and size, and the theme color is the brand color", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();

  const link = (rel: string, type: string) => {
    const tag = (html.match(/<link\b[^>]*>/g) ?? []).find(
      (t) => new RegExp(`rel="${rel}"`).test(t) && new RegExp(`type="${type}"`).test(t),
    );
    expect(tag, `<link rel="${rel}" type="${type}">`).toBeDefined();
    const href = /href="([^"]+)"/.exec(tag!)?.[1];
    expect(href).toBeDefined();
    return { tag: tag!, href: href! };
  };

  const svg = link("icon", "image/svg\\+xml");
  const png = link("icon", "image/png");
  const apple = link("apple-touch-icon", "image/png");
  expect(svg.href).toMatch(/^\/icon\.svg\?/);
  expect(png.href).toMatch(/^\/icon\.png\?/);
  expect(apple.href).toMatch(/^\/apple-icon\.png\?/);
  expect(png.tag).toContain('sizes="512x512"');
  expect(apple.tag).toContain('sizes="180x180"');
  expect(html).not.toContain("favicon.ico");

  const svgRes = await request.get(svg.href);
  expect(svgRes.status()).toBe(200);
  expect(svgRes.headers()["content-type"]).toContain("image/svg+xml");

  const pngRes = await request.get(png.href);
  expect(pngRes.status()).toBe(200);
  expect(pngRes.headers()["content-type"]).toContain("image/png");
  expect(pngSize(await pngRes.body())).toEqual({ width: 512, height: 512 });

  const appleRes = await request.get(apple.href);
  expect(appleRes.status()).toBe(200);
  expect(appleRes.headers()["content-type"]).toContain("image/png");
  expect(pngSize(await appleRes.body())).toEqual({ width: 180, height: 180 });

  expect(html).toContain(`<meta name="theme-color" content="${BRAND}"`);
});
