// Synthetic localhost fixtures only; tests failure states without changing live data.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const base = process.env.TEST_BASE_URL,
  fixture = process.env.TEST_ERROR_FIXTURES;
if (!base || !fixture)
  throw new Error("Set TEST_BASE_URL and TEST_ERROR_FIXTURES.");
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local synthetic fixture server only.");
const out = process.env.TEST_SCREENSHOT_DIR || "work/v13-ui";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const data = JSON.parse(fs.readFileSync(fixture));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({ baseURL: base });
    for (const value of data.admin.split("; ")) {
      const i = value.indexOf("=");
      await context.addCookies([
        {
          name: value.slice(0, i),
          value: value.slice(i + 1),
          url: base,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let checks = 0;
    await page.route("**/api/admin/stats", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Database thử nghiệm đang không kết nối.",
        }),
      }),
    );
    await page.route("**/api/collector/status", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Không tải được lịch sử." }),
      }),
    );
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/admin");
      await page
        .getByText(
          "Chưa tải được thống kê. Vui lòng kiểm tra kết nối database và thử lại.",
          { exact: false },
        )
        .waitFor();
      checks++;
      assert.equal(
        await page.getByText("Tin đã duyệt", { exact: true }).count(),
        0,
      );
      checks++;
      await page
        .getByRole("button", { name: "Thử tải lại thống kê", exact: true })
        .waitFor();
      checks++;
      await page
        .getByRole("button", {
          name: "Thử tải lại trạng thái thu thập",
          exact: true,
        })
        .waitFor();
      checks++;
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      checks++;
      const scan = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      fs.writeFileSync(
        `${out}/axe-admin-${width}.json`,
        JSON.stringify(scan.violations, null, 2),
      );
      assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations));
      checks++;
      await page.screenshot({
        path: `${out}/admin-error-${width}.png`,
        fullPage: true,
      });
    }
    await page.unroute("**/api/admin/stats");
    await page
      .getByRole("button", { name: "Thử tải lại thống kê", exact: true })
      .click();
    await page.getByText("Tin đã duyệt", { exact: true }).waitFor();
    checks++;
    await page.route("**/api/community/posts?*", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Chưa thể tải thảo luận. Vui lòng thử lại.",
        }),
      }),
    );
    await page.goto("/thao-luan");
    await page
      .getByText("Chưa thể tải thảo luận. Vui lòng thử lại.", { exact: true })
      .waitFor();
    checks++;
    await page.unroute("**/api/community/posts?*");
    await page.reload();
    await page.getByLabel("Khu vực", { exact: true }).waitFor();
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      `PASS: ${checks} UI regressions; explicit database failure messages, no fake zero statistics, retry recovers, discussion failure visible, desktop/mobile, 2 Axe scans with zero violations.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
