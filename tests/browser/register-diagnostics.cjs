const { randomBytes } = require("node:crypto");
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const base = process.env.TEST_BASE_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Set TEST_ISOLATED_DB=1 and a local TEST_BASE_URL.");

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const suffix = Date.now();
    const email = `register-ui-${suffix}@test.local`;
    const password = "Qa!" + randomBytes(24).toString("hex");
    const created = await context.request.post(`${base}/api/auth/register`, {
      data: { name: "Form QA", email, password, role: "student" },
    });
    assert.equal(created.status(), 201);

    await page.goto(`${base}/dang-ky`);
    const passwordInput = page.locator(".modal-form input[type='password']");
    await page.getByLabel("Họ và tên").fill("Form QA");
    await page.getByLabel("Email").fill(email);
    await passwordInput.fill(password);
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await page.getByText("Email này đã được đăng ký.", { exact: false }).waitFor();
    assert.equal(await page.getByLabel("Họ và tên").inputValue(), "Form QA");
    assert.equal(await page.getByLabel("Email").inputValue(), email);
    assert.equal(await passwordInput.inputValue(), "");
    await page.locator(".modal-error small").getByText(/Mã hỗ trợ:/).waitFor();

    let attempts = 0;
    await page.route("**/api/auth/register", async (route) => {
      attempts += 1;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "DATABASE_UNAVAILABLE", requestId: "qa-temporary-request" }),
      });
    });
    await page.getByLabel("Email").fill(`temporary-${suffix}@test.local`);
    await passwordInput.fill(password);
    const submit = page.getByRole("button", { name: "Tạo tài khoản" });
    const pending = submit.click();
    await page.getByRole("button", { name: "Đang xử lý..." }).waitFor();
    assert.equal(await page.getByRole("button", { name: "Đang xử lý..." }).isDisabled(), true);
    await pending;
    await page.getByRole("button", { name: "Thử lại" }).waitFor();
    assert.equal(await passwordInput.inputValue(), "");
    await passwordInput.fill(password);
    await page.getByRole("button", { name: "Thử lại" }).click();
    await page.getByRole("button", { name: "Thử lại" }).waitFor();
    assert.equal(attempts, 2);
    await page.unroute("**/api/auth/register");

    await page.route("**/api/auth/register", (route) => route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ code: "ACCOUNT_CREATED_LOGIN_REQUIRED", requestId: "qa-session-request" }),
    }));
    await page.getByLabel("Email").fill(`session-failure-${suffix}@test.local`);
    await passwordInput.fill(password);
    await page.getByRole("button", { name: "Tạo tài khoản" }).click();
    await page.getByText("Tài khoản đã được tạo. Đăng nhập bằng email này", { exact: false }).waitFor();
    await page.locator(".modal-form").getByRole("button", { name: "Đăng nhập", exact: true }).waitFor();
    await page.getByText("Mật khẩu đã được xóa. Hãy nhập lại mật khẩu để đăng nhập.").waitFor();
    assert.equal(await passwordInput.inputValue(), "");
    assert.equal(await page.locator(".modal-error small").innerText(), " Mã hỗ trợ: qa-session-request");
    console.log("PASS: registration form errors, retained fields, cleared password, request id, retry and session recovery.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
