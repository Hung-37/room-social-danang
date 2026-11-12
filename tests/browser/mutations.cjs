// Synthetic local accounts and controlled HTTP timing. Never run against a public service.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const base = process.env.TEST_BASE_URL;
if (!base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error(
    "Set a localhost TEST_BASE_URL with an isolated QA database.",
  );
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  const results = [];
  let checks = 0;
  async function scenario(name, run) {
    const c = await browser.newContext({ baseURL: base });
    c.setDefaultTimeout(4000);
    try {
      const reg = await c.request.post("/api/auth/register", {
        data: {
          name: "Kiểm thử mutation",
          email: `mutation-${Date.now()}-${Math.random().toString(16).slice(2)}@test.local`,
          password: "MutationTest123!",
          role: "student",
        },
      });
      assert.equal(reg.status(), 201);
      await c.addCookies(
        (await c.cookies()).map((v) => ({ ...v, secure: false })),
      );
      const page = await c.newPage();
      await run(c, page);
      results.push({ name, status: "PASS" });
    } catch (e) {
      results.push({ name, status: "FAIL", error: e.message });
    } finally {
      await c.close();
    }
  }
  function gate() {
    let release;
    const promise = new Promise((resolve) => (release = resolve));
    return { promise, release };
  }
  async function favorite(c, page, order) {
    const data = await (await c.request.get("/api/listings?limit=1")).json();
    const room = data.data[0];
    assert(room);
    const putStarted = gate(),
      putRelease = gate(),
      getStarted = gate(),
      getRelease = gate();
    let holdGet = false,
      guest = false;
    await page.route("**/api/favorites", async (route) => {
      if (route.request().method() === "PUT") {
        putStarted.release();
        await putRelease.promise;
        return route.fulfill({ status: 200, json: { data: { saved: true } } });
      }
      if (holdGet) {
        getStarted.release();
        await getRelease.promise;
      }
      return route.fulfill({
        status: guest ? 401 : 200,
        json: guest ? { error: "Vui lòng đăng nhập." } : { data: [] },
      });
    });
    await page.goto("/bang-tin?q=" + encodeURIComponent(room.title));
    const card = page
      .locator(".room-card")
      .filter({ hasText: room.title })
      .first();
    const save = card.getByRole("button", {
      name: "Lưu: " + room.title,
      exact: true,
    });
    await save.click();
    await putStarted.promise;
    try {
      if (order === "logout") {
        guest = true;
        await c.clearCookies();
        const response = page.waitForResponse(
          (r) => r.url().endsWith("/api/favorites") && r.status() === 401,
        );
        await page.evaluate(() =>
          window.dispatchEvent(new Event("account-session-changed")),
        );
        await response;
        putRelease.release();
        // Logout now refreshes both the Header and feed authentication state.
        // The old account's pending response must not restore an authenticated button.
        await card
          .getByRole("link", {
            name: "Đăng nhập để lưu: " + room.title,
            exact: true,
          })
          .waitFor();
        assert.equal(
          await card
            .getByRole("button", { name: "Lưu: " + room.title, exact: true })
            .count(),
          0,
        );
        checks++;
      } else {
        holdGet = order === "stale-get";
        const response = page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/favorites") &&
            r.request().method() === "GET",
        );
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        if (holdGet) await getStarted.promise;
        else await response;
        const saved = page.waitForResponse(
          (r) =>
            r.url().endsWith("/api/favorites") &&
            r.request().method() === "PUT",
        );
        putRelease.release();
        await saved;
        getRelease.release();
        await response;
        const button = card.getByRole("button", {
          name: "Bỏ lưu: " + room.title,
          exact: true,
        });
        await button.waitFor();
        assert.equal(await button.getAttribute("aria-pressed"), "true");
        checks++;
      }
    } finally {
      putRelease.release();
      getRelease.release();
    }
  }
  await scenario(
    "focus refresh during save preserves the confirmed mutation",
    (c, p) => favorite(c, p, "focus"),
  );
  await scenario("a late GET cannot overwrite a confirmed save", (c, p) =>
    favorite(c, p, "stale-get"),
  );
  await scenario(
    "a response from the previous account cannot restore saved state",
    (c, p) => favorite(c, p, "logout"),
  );
  await scenario(
    "notification network failure, pending guard, retry and Header sync",
    async (c, p) => {
      let mode = "abort",
        read = false,
        patches = 0;
      const started = gate(),
        release = gate();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.route("**/api/notifications", async (route) => {
        if (route.request().method() === "PATCH") {
          patches++;
          if (mode === "abort") return route.abort();
          started.release();
          await release.promise;
          read = true;
          return route.fulfill({ status: 200, json: { success: true } });
        }
        return route.fulfill({
          status: 200,
          json: {
            data: [
              {
                id: 987654,
                title: "[Kiểm thử] Thông báo mutation",
                body: "Dữ liệu tổng hợp",
                href: "/profile",
                isRead: read,
                createdAt: new Date().toISOString(),
              },
            ],
          },
        });
      });
      await p.goto("/thong-bao");
      const main = p.locator("main");
      await main.getByText(/Chưa đọc/).waitFor();
      const button = main.getByRole("button", {
        name: /^(Đánh dấu tất cả đã đọc|Đang cập nhật\.\.\.)$/,
      });
      await button.click();
      await main
        .getByRole("alert")
        .filter({ hasText: /Chưa thể/ })
        .waitFor();
      assert.deepEqual(errors, []);
      assert.equal(await main.getByText(/Chưa đọc/).count(), 1);
      checks += 2;
      mode = "hold";
      try {
        await button.click();
        await started.promise;
        assert(await button.isDisabled());
        assert.equal(patches, 2);
        checks += 2;
        release.release();
        await main.getByText(/Chưa đọc/).waitFor({ state: "hidden" });
        await p
          .getByRole("button", { name: "Thông báo, 0 chưa đọc", exact: true })
          .waitFor();
        checks += 2;
      } finally {
        release.release();
      }
    },
  );
  await scenario(
    "notification loading failure offers retry without a false empty state",
    async (c, p) => {
      let fail = true;
      await p.route("**/api/notifications", (route) =>
        route.fulfill({
          status: fail ? 503 : 200,
          json: fail
            ? { error: "Dịch vụ tạm lỗi" }
            : {
                data: [
                  {
                    id: 987653,
                    title: "Thông báo đã khôi phục",
                    body: "Dữ liệu tổng hợp",
                    isRead: false,
                    href: "/profile",
                    createdAt: new Date().toISOString(),
                  },
                ],
              },
        }),
      );
      await p.goto("/thong-bao");
      const main = p.locator("main");
      await main.getByRole("alert").waitFor();
      assert.equal(
        await main.getByText("Chưa có thông báo mới.", { exact: true }).count(),
        0,
      );
      checks++;
      fail = false;
      await main.getByRole("button", { name: "Thử lại", exact: true }).click();
      await main
        .getByRole("link", { name: /Thông báo đã khôi phục/ })
        .waitFor();
      checks++;
    },
  );
  await browser.close();
  const summary = { checks, results };
  if (process.env.TEST_MUTATION_REPORT)
    fs.writeFileSync(
      process.env.TEST_MUTATION_REPORT,
      JSON.stringify(summary, null, 2),
    );
  console.log(JSON.stringify(summary, null, 2));
  if (results.some((r) => r.status !== "PASS")) process.exitCode = 1;
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
