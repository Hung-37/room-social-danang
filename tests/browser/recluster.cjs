// Isolated localhost test server only. Uses synthetic cookies for local HTTP.
const { createRequire } = require("node:module");
const req = createRequire(
  require("node:path").join(__dirname, "../../package.json"),
);
const { chromium } = req("playwright");
const { default: AxeBuilder } = req("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const base = process.env.TEST_BASE_URL;
  if (
    !base ||
    !process.env.TEST_ADMIN_EMAIL ||
    !process.env.TEST_ADMIN_PASSWORD
  )
    throw new Error(
      "Set TEST_BASE_URL, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for an isolated database.",
    );
  if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
    throw new Error("Local test server required by this cookie fixture.");
  const login = await fetch(base + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "recluster-ui-" + Date.now() },
    body: JSON.stringify({
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    }),
  });
  assert.equal(login.status, 200);
  const cookies = login.headers.getSetCookie().map((s) => {
    const part = s.split(";")[0];
    const i = part.indexOf("=");
    return {
      name: part.slice(0, i),
      value: part.slice(i + 1),
      url: base,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    };
  });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({ baseURL: base });
  await context.addCookies(cookies);
  const p = await context.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  let checks = 0;
  const out = process.env.TEST_SCREENSHOT_DIR || "work/recluster-ui";
  fs.mkdirSync(out, { recursive: true });
  for (const viewport of [
    { width: 1440, height: 1000 },
    { width: 390, height: 844 },
  ]) {
    await p.setViewportSize(viewport);
    await p.goto("/admin?tab=listings");
    await p.getByRole("heading", { name: "Quản lý bài đăng", exact: true }).waitFor();
    assert.equal(await p.getByRole("button", {
      name: "Phân cụm lại theo địa chỉ",
      exact: true,
    }).count(), 0);
    checks++;
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    checks++;
    await p.screenshot({
      path: `${out}/admin-${viewport.width}.png`,
      fullPage: true,
    });
    const scan = await new AxeBuilder({ page: p })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    fs.writeFileSync(
      `${out}/axe-${viewport.width}.json`,
      JSON.stringify(scan.violations, null, 2),
    );
    assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations));
    checks++;
  }
  assert.deepEqual(errors, []);
  checks++;
  console.log(
    `PASS: ${checks} browser checks, no manual recluster button, horizontal overflow or runtime errors; 2 Axe scans with zero violations.`,
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
