const root = process.cwd();
const { chromium } = require(root + "/node_modules/playwright");
const fs = require("fs");
const assert = require("node:assert/strict");
const base = process.env.TEST_BASE_URL,
  output = process.env.TEST_REPORT_FILE || "work/data-loading.json";
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["127.0.0.1", "localhost"].includes(new URL(base).hostname)
)
  throw new Error(
    "Use isolated localhost QA seeded by tests/fixtures/data-loading.mjs.",
  );

(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const report = {
    base,
    pages: [],
    pagination: [],
    partialHome: {},
    admin: {},
    apiTimings: {},
  };
  try {
    for (const width of [1440, 390])
      for (const path of ["/", "/bang-tin", "/thao-luan"]) {
        const c = await b.newContext({
            baseURL: base,
            viewport: { width, height: 950 },
          }),
          p = await c.newPage();
        const requests = [],
          errors = [];
        p.on("request", (r) => {
          if (r.url().includes("/api/"))
            requests.push(new URL(r.url()).pathname);
        });
        p.on("pageerror", (e) => errors.push(e.message));
        const start = Date.now();
        await p.goto(path);
        await p.locator(".room-card,.conversation-card").first().waitFor();
        const cardsReadyMs = Date.now() - start;
        await p.waitForLoadState("networkidle");
        report.pages.push({
          path,
          width,
          cards: await p.locator(".room-card,.conversation-card").count(),
          cardsReadyMs,
          apiRequests: requests.length,
          accountRequests: requests.filter((s) => s === "/api/auth/me").length,
          individualInteractions: requests.filter((s) =>
            s.endsWith("/interactions"),
          ).length,
          requests,
          errors,
        });
        await c.close();
      }
    for (const sort of ["newest", "price_asc", "price_desc", "area_desc"]) {
      let ids = [];
      for (let offset = 0; offset < 60; offset += 12) {
        const r = await fetch(
          base + "/api/listings?limit=12&offset=" + offset + "&sort=" + sort,
        );
        const p = await r.json();
        ids.push(...p.data.map((v) => v.externalId));
      }
      report.pagination.push({
        sort,
        received: ids.length,
        unique: new Set(ids).size,
        duplicateCount: ids.length - new Set(ids).size,
      });
    }
    let postIds = [];
    for (let offset = 0; offset < 72; offset += 12) {
      const p = await (
        await fetch(base + "/api/community/posts?limit=12&offset=" + offset)
      ).json();
      postIds.push(...p.data.map((v) => v.id));
      if (offset === 60) report.lastDiscussionPageHasMore = p.meta.hasMore;
    }
    report.pagination.push({
      sort: "discussions",
      received: postIds.length,
      unique: new Set(postIds).size,
      duplicateCount: postIds.length - new Set(postIds).size,
    });
    const c = await b.newContext({ baseURL: base }),
      p = await c.newPage();
    await p.route("**/api/community/posts?limit=2", (route) =>
      route.fulfill({ status: 503, json: { error: "Lỗi thảo luận giả lập" } }),
    );
    await p.goto("/");
    await p.waitForTimeout(1500);
    report.partialHome = {
      healthyRoomCards: await p.locator(".room-card").count(),
      discussionError: await p
        .getByText("Chưa thể tải thảo luận lúc này.", { exact: true })
        .count(),
      falseEmptyInvitation: await p
        .getByText("Câu hỏi đầu tiên có thể đến từ bạn", { exact: true })
        .count(),
    };
    await c.close();
    const admin = await b.newContext({ baseURL: base });
    const login = await admin.request.post("/api/auth/login", {
      headers: { "x-forwarded-for": "perf-" + Date.now() },
      data: {
        email: process.env.TEST_ADMIN_EMAIL,
        password: process.env.TEST_ADMIN_PASSWORD,
      },
    });
    if (!login.ok()) throw new Error("QA Admin login failed");
    await admin.addCookies(
      (await admin.cookies()).map((v) => ({ ...v, secure: false })),
    );
    const payload = await (
      await admin.request.get("/api/listings?includePending=true&limit=200")
    ).json();
    const existing = new Set(payload.data.map((v) => v.externalId));
    let missing = "";
    for (let i = 0; i < 1000; i++)
      if (!existing.has("perf-room-" + String(i).padStart(5, "0"))) {
        missing = String(i).padStart(5, "0");
        break;
      }
    const a = await admin.newPage();
    await a.goto("/admin?tab=listings");
    await a.getByLabel("Tìm bài đăng quản trị", { exact: true }).waitFor();
    await a
      .getByLabel("Tìm bài đăng quản trị", { exact: true })
      .fill("[Kiểm thử dữ liệu] Phòng " + missing);
    await a.waitForTimeout(700);
    report.admin = {
      total: payload.meta.count,
      initialApiLimit: payload.data.length,
      target: missing,
      searchMatches: await a
        .locator(".source-row")
        .filter({
          has: a.getByText("[Kiểm thử dữ liệu] Phòng " + missing, {
            exact: true,
          }),
        })
        .count(),
    };
    report.admin.statusFilters = [];
    for (const status of [
      "verified",
      "needs_review",
      "rejected",
      "hidden",
      "rented",
    ]) {
      const data = await (
        await admin.request.get(
          "/api/listings?includePending=true&status=" + status + "&limit=20",
        )
      ).json();
      assert.equal(data.meta.count, status === "verified" ? 1000 : 20);
      assert(data.data.every((row) => row.verificationStatus === status));
      report.admin.statusFilters.push(status);
    }
    const query = a.getByLabel("Tìm bài đăng quản trị", { exact: true });
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    await a.route("**/api/listings?**", async (route) => {
      if (
        new URL(route.request().url()).searchParams.get("q") === "Phòng 00001"
      ) {
        const response = await route.fetch();
        await gate;
        return route.fulfill({ response });
      }
      return route.continue();
    });
    const started = a.waitForRequest(
      (req) => new URL(req.url()).searchParams.get("q") === "Phòng 00001",
    );
    await query.fill("Phòng 00001");
    await started;
    await query.fill("Phòng 00002");
    await a
      .getByText("[Kiểm thử dữ liệu] Phòng 00002", { exact: true })
      .waitFor();
    release();
    await a.waitForTimeout(200);
    assert.equal(
      await a
        .getByText("[Kiểm thử dữ liệu] Phòng 00001", { exact: true })
        .count(),
      0,
    );
    report.admin.lateSearchIgnored = true;
    await query.fill("");
    await a.waitForFunction(
      () => document.querySelectorAll(".listing-checkbox input").length === 20,
    );
    const choices = a.getByRole("checkbox", { name: /^Chọn tin:/ });
    for (let index = 0; index < 3; index++) await choices.nth(index).check();
    let writes = 0;
    await a.route("**/api/listings/*/status", (route) => {
      writes++;
      if (writes === 3) return route.abort();
      return route.fulfill({
        status: writes === 2 ? 503 : 200,
        json:
          writes === 2
            ? { error: "Lỗi kiểm thử" }
            : { data: { updated: true } },
      });
    });
    await a.getByRole("button", { name: "Duyệt 3 bài", exact: true }).click();
    await a
      .getByText(
        "Đã cập nhật 1/3 bài. 2 bài chưa cập nhật; vẫn được chọn để thử lại.",
        { exact: true },
      )
      .waitFor();
    await a.getByRole("button", { name: "Duyệt 2 bài", exact: true }).waitFor();
    await a.getByRole("button", { name: "Duyệt 2 bài", exact: true }).click();
    await a.getByText("Đã cập nhật 2/2 bài.", { exact: true }).waitFor();
    report.admin.partialBatchErrors = true;
    await a.getByRole("button", { name: /^Cộng đồng/ }).click();
    await a.locator(".source-row").first().waitFor();
    const pages = [];
    for (let n = 1; n <= 4; n++) {
      await a.getByText("Trang " + n, { exact: true }).waitFor();
      pages.push(await a.locator(".source-row strong").allTextContents());
      if (n < 4)
        await a.getByRole("button", { name: "Trang sau", exact: true }).click();
    }
    assert.equal(pages.flat().length, 80);
    assert.equal(new Set(pages.flat()).size, 80);
    assert(
      await a
        .getByRole("button", { name: "Trang sau", exact: true })
        .isDisabled(),
    );
    report.admin.communityPagination = true;
    const { default: AxeBuilder } = require("@axe-core/playwright");
    report.admin.accessibility = [];
    for (const width of [1440, 390]) {
      await a.setViewportSize({ width, height: 950 });
      const scan = await new AxeBuilder({ page: a })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      assert.equal(scan.violations.length, 0, JSON.stringify(scan.violations));
      assert(
        await a.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      report.admin.accessibility.push({ width, violations: [] });
    }
    await admin.close();
    const viewer = await b.newContext({ baseURL: base });
    const signed = await viewer.request.post("/api/auth/user-login", {
      data: { email: "perf-viewer@test.local", password: "PerfTest123!" },
    });
    assert(signed.ok());
    await viewer.addCookies(
      (await viewer.cookies()).map((v) => ({ ...v, secure: false })),
    );
    const feed = await (
      await viewer.request.get("/api/community/posts?limit=12")
    ).json();
    assert(
      feed.data.every(
        (post) =>
          post.interactionSummary.total === 1 &&
          post.interactionSummary.viewerReaction === "like",
      ),
    );
    const page = await viewer.newPage();
    await page.goto("/thao-luan");
    const like = page
      .locator(".conversation-card")
      .first()
      .getByRole("button", { name: /^Thích:/ });
    await like.waitFor();
    assert.equal(await like.getAttribute("aria-pressed"), "true");
    await like.click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('.conversation-card button[aria-label^="Thích:"]')
          ?.getAttribute("aria-pressed") === "false",
    );
    await like.click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('.conversation-card button[aria-label^="Thích:"]')
          ?.getAttribute("aria-pressed") === "true",
    );
    await page.goto("/cum/hai-chau");
    await page.locator(".room-card").first().waitFor();
    assert.equal(await page.locator(".room-card").count(), 12);
    assert.equal(await page.locator(".conversation-card").count(), 12);
    assert((await page.getByRole("button", { name: /^Lưu:/ }).count()) > 0);
    report.areaViewer = true;
    report.viewerReactions = true;
    await viewer.close();
    for (const path of [
      "/api/listings?limit=12",
      "/api/community/posts?limit=12",
    ]) {
      const times = [];
      for (let i = 0; i < 20; i++) {
        const t = performance.now();
        const r = await fetch(base + path);
        await r.json();
        if (!r.ok) throw new Error(path);
        times.push(performance.now() - t);
      }
      times.sort((a, b) => a - b);
      report.apiTimings[path] = { p50: times[9], p95: times[18], samples: 20 };
    }
    let checks = 0;
    function check(value, message) {
      assert.ok(value, message);
      checks++;
    }
    for (const item of report.pages) {
      check(item.errors.length === 0, "No uncaught browser errors");
      check(item.accountRequests === 1, "Share concurrent session read");
      check(
        item.individualInteractions === 0,
        "No per-card interaction requests",
      );
      check(
        item.cards === (item.path === "/" ? 5 : 12),
        "Expected visible card count",
      );
    }
    for (const item of report.pagination)
      check(
        item.duplicateCount === 0 && item.received > 0,
        "Stable pagination",
      );
    check(report.lastDiscussionPageHasMore === false, "No false extra page");
    check(
      report.partialHome.healthyRoomCards === 3 &&
        report.partialHome.discussionError === 1 &&
        report.partialHome.falseEmptyInvitation === 0,
      "Partial API failure preserves rooms",
    );
    check(
      report.admin.total === 1080 && report.admin.searchMatches === 1,
      "Admin searches all stored rooms",
    );
    check(report.admin.statusFilters.length === 5, "All Admin status filters");
    check(
      report.admin.lateSearchIgnored,
      "A stale search never replaces current results",
    );
    check(
      report.viewerReactions,
      "Batch viewer reactions and real mutations agree",
    );
    check(
      report.admin.communityPagination,
      "All Admin discussion pages reachable",
    );
    check(
      report.admin.accessibility.length === 2,
      "Admin pagination accessible at desktop/mobile widths",
    );
    check(
      report.areaViewer,
      "Area previews stay bounded and preserve logged-in actions",
    );
    check(
      report.admin.partialBatchErrors,
      "Batch operations report HTTP/network failures and preserve only failed selections",
    );
    report.checks = checks;
    fs.mkdirSync(require("path").dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify(
        {
          pages: report.pages.map(
            ({
              path,
              width,
              apiRequests,
              accountRequests,
              individualInteractions,
              cardsReadyMs,
            }) => ({
              path,
              width,
              apiRequests,
              accountRequests,
              individualInteractions,
              cardsReadyMs,
            }),
          ),
          pagination: report.pagination,
          partialHome: report.partialHome,
          admin: report.admin,
          apiTimings: report.apiTimings,
        },
        null,
        2,
      ),
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
