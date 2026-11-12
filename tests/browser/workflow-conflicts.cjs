// Synthetic local QA only. HTTP 409/503 are injected solely for the batch UI check.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.TEST_BASE_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Require isolated localhost QA.");
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const errors = [];
  const scans = [];
  try {
    const owner = await b.newContext({ baseURL: base }),
      admin = await b.newContext({ baseURL: base });
    const stamp = Date.now();
    const prefix = "[Kiểm thử] Luồng duyệt " + stamp;
    const reg = await owner.request.post("/api/auth/register", {
      data: {
        name: prefix,
        email: "workflow-ui-" + stamp + "@test.local",
        password: "WorkflowUITest123!",
        role: "landlord",
      },
    });
    assert.equal(reg.status(), 201);
    const user = (await reg.json()).data;
    const login = await admin.request.post("/api/auth/login", {
      data: {
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD,
      },
    });
    assert(login.ok());
    for (const c of [owner, admin])
      await c.addCookies(
        (await c.cookies()).map((v) => ({ ...v, secure: false })),
      );
    assert(
      (
        await admin.request.patch("/api/admin/landlords", {
          data: { id: user.id, status: "verified" },
        })
      ).ok(),
    );
    const draft = {
      title: prefix,
      summary:
        "Dữ liệu tổng hợp kiểm tra duyệt phòng, không phải phòng cho thuê thật.",
      address: "Hải Châu, Đà Nẵng",
      price: 2500000,
      area: 25,
    };
    const created = await owner.request.post("/api/listings/create", {
      data: draft,
    });
    assert.equal(created.status(), 201);
    const id = (await created.json()).data.externalId;
    const path = "/api/landlord/listings/" + id;
    const action = async (action, extra = {}) => {
      const current = (await (await owner.request.get(path)).json()).data;
      const r = await owner.request.patch(path, {
        data: { ...draft, ...extra, action, revision: current.revision },
      });
      assert(r.ok(), await r.text());
    };
    assert(
      (
        await admin.request.post("/api/listings/" + id + "/status", {
          data: { status: "verified" },
        })
      ).ok(),
    );
    await action("hide");
    const p = await admin.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errors.push(e.message));
    async function open() {
      await p.goto("/admin?tab=listings");
      await p.getByLabel("Tìm bài đăng quản trị", { exact: true }).fill(prefix);
      await p.getByText(prefix, { exact: true }).first().waitFor();
    }
    await open();
    let select = p.getByLabel("Trạng thái duyệt: " + prefix, { exact: true });
    assert(await select.locator("option[value=verified]").isDisabled());
    assert(await select.locator("option[value=hidden]").isDisabled());
    checks += 2;
    await action("resubmit");
    await open();
    await action("edit", {
      summary:
        draft.summary + " Nội dung được thay đổi sau khi Admin tải màn hình.",
    });
    const rejected = p.waitForResponse(
      (r) => r.url().endsWith("/status") && r.status() === 409,
    );
    await select.selectOption("verified");
    await rejected;
    await p
      .getByText("Tin đã thay đổi sau khi tải. Hãy tải lại trước khi duyệt.", {
        exact: true,
      })
      .waitFor();
    checks++;
    assert.equal(
      (await (await owner.request.get(path)).json()).data.verificationStatus,
      "needs_review",
    );
    checks++;
    const second = await owner.request.post("/api/listings/create", {
      data: { ...draft, title: prefix + " thứ hai" },
    });
    assert.equal(second.status(), 201);
    await open();
    await p.waitForFunction(
      () => document.querySelectorAll(".listing-checkbox input").length === 2,
    );
    const choices = p.getByRole("checkbox", { name: /^Chọn tin:/ });
    for (let n = 0; n < 2; n++) await choices.nth(n).check();
    let count = 0;
    await p.route("**/api/listings/*/status", (route) =>
      route.fulfill({
        status: ++count === 1 ? 409 : 503,
        json: { error: "Lỗi giả lập để kiểm tra phân loại xung đột" },
      }),
    );
    await p.getByRole("button", { name: "Duyệt 2 bài", exact: true }).click();
    await p.getByText(/1 bài có xung đột đã bỏ chọn/).waitFor();
    await p.getByRole("button", { name: "Duyệt 1 bài", exact: true }).waitFor();
    assert.equal(await p.locator(".listing-checkbox input:checked").count(), 1);
    checks++;
    for (const width of [1440, 390]) {
      await p.setViewportSize({ width, height: 950 });
      const scan = await new AxeBuilder({ page: p })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations));
      assert(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      scans.push({ width, violations: [] });
      checks++;
    }
    assert.deepEqual(errors, []);
    checks++;
    const report = { checks, errors, scans };
    if (process.env.TEST_WORKFLOW_REPORT)
      fs.writeFileSync(
        process.env.TEST_WORKFLOW_REPORT,
        JSON.stringify(report, null, 2),
      );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
