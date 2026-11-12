// Creates test users and rooms; run against an isolated test database only.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { join } = require("node:path");
const screenshots = process.env.TEST_SCREENSHOT_DIR || "work/browser";
mkdirSync(screenshots, { recursive: true });
if (
  !process.env.TEST_BASE_URL ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error(
    "Set TEST_BASE_URL, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD; use an isolated test database.",
  );
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });
  const errors = [];
  const baseURL = process.env.TEST_BASE_URL;
  const admin = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const landlord = await browser.newContext({
    baseURL,
    viewport: { width: 390, height: 844 },
  });
  const suffix = Date.now();
  const title = "Phòng UI gần Bách khoa " + suffix;
  const reg = await landlord.request.post("/api/auth/register", {
    data: {
      name: "Chủ trọ UI " + suffix,
      email: `ui-${suffix}@test.local`,
      password: "StrongTest123!",
      role: "landlord",
    },
  });
  assert.equal(reg.status(), 201);
  await admin.request.post("/api/auth/login", {
    data: {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    },
  });
  const a = await admin.newPage(),
    l = await landlord.newPage();
  for (const page of [a, l])
    page.on("pageerror", (e) => errors.push(e.message));
  await l.goto("/dang-phong");
  await l
    .getByText("Tài khoản chủ trọ chưa được xác minh.", { exact: false })
    .waitFor();
  await a.goto("/admin/chu-tro");
  const card = a.locator("article").filter({ hasText: "Chủ trọ UI " + suffix });
  await card.getByRole("button", { name: "Xác minh", exact: true }).click();
  await a.getByText("Đã lưu kết quả xác minh.").waitFor();
  await a.screenshot({
    path: join(screenshots, "admin-landlords.png"),
    fullPage: true,
  });
  await l.goto("/dang-phong");
  await l.getByLabel("Tiêu đề").fill(title);
  await l
    .getByLabel("Mô tả")
    .fill("Phòng sạch thoáng mát, có cửa sổ, chỗ để xe và nhà vệ sinh riêng.");
  await l.getByLabel("Địa chỉ").fill("Liên Chiểu, Đà Nẵng");
  await l
    .getByLabel("Giá thuê / tháng (đồng)", { exact: true })
    .fill("2800000");
  await l.getByLabel("Diện tích (m²)", { exact: true }).fill("28");
  await l.getByLabel("Khu vực").selectOption("bach-khoa-su-pham");
  await l.getByRole("button", { name: "Gửi tin chờ duyệt" }).click();
  await l.waitForURL("**/quan-ly-phong?da-gui=1");
  await l.getByRole("status").filter({ hasText: "Đã lưu tin." }).waitFor();
  await l.goto("/quan-ly-phong");
  await l.getByRole("heading", { name: title }).waitFor();
  await l.getByText("Chờ duyệt", { exact: true }).waitFor();
  await l.screenshot({
    path: join(screenshots, "landlord-mobile.png"),
    fullPage: true,
  });
  await a.goto("/admin?tab=listings");
  const row = a.locator(".source-row").filter({ hasText: title });
  await row.locator("select").selectOption("verified");
  await row.locator(".status-badge").filter({ hasText: "Đã duyệt" }).waitFor();
  await a.screenshot({
    path: join(screenshots, "admin-listings.png"),
    fullPage: true,
  });
  const publicContext = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1000 },
  });
  const p = await publicContext.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto("/");
  await p.getByText(title, { exact: true }).first().waitFor();
  await p.goto("/bang-tin");
  await Promise.all([
    p.waitForResponse(
      (r) =>
        r.url().includes("/api/listings?") && r.url().includes(String(suffix)),
    ),
    p.getByLabel("Tìm kiếm", { exact: true }).fill(String(suffix)),
  ]);
  await p.screenshot({
    path: join(screenshots, "home-desktop.png"),
    fullPage: true,
  });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.goto("/");
  await p.getByText(title, { exact: true }).first().waitFor();
  await p.getByRole("button", { name: "Mở menu", exact: true }).click();
  await p.locator(".mobile-nav").waitFor();
  await p.screenshot({
    path: join(screenshots, "home-mobile.png"),
    fullPage: true,
  });
  for (const path of [
    "/",
    "/khu-vuc",
    "/dang-nhap",
    "/dang-ky",
    "/quan-ly-phong",
    "/dang-phong",
  ]) {
    await p.goto(path);
    await p.waitForLoadState("networkidle");
    const dimensions = await p.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert(
      dimensions.scroll <= dimensions.width + 1,
      `Overflow ${path}: ${JSON.stringify(dimensions)}`,
    );
  }
  await a.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/admin", "/admin?tab=listings", "/admin/chu-tro"]) {
    await a.goto(path);
    await a.waitForLoadState("networkidle");
    const d = await a.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    assert(
      d.scroll <= d.width + 1,
      `Admin overflow ${path}: ${JSON.stringify(d)}`,
    );
    await a.screenshot({
      path: join(
        screenshots,
        "admin-mobile-" + path.replace(/[^a-z]/g, "") + ".png",
      ),
      fullPage: true,
    });
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: browser flow, form reset, admin moderation, search, desktop/mobile screenshots, 9 viewport overflow checks, no uncaught browser errors.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
