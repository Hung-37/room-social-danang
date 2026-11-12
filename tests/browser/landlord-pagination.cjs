// Isolated QA fixtures from test:landlord-pagination only.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL,
  file = process.env.TEST_PAGINATION_FIXTURES,
  out = process.env.TEST_SCREENSHOT_DIR || "work/pagination";
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !file ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error("Isolated local pagination fixtures required.");
fs.mkdirSync(out, { recursive: true });
(async () => {
  const f = JSON.parse(fs.readFileSync(file)),
    b = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
  const report = { checks: 0, errors: [], scans: [] };
  function eq(a, v) {
    assert.deepEqual(a, v);
    report.checks++;
  }
  try {
    async function context(cookie) {
      const c = await b.newContext({ baseURL: base });
      c.setDefaultTimeout(10000);
      for (const part of cookie.split("; ")) {
        const i = part.indexOf("=");
        await c.addCookies([
          {
            name: part.slice(0, i),
            value: part.slice(i + 1),
            url: base,
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
          },
        ]);
      }
      return c;
    }
    for (const [role, cookie, url, label, search, card] of [
      [
        "admin",
        f.admin,
        "/admin/chu-tro",
        "chủ trọ",
        "Tìm chủ trọ",
        ".management-card",
      ],
      [
        "owner",
        f.owner,
        "/quan-ly-phong",
        "phòng của tôi",
        "Tìm phòng của tôi",
        ".management-room",
      ],
    ]) {
      const c = await context(cookie),
        p = await c.newPage();
      p.on("pageerror", (e) => report.errors.push(e.message));
      if (role === "owner")
        await p.setViewportSize({ width: 390, height: 950 });
      await p.goto(url);
      await p.getByLabel(search, { exact: true }).fill(f.prefix);
      const nav = p.getByRole("navigation", {
        name: `Phân trang ${label} đầu danh sách`,
        exact: true,
      });
      await nav.getByText(/\/ 201 kết quả/).waitFor();
      const titles = [];
      for (let page = 1; page <= 11; page++) {
        await nav.getByText(new RegExp("Trang " + page + "/11")).waitFor();
        const text = await p
          .locator(card + " h2," + card + " h3")
          .allTextContents();
        eq(text.length, page === 11 ? 1 : 20);
        titles.push(...text);
        if (page < 11)
          await nav
            .getByRole("button", { name: "Trang sau", exact: true })
            .click();
      }
      eq(titles.length, 201);
      eq(new Set(titles).size, 201);
      eq(
        await nav
          .getByRole("button", { name: "Trang sau", exact: true })
          .isDisabled(),
        true,
      );
      const term = role === "admin" ? f.ownerName : f.prefix + " phòng 200";
      await p.getByLabel(search, { exact: true }).fill(term);
      await nav.getByText(/\/ 1 kết quả/).waitFor();
      eq(await p.getByRole("heading", { name: term, exact: true }).count(), 1);
      report.checks++;
      // Check a slow earlier search cannot replace the latest query.
      let release;
      const gate = new Promise((r) => (release = r));
      const endpoint =
        role === "admin" ? "/api/admin/landlords" : "/api/landlord";
      const oldTerm =
        role === "admin" ? f.prefix + " mục 199" : f.prefix + " phòng 199";
      const oldData = await (
        await c.request.get(
          endpoint + "?q=" + encodeURIComponent(oldTerm) + "&limit=20",
        )
      ).json();
      let intercepted = false;
      await p.route("**" + endpoint + "?*", async (route) => {
        if (
          new URL(route.request().url()).searchParams.get("q") === oldTerm &&
          !intercepted
        ) {
          intercepted = true;
          await gate;
          try {
            await route.fulfill({ json: oldData });
          } catch {}
          return;
        }
        await route.continue();
      });
      const started = p.waitForRequest(
        (r) => new URL(r.url()).searchParams.get("q") === oldTerm,
      );
      await p.getByLabel(search, { exact: true }).fill(oldTerm);
      await started;
      await p.getByLabel(search, { exact: true }).fill(term);
      await p.getByRole("heading", { name: term, exact: true }).waitFor();
      release();
      await p.waitForTimeout(250);
      eq(
        await p.getByRole("heading", { name: oldTerm, exact: true }).count(),
        0,
      );
      await p.unroute("**" + endpoint + "?*");
      if (role === "admin") {
        await p.getByLabel(search, { exact: true }).fill(f.prefix + " subset");
        await p
          .getByLabel("Trạng thái xác minh", { exact: true })
          .selectOption("pending");
        await nav.getByText(/\/ 21 kết quả/).waitFor();
        await nav
          .getByRole("button", { name: "Trang sau", exact: true })
          .click();
        await nav.getByText(/Trang 2\/2/).waitFor();
        await p
          .locator(card)
          .getByRole("button", { name: "Xác minh", exact: true })
          .click();
        await p
          .getByText("Đã lưu kết quả xác minh.", { exact: true })
          .waitFor();
        await nav.getByText(/\/ 20 kết quả\. Trang 1\/1/).waitFor();
        eq(await p.locator(card).count(), 20);
      } else {
        await p.getByRole("button", { name: "Ẩn tin", exact: true }).click();
        await p.waitForFunction(
          () =>
            document.activeElement?.getAttribute("aria-label") ===
            "Xác nhận đổi trạng thái",
        );
        await p.waitForFunction(()=>{const r=document.querySelector('.management-confirm')?.getBoundingClientRect();return r&&r.top>=0&&r.bottom<=innerHeight;});
        eq(
          await p
            .getByRole("region", {
              name: "Xác nhận đổi trạng thái",
              exact: true,
            })
            .evaluate((e) => {
              const r = e.getBoundingClientRect();
              return r.top >= 0 && r.bottom <= innerHeight;
            }),
          true,
        );
        await p
          .getByRole("region", { name: "Xác nhận đổi trạng thái", exact: true })
          .getByRole("button", { name: "Hủy", exact: true })
          .click();
        eq(
          await p
            .getByRole("region", {
              name: "Xác nhận đổi trạng thái",
              exact: true,
            })
            .count(),
          0,
        );
        await p.waitForFunction(
          () => document.activeElement?.textContent?.trim() === "Ẩn tin",
        );
        eq(
          await p
            .getByRole("button", { name: "Ẩn tin", exact: true })
            .evaluate((e) => e === document.activeElement),
          true,
        );
        await p.getByRole("button", { name: "Ẩn tin", exact: true }).click();
        await p
          .getByRole("region", { name: "Xác nhận đổi trạng thái", exact: true })
          .getByRole("button", { name: "Xác nhận", exact: true })
          .click();
        await p
          .getByText("Đã ẩn tin khỏi danh sách công khai.", { exact: true })
          .waitFor();
        await p
          .locator(card + " .listing-status")
          .filter({ hasText: /^Đã ẩn$/ })
          .waitFor();
        report.checks++;
        await p
          .getByRole("button", { name: "Gửi duyệt lại", exact: true })
          .click();
        await p
          .getByRole("region", { name: "Xác nhận đổi trạng thái", exact: true })
          .getByRole("button", { name: "Xác nhận", exact: true })
          .click();
        await p
          .getByText("Đã gửi tin chờ Admin duyệt lại.", { exact: true })
          .waitFor();
        await p
          .locator(card + " .listing-status")
          .filter({ hasText: /^Chờ duyệt$/ })
          .waitFor();
        report.checks++;
        await p.getByRole("button", { name: "Bỏ bộ lọc", exact: true }).click();
        await p
          .getByRole("heading", { name: "Tin đã đăng (201)", exact: true })
          .waitFor();
        await p
          .getByLabel("Trạng thái phòng", { exact: true })
          .selectOption("hidden");
        await nav.getByText(/\/ 40 kết quả/).waitFor();
        eq(
          await p
            .locator(card + " .listing-status")
            .first()
            .innerText(),
          "Đã ẩn",
        );
        await p
          .getByLabel(search, { exact: true })
          .fill("không có phòng " + Date.now());
        await p
          .getByRole("heading", { name: "Không có phòng phù hợp", exact: true })
          .waitFor();
        eq(
          await p
            .getByRole("heading", {
              name: "Bắt đầu với phòng đầu tiên",
              exact: true,
            })
            .count(),
          0,
        );
      }
      if (role === "owner") {
        await p.getByRole("button", { name: "Bỏ bộ lọc", exact: true }).click();
        await p
          .getByRole("heading", { name: "Tin đã đăng (201)", exact: true })
          .waitFor();
      }
      for (const width of [1440, 390]) {
        await p.setViewportSize({ width, height: 950 });
        const scan = await new AxeBuilder({ page: p })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();
        eq(scan.violations.length, 0);
        eq(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          true,
        );
        report.scans.push({ role, width, violations: [] });
        await p.screenshot({
          path: path.join(out, role + "-" + width + ".png"),
          fullPage: false,
        });
      }
      if (role === "admin") {
        await p.route("**/api/auth/logout", (route) =>
          route.fulfill({ status: 503, json: { error: "Lỗi mạng kiểm thử" } }),
        );
        await p
          .getByRole("button", { name: "Đăng xuất Admin", exact: true })
          .click();
        await p
          .getByText("Chưa thể đăng xuất. Vui lòng thử lại.", { exact: true })
          .waitFor();
        eq((await c.request.get("/api/admin/landlords")).status(), 200);
        await p.unroute("**/api/auth/logout");
        await p
          .getByRole("button", { name: "Đăng xuất Admin", exact: true })
          .click();
        await p.waitForURL("**/dang-nhap");
        eq((await c.request.get("/api/admin/landlords")).status(), 401);
        await p.goto("/admin");
        await p.waitForURL("**/dang-nhap");
        report.checks++;
      }
      if (role === "owner") {
        await p.route("**/api/landlord?*", (r) => r.abort());
        await p.reload();
        await p
          .getByRole("button", { name: "Thử tải lại phòng", exact: true })
          .waitFor();
        eq(
          await p
            .getByRole("link", { name: "Đăng nhập chủ trọ", exact: true })
            .count(),
          0,
        );
        await p.unroute("**/api/landlord?*");
        await p
          .getByRole("button", { name: "Thử tải lại phòng", exact: true })
          .click();
        await p.getByLabel(search, { exact: true }).waitFor();
        await p
          .getByRole("heading", { name: "Tin đã đăng (201)", exact: true })
          .waitFor();
        report.checks++;
        let releaseTimeout;
        const timeoutGate = new Promise((r) => (releaseTimeout = r));
        const timeoutData = await (
          await c.request.get("/api/landlord?q=" + encodeURIComponent(f.prefix))
        ).json();
        await p.route("**/api/landlord?*", async (route) => {
          await timeoutGate;
          try {
            await route.fulfill({ json: timeoutData });
          } catch {}
        });
        const slow = p.waitForRequest(
          (r) => new URL(r.url()).pathname === "/api/landlord",
        );
        await p.getByLabel(search, { exact: true }).fill(f.prefix);
        await slow;
        eq(await p.getByLabel(search, { exact: true }).isEnabled(), true);
        await p
          .getByText("Kết nối quá lâu. Vui lòng thử tải lại.", { exact: true })
          .waitFor({ timeout: 15000 });
        releaseTimeout();
        await p.unroute("**/api/landlord?*");
        await p
          .getByRole("button", { name: "Thử tải lại phòng", exact: true })
          .click();
        await p.getByRole("button", { name: "Bỏ bộ lọc", exact: true }).click();
        await p
          .getByRole("heading", { name: "Tin đã đăng (201)", exact: true })
          .waitFor();
        report.checks++;
        // An old account's delayed GET must not restore private rooms after logout.
        const old = await (
          await c.request.get("/api/landlord?q=" + encodeURIComponent(f.prefix))
        ).json();
        let releaseOld;
        const oldGate = new Promise((r) => (releaseOld = r));
        let held = false;
        await p.route("**/api/landlord?*", async (route) => {
          if (!held) {
            held = true;
            await oldGate;
            try {
              await route.fulfill({ json: old });
            } catch {}
            return;
          }
          await route.continue();
        });
        const pending = p.waitForRequest(
          (r) => new URL(r.url()).pathname === "/api/landlord",
        );
        await p.getByLabel(search, { exact: true }).fill(f.prefix);
        await pending;
        await c.clearCookies();
        await p.evaluate(() =>
          window.dispatchEvent(new Event("account-session-changed")),
        );
        await p
          .getByRole("link", { name: "Đăng nhập chủ trọ", exact: true })
          .waitFor();
        releaseOld();
        await p.waitForTimeout(250);
        eq(await p.locator(".management-room").count(), 0);
        eq(
          await p
            .getByRole("link", { name: "Đăng nhập chủ trọ", exact: true })
            .count(),
          1,
        );
      }
      await c.close();
    }
    eq(report.errors, []);
    fs.writeFileSync(
      path.join(out, "results.json"),
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
