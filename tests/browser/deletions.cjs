// Synthetic fixtures only. Confirms deletion through the actual Admin UI.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const base = process.env.TEST_BASE_URL,
  file = process.env.TEST_DELETE_FIXTURES;
if (
  !base ||
  !file ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Set localhost TEST_BASE_URL and TEST_DELETE_FIXTURES.");
const out = process.env.TEST_SCREENSHOT_DIR || "work/deletion-ui";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const f = JSON.parse(fs.readFileSync(file));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    async function context(cookie) {
      const c = await browser.newContext({ baseURL: base });
      for (const v of cookie.split("; ")) {
        const i = v.indexOf("=");
        await c.addCookies([
          {
            name: v.slice(0, i),
            value: v.slice(i + 1),
            url: base,
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ]);
      }
      return c;
    }
    const admin = await context(f.admin),
      page = await admin.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let checks = 0;
    for (const [i, width] of [1440, 390].entries()) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/admin?tab=listings");
      await page
        .getByLabel("Lọc trạng thái bài đăng", { exact: true })
        .selectOption("needs_review");
      assert.equal(
        await page.getByRole("button", { name: /^Xóa tin:/ }).count(),
        0,
      );
      checks++;
      await page
        .getByLabel("Lọc trạng thái bài đăng", { exact: true })
        .selectOption("rejected");
      const target = f.targets[i];
      const row = page
        .locator(".source-row")
        .filter({ has: page.getByText(target.title, { exact: true }) });
      await row
        .getByRole("button", { name: "Xóa tin: " + target.title, exact: true })
        .click();
      await page.getByRole("dialog").waitFor();
      await page
        .getByRole("dialog")
        .getByLabel("Lý do xóa (10–500 ký tự)", { exact: true })
        .fill("ngắn");
      assert.equal(
        await page
          .getByRole("button", { name: "Xác nhận xóa tin", exact: true })
          .isDisabled(),
        true,
      );
      checks++;
      if (i === 0) await page.keyboard.press("Escape");
      else
        await page
          .getByRole("button", { name: "Giữ lại", exact: true })
          .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      assert.equal(await row.count(), 1);
      checks++;
      await row
        .getByRole("button", { name: "Xóa tin: " + target.title, exact: true })
        .click();
      await page
        .getByRole("dialog")
        .getByLabel("Lý do xóa (10–500 ký tự)", { exact: true })
        .fill("Tin kiểm thử bị từ chối và Admin xác nhận xóa.");
      if (i === 0) {
        await page.route(
          "**/api/admin/listings/" + target.id,
          async (route) => {
            await new Promise((r) => setTimeout(r, 500));
            await route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                error: "Chưa thể xóa tin. Vui lòng thử lại.",
              }),
            });
          },
        );
        await page
          .getByRole("button", { name: "Xác nhận xóa tin", exact: true })
          .click();
        await page
          .getByRole("button", { name: "Đang xóa...", exact: true })
          .waitFor();
        await page.keyboard.press("Escape");
        assert.equal(await page.getByRole("dialog").isVisible(), true);
        checks++;
        await page
          .getByRole("alert")
          .getByText("Chưa thể xóa tin. Vui lòng thử lại.", { exact: true })
          .waitFor();
        checks++;
        assert(
          (
            await page
              .getByRole("dialog")
              .getByLabel("Lý do xóa (10–500 ký tự)", { exact: true })
              .inputValue()
          ).length > 10,
        );
        checks++;
        await page.unroute("**/api/admin/listings/" + target.id);
      }
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
        `${out}/axe-confirm-${width}.json`,
        JSON.stringify(scan.violations, null, 2),
      );
      assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations));
      checks++;
      await page.screenshot({
        path: `${out}/confirm-${width}.png`,
        fullPage: true,
      });
      await page
        .getByRole("button", { name: "Xác nhận xóa tin", exact: true })
        .click();
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await row.waitFor({ state: "detached" });
      checks++;
      await page
        .getByText(
          "Đã xóa tin bị từ chối. Ảnh, bình luận và mục đã lưu liên quan đã được dọn.",
          { exact: true },
        )
        .waitFor();
      checks++;
      await page.waitForFunction(
        () => document.activeElement?.id === "admin-action-message",
      );
      checks++;
      assert.equal(
        (
          await page.request.get(
            "/api/admin/listings/" + target.id + "/preview",
          )
        ).status(),
        404,
      );
      checks++;
    }
    const buyer = await context(f.buyer),
      inbox = await buyer.newPage();
    inbox.on("pageerror", (e) => errors.push(e.message));
    await inbox.goto("/tin-nhan?hoi-thoai=" + f.chatId);
    await inbox
      .getByText(
        "Tin phòng đã bị xóa. Lịch sử trao đổi được giữ để đối chiếu; không thể đặt lịch mới cho tin này.",
        { exact: true },
      )
      .waitFor();
    checks++;
    await inbox
      .getByLabel("Lịch sử tin nhắn", { exact: true })
      .getByText("Tin nhắn riêng kiểm thử phải được giữ lại.", { exact: true })
      .waitFor();
    checks++;
    assert.equal(await inbox.locator(".visit-request").count(), 0);
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      `PASS: ${checks} deletion UI checks, desktop/mobile confirmation, cancel/Escape, reason and error retention, no accidental pending deletion, successful removal, focus restoration and preserved inbox; 2 Axe scans with zero violations.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
