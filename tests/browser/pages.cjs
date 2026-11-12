// Checks every non-home page with synthetic accounts on an isolated local server.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const base = process.env.TEST_BASE_URL,
  out = process.env.TEST_SCREENSHOT_DIR || "work/pages";
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error(
    "Set TEST_ISOLATED_DB=1 and an isolated localhost TEST_BASE_URL.",
  );
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const report = { pages: [], errors: [], scans: 0, interactions: 0 };
  let inject = false;
  try {
    const contexts = {};
    for (const name of ["guest", "student", "owner", "admin"]) {
      contexts[name] = await browser.newContext({ baseURL: base });
      contexts[name].setDefaultTimeout(10000);
    }
    async function api(role, url, method = "GET", data, status = 200) {
      const c = contexts[role];
      const r = await c.request.fetch(url, { method, data });
      const p = await r.json();
      assert.equal(r.status(), status, url + ": " + JSON.stringify(p));
      await c.addCookies(
        (await c.cookies()).map((v) => ({ ...v, secure: false })),
      );
      return p.data;
    }
    const stamp = Date.now(),
      roomTitle = "[Kiểm thử trang] Phòng " + stamp,
      postTitle = "[Kiểm thử trang] Thảo luận " + stamp;
    await api(
      "student",
      "/api/auth/register",
      "POST",
      {
        name: "[Kiểm thử] Người tìm phòng",
        email: "pages-student-" + stamp + "@test.local",
        password: "PageAudit123!",
        role: "student",
      },
      201,
    );
    const owner = await api(
      "owner",
      "/api/auth/register",
      "POST",
      {
        name: "[Kiểm thử] Chủ phòng",
        email: "pages-owner-" + stamp + "@test.local",
        password: "PageAudit123!",
        role: "landlord",
      },
      201,
    );
    await api("admin", "/api/auth/login", "POST", {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    });
    await api("admin", "/api/admin/landlords", "PATCH", {
      id: owner.id,
      status: "verified",
    });
    const room = await api(
      "owner",
      "/api/listings/create",
      "POST",
      {
        title: roomTitle,
        summary:
          "Phòng tổng hợp để kiểm tra giao diện, không phải tin cho thuê thật.",
        address: "12 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
        price: 2500000,
        area: 25,
      },
      201,
    );
    await api("admin", "/api/listings/" + room.externalId + "/status", "POST", {
      status: "verified",
    });
    const post = await api(
      "student",
      "/api/community/posts",
      "POST",
      {
        title: postTitle,
        summary:
          "Thảo luận tổng hợp để kiểm tra hiển thị và tương tác ở các trang trong ứng dụng.",
        clusterId: "hai-chau",
        postKind: "question",
      },
      201,
    );
    await api("admin", "/api/community/posts/" + post.id + "/status", "PATCH", {
      status: "verified",
    });
    await api(
      "owner",
      "/api/community/posts/" + post.id + "/comments",
      "POST",
      { text: "Bình luận tổng hợp để kiểm tra trang chi tiết." },
      201,
    );
    const chat = await api("student", "/api/chat", "POST", {
      listingId: room.externalId,
    });
    await api(
      "student",
      "/api/chat/" + chat.id,
      "POST",
      { text: "Tin nhắn tổng hợp kiểm tra trang hộp thư." },
      201,
    );
    await api("student", "/api/chat/" + chat.id, "PATCH", {
      action: "report",
      reason: "[Kiểm thử] Báo cáo tổng hợp cho trang Admin.",
    });
    const when = new Date(Date.now() + 48 * 3600000);
    when.setUTCSeconds(0, 0);
    await api(
      "student",
      "/api/appointments",
      "POST",
      {
        conversationId: chat.id,
        startsAt: when.toISOString(),
        note: "Lịch tổng hợp để kiểm tra trang.",
      },
      201,
    );
    const publicPaths = [
      "/bang-tin",
      "/thao-luan",
      "/cum",
      "/khu-vuc",
      "/cum/hai-chau",
      "/bai/" + room.externalId,
      "/bai/" + post.id,
      "/dang-nhap",
      "/dang-ky",
      "/quy-dinh",
    ];
    const privatePaths = [
      "/profile",
      "/dang-phong",
      "/quan-ly-phong",
      "/quan-ly-phong/" + room.externalId,
      "/tin-nhan",
      "/lich-xem-phong",
      "/thong-bao",
      "/bai-viet-cua-toi",
    ];
    const adminPaths = [
      "/admin",
      "/admin/chu-tro",
      "/admin/nguoi-dung",
      "/admin/cau-hinh",
      "/admin/tin-nhan",
    ];
    const sets = {
      guest: [...publicPaths, ...privatePaths, ...adminPaths],
      student: [
        "/profile",
        "/thong-bao",
        "/bai-viet-cua-toi",
        "/lich-xem-phong",
        "/tin-nhan?hoi-thoai=" + chat.id,
        "/thao-luan",
        "/bai/" + post.id,
      ],
      owner: [
        "/dang-phong",
        "/quan-ly-phong",
        "/quan-ly-phong/" + room.externalId,
        "/tin-nhan?hoi-thoai=" + chat.id,
      ],
      admin: adminPaths,
    };
    for (const width of [1440, 390])
      for (const [role, urls] of Object.entries(sets)) {
        const p = await contexts[role].newPage();
        await p.setViewportSize({ width, height: 950 });
        const scanned = new Set();
        p.on("pageerror", (e) =>
          report.errors.push({ role, width, url: p.url(), message: e.message }),
        );
        p.on("response", (r) => {
          if (!inject && r.status() >= 500)
            report.errors.push({
              role,
              width,
              url: r.url(),
              status: r.status(),
            });
        });
        for (const url of urls) {
          const item = { role, width, url };
          try {
            const response = await p.goto(url);
            assert.equal(response.status(), 200);
            await p.locator("h1").first().waitFor();
            for (let i = 0; i < 25; i++) {
              const text = await p.locator("main").innerText();
              if (!/Đang tải(?:\s|\.|…)|Đang mở phòng/.test(text)) break;
              await p.waitForTimeout(120);
            }
            const actual = new URL(p.url()).pathname;
            item.actual = actual;
            if (role === "guest" && url.startsWith("/admin"))
              assert.equal(actual, "/dang-nhap");
            else assert.equal(actual, new URL(url, base).pathname);
            assert.equal(await p.locator("html").getAttribute("lang"), "vi");
            assert.equal(await p.locator("main").count(), 1);
            const size = await p.evaluate(() => ({
              width: innerWidth,
              scroll: document.documentElement.scrollWidth,
            }));
            assert(
              size.scroll <= size.width + 1,
              "Horizontal overflow: " + JSON.stringify(size),
            );
            assert(
              !(await p.locator("main").innerText()).includes(
                "Application error:",
              ),
            );
            if (!scanned.has(actual)) {
              const a = await new AxeBuilder({ page: p })
                .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
                .analyze();
              item.violations = a.violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => n.target),
              }));
              assert.equal(
                a.violations.length,
                0,
                JSON.stringify(item.violations),
              );
              report.scans++;
              scanned.add(actual);
            }
            if (
              (role === "admin" &&
                ["/admin/tin-nhan", "/admin/chu-tro"].includes(url)) ||
              (role === "student" &&
                [
                  "/profile",
                  "/lich-xem-phong",
                  "/tin-nhan?hoi-thoai=" + chat.id,
                ].includes(url)) ||
              (role === "owner" && url === "/quan-ly-phong")
            )
              await p.screenshot({
                path: path.join(
                  out,
                  role +
                    "-" +
                    url.split("?")[0].replaceAll("/", "-") +
                    "-" +
                    width +
                    ".png",
                ),
              });
            item.passed = true;
          } catch (e) {
            item.passed = false;
            item.error = e.message;
          }
          report.pages.push(item);
        }
        await p.close();
      }
    const p = await contexts.student.newPage();
    p.on("pageerror", (e) =>
      report.errors.push({ phase: "interactions", message: e.message }),
    );
    await p.goto("/bang-tin");
    await p.getByPlaceholder("Tiêu đề, địa chỉ phòng...").fill(roomTitle);
    await p.getByRole("link", { name: roomTitle, exact: true }).waitFor();
    report.interactions++;
    await p.goto("/thao-luan");
    await p.getByPlaceholder("Tiêu đề, nội dung thảo luận...").fill(postTitle);
    await p.getByRole("link", { name: postTitle, exact: true }).waitFor();
    report.interactions++;
    await p.goto("/profile");
    await p
      .getByRole("button", { name: "Chỉnh sửa hồ sơ", exact: true })
      .click();
    await p
      .getByLabel("Tên hiển thị", { exact: true })
      .fill("[Kiểm thử] Hồ sơ đã sửa");
    await p.getByRole("button", { name: "Lưu hồ sơ", exact: true }).click();
    await p
      .getByRole("heading", { name: "[Kiểm thử] Hồ sơ đã sửa", exact: true })
      .waitFor();
    report.interactions++;
    await p.goto("/tin-nhan?hoi-thoai=" + chat.id);
    await p
      .getByLabel("Tin nhắn riêng", { exact: true })
      .fill("Tin nhắn gửi bằng giao diện " + stamp);
    await p.getByRole("button", { name: "Gửi tin nhắn", exact: true }).click();
    await p
      .getByText("Tin nhắn gửi bằng giao diện " + stamp, { exact: true })
      .waitFor();
    report.interactions++;
    await p.close();
    const a = await contexts.admin.newPage();
    a.on("pageerror", (e) =>
      report.errors.push({ phase: "retry", message: e.message }),
    );
    inject = true;
    for (const [url, endpoint, retry, empty] of [
      [
        "/admin/tin-nhan",
        "**/api/admin/chat-reports",
        "Thử tải lại báo cáo",
        "Chưa có báo cáo.",
      ],
      [
        "/admin/chu-tro",
        "**/api/admin/landlords*",
        "Thử tải lại danh sách chủ trọ",
        "Chưa có tài khoản chủ trọ.",
      ],
    ]) {
      await a.route(endpoint, (r) => r.abort());
      await a.goto(url);
      await a.getByRole("button", { name: retry, exact: true }).waitFor();
      assert.equal(await a.getByText(empty, { exact: true }).count(), 0);
      await a.unroute(endpoint);
      await a.getByRole("button", { name: retry, exact: true }).click();
      await a.locator("article").first().waitFor();
      assert.equal(await a.locator("main [role=alert]").count(), 0);
      report.interactions++;
    }
    inject = false;
    await a.close();
    assert.deepEqual(report.errors, []);
    assert(
      report.pages.every((p) => p.passed),
      JSON.stringify(report.pages.filter((p) => !p.passed)),
    );
  } finally {
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(report, null, 2),
    );
    await browser.close();
  }
  console.log(
    JSON.stringify(
      {
        pageCases: report.pages.length,
        scans: report.scans,
        interactions: report.interactions,
        failed: report.pages.filter((p) => !p.passed),
        errors: report.errors,
      },
      null,
      2,
    ),
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
