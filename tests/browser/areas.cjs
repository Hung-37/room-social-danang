// Read-only public pages. Requires a running server and a Playwright browser.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.TEST_BASE_URL;
if (!base) throw new Error("Set TEST_BASE_URL.");
const out = process.env.TEST_SCREENSHOT_DIR || "work/areas-ui";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({ baseURL: base });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let checks = 0;
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ["/cum", "/cum/cam-le", "/cum/hai-chau"]) {
        const response = await page.goto(path);
        assert.equal(response.status(), 200);
        checks++;
        await page.getByRole("heading", { level: 1 }).waitFor();
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
        checks++;
        const result = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze();
        const suffix = path.replaceAll("/", "-") + "-" + width;
        fs.writeFileSync(
          `${out}/axe${suffix}.json`,
          JSON.stringify(result.violations, null, 2),
        );
        assert.equal(
          result.violations.length,
          0,
          JSON.stringify(result.violations),
        );
        checks++;
        await page.screenshot({
          path: `${out}/page${suffix}.png`,
          fullPage: true,
        });
      }
      await page.goto("/cum");
      await page.locator('a[href="/cum/cam-le"]').first().click();
      await page.waitForURL("**/cum/cam-le");
      await page
        .getByRole("heading", { name: "Cẩm Lệ", exact: true })
        .waitFor();
      checks++;
      await page
        .getByRole("link", { name: "Tìm và lọc phòng tại đây →" })
        .click();
      await page.waitForURL("**/bang-tin?cluster=cam-le");
      assert.equal(
        await page.getByLabel("Khu vực", { exact: true }).inputValue(),
        "cam-le",
      );
      checks++;
    }
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      `PASS: ${checks} browser checks, /cum and area pages, working links and filters, desktop/mobile layouts, no runtime errors; 6 Axe scans with zero violations.`,
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
