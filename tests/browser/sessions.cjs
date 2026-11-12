// Synthetic localhost fixtures only. Verifies the UI uses the server session.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.TEST_BASE_URL;
if (
  !base ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname) ||
  !process.env.TEST_SESSION_FIXTURES ||
  !process.env.TEST_DELETE_FIXTURES
)
  throw new Error(
    "Set localhost TEST_BASE_URL and TEST_SESSION_FIXTURES/TEST_DELETE_FIXTURES.",
  );
const out = process.env.TEST_SCREENSHOT_DIR || "work/session-ui";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const errors = [];
  try {
    const context = await browser.newContext({ baseURL: base });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page
      .locator("header")
      .getByRole("link", { name: "Đăng nhập", exact: true })
      .waitFor();
    await page.evaluate(() => {
      localStorage.setItem("room-danang-auth", "true");
      localStorage.setItem(
        "room-danang-user",
        JSON.stringify({ name: "Tài khoản giả", role: "admin" }),
      );
    });
    await page.reload();
    await page
      .locator("header")
      .getByRole("link", { name: "Đăng nhập", exact: true })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Tài khoản của/ }).count(),
      0,
    );
    checks++;
    async function cookies(ctx, cookie) {
      await ctx.addCookies(
        cookie.split("; ").map((v) => {
          const i = v.indexOf("=");
          return {
            name: v.slice(0, i),
            value: v.slice(i + 1),
            url: base,
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          };
        }),
      );
    }
    const fixture = JSON.parse(
      fs.readFileSync(process.env.TEST_SESSION_FIXTURES),
    );
    await cookies(context, fixture.cookie);
    const initial = await (await context.request.get("/api/auth/me")).json();
    assert(initial.data);
    await page.goto("/profile");
    await page
      .getByRole("heading", { name: initial.data.name, exact: true })
      .waitFor();
    const name = "Tên đồng bộ " + Date.now();
    await page
      .getByRole("button", { name: "Chỉnh sửa hồ sơ", exact: true })
      .click();
    await page.getByLabel("Tên hiển thị").fill(name);
    await page.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
    await page
      .locator("header")
      .getByRole("button", { name: "Tài khoản của " + name, exact: true })
      .waitFor();
    checks++;
    // Production rotates a Secure cookie on profile save. This fixture server uses loopback HTTP;
    // Playwright's APIRequest client needs the same local-only cookie adjustment as other UI suites.
    await context.addCookies((await context.cookies()).map(cookie => ({ ...cookie, secure: false })));
    await page.route("**/api/auth/me", (route) => route.abort());
    await page.evaluate(() =>
      window.dispatchEvent(new Event("account-session-changed")),
    );
    await page
      .locator("header")
      .getByRole("alert")
      .filter({ hasText: "Chưa kết nối" })
      .waitFor();
    assert.equal(
      await page
        .locator("header")
        .getByRole("button", { name: "Tài khoản của " + name, exact: true })
        .count(),
      1,
    );
    checks++;
    await page.unroute("**/api/auth/me");
    await page
      .locator("header")
      .getByRole("button", { name: "Thử lại", exact: true })
      .click();
    await page.waitForFunction(
      () => !document.querySelector('header [role="alert"]'),
    );
    const rooms = await (
      await context.request.get("/api/listings?limit=1")
    ).json();
    const room = rooms.data[0];
    assert(room);
    assert.equal(
      (
        await context.request.put("/api/favorites", {
          data: { id: room.externalId, saved: true },
        })
      ).status(),
      200,
    );
    await page.goto("/bang-tin");
    await page.getByLabel("Tìm kiếm", { exact: true }).fill(room.title);
    const card = page
      .locator(".room-card")
      .filter({ hasText: room.title })
      .first();
    await card
      .getByRole("button", { name: "Bỏ lưu: " + room.title, exact: true })
      .waitFor();
    await page.route("**/api/favorites", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Lỗi tạm thời" }),
      }),
    );
    const response = page.waitForResponse(
      (r) => r.url().endsWith("/api/favorites") && r.status() === 503,
    );
    await page.evaluate(() =>
      window.dispatchEvent(new Event("favorites-updated")),
    );
    await response;
    await card
      .getByRole("button", { name: "Bỏ lưu: " + room.title, exact: true })
      .waitFor();
    checks++;
    await page.unroute("**/api/favorites");
    await page.route("**/api/auth/logout", (route) => route.abort());
    await page
      .locator("header")
      .getByRole("button", { name: "Tài khoản của " + name, exact: true })
      .click();
    await page
      .locator("header")
      .getByRole("button", { name: "Đăng xuất", exact: true })
      .click();
    await page
      .locator("header")
      .getByRole("alert")
      .filter({ hasText: "Chưa thể đăng xuất" })
      .waitFor();
    assert.equal((await context.request.get("/api/auth/me")).status(), 200);
    checks++;
    await page.screenshot({
      path: out + "/connection-error.png",
      fullPage: true,
    });
    await page.unroute("**/api/auth/logout");
    await page
      .locator("header")
      .getByRole("button", { name: "Đăng xuất", exact: true })
      .click();
    await page
      .locator("header")
      .getByRole("link", { name: "Đăng nhập", exact: true })
      .waitFor();
    assert.equal((await context.request.get("/api/auth/me")).status(), 401);
    checks++;
    const deleted = JSON.parse(
      fs.readFileSync(process.env.TEST_DELETE_FIXTURES),
    );
    const owner = await browser.newContext({ baseURL: base });
    await cookies(owner, deleted.owner);
    const calendar = await owner.newPage();
    calendar.on("pageerror", (e) => errors.push(e.message));
    await calendar.goto("/lich-xem-phong");
    const visit = calendar
      .locator(".visit-card")
      .filter({ hasText: "Phòng đã bị xóa." })
      .first();
    await visit.waitFor();
    assert(
      await visit
        .getByRole("button", { name: "Xác nhận lịch", exact: true })
        .isDisabled(),
    );
    assert(
      await visit
        .getByRole("button", { name: "Hủy lịch", exact: true })
        .isEnabled(),
    );
    checks += 2;
    for (const width of [1440, 390]) {
      await calendar.setViewportSize({ width, height: 900 });
      await calendar.screenshot({
        path: out + "/deleted-calendar-" + width + ".png",
        fullPage: true,
      });
      const d = await calendar.evaluate(() => ({
        w: innerWidth,
        s: document.documentElement.scrollWidth,
      }));
      assert(d.s <= d.w + 1);
      checks++;
    }
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      `PASS: ${checks} UI checks: forged localStorage, profile/header synchronization, outage recovery, saved state, failed/successful logout and deleted-room calendar on desktop/mobile.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
