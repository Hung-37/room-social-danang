// Isolated local QA only. Includes real server commits followed by lost HTTP responses.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs");
const base = process.env.TEST_BASE_URL,
  file = process.env.TEST_CONTENT_FIXTURES,
  out = process.env.TEST_SCREENSHOT_DIR || "work/content-ui";
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !file ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname)
)
  throw new Error(
    "Set TEST_ISOLATED_DB=1, local TEST_BASE_URL and TEST_CONTENT_FIXTURES.",
  );
fs.mkdirSync(out, { recursive: true });
(async () => {
  const f = JSON.parse(fs.readFileSync(file));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
  let checks = 0;
  const errors = [],
    scans = [];
  async function context(cookie) {
    const c = await browser.newContext({ baseURL: base });
    c.setDefaultTimeout(10000);
    await c.addCookies(
      cookie.split("; ").map((v) => {
        const i = v.indexOf("=");
        return {
          name: v.slice(0, i),
          value: v.slice(i + 1),
          url: base,
          httpOnly: true,
          secure: false,
        };
      }),
    );
    return c;
  }
  async function api(c, path, method = "GET", data) {
    const r = await c.request.fetch(path, { method, data });
    assert(r.ok(), path + ": " + (await r.text()));
    checks++;
    return (await r.json()).data;
  }
  try {
    const author = await context(f.author),
      other = await context(f.other),
      landlord = await context(f.landlord),
      admin = await context(f.admin),
      p = await author.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    async function scan(page, label, width) {
      await page.setViewportSize({ width, height: 950 });
      await page.waitForLoadState("networkidle");
      const d = await page.evaluate(() => ({
        w: innerWidth,
        s: document.documentElement.scrollWidth,
      }));
      assert(d.s <= d.w + 1, label + " overflow");
      const a = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .analyze();
      assert.equal(a.violations.length, 0, JSON.stringify(a.violations));
      scans.push({ label, width, violations: [] });
      checks += 2;
      await page.screenshot({
        path: `${out}/${label}-${width}.png`,
        fullPage: false,
      });
    }
    await p.goto("/bai/" + f.post.id);
    const comment = p
      .locator(".comment-item")
      .filter({ has: p.locator('[id="comment-' + f.comment.id + '"]') });
    await comment
      .getByRole("button", { name: "Sửa bình luận", exact: true })
      .click();
    await comment
      .getByLabel("Nội dung bình luận")
      .fill("Bình luận UI sau chỉnh sửa, không phải nhận xét thật.");
    await comment
      .getByRole("button", { name: "Lưu bình luận", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Đã lưu bình luận." })
      .waitFor();
    checks++;
    let row = p
      .locator(".comment-item")
      .filter({ hasText: "Bình luận UI sau chỉnh sửa" });
    p.once("dialog", (d) => d.dismiss());
    await row
      .getByRole("button", { name: "Xóa bình luận", exact: true })
      .click();
    assert.equal(await row.count(), 1);
    checks++;
    p.once("dialog", (d) => d.accept());
    await row
      .getByRole("button", { name: "Xóa bình luận", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Đã xóa bình luận." })
      .waitFor();
    assert.equal(await row.count(), 0);
    checks++;
    const x = await other.newPage();
    await x.goto("/bai/" + f.post.id);
    assert.equal(
      await x
        .getByRole("button", { name: "Sửa bình luận", exact: true })
        .count(),
      0,
    );
    checks++;
    await p.goto("/bai-viet-cua-toi");
    await p
      .getByRole("button", { name: "Sửa bài viết", exact: true })
      .first()
      .waitFor();
    let card = p.locator(".management-card").filter({ hasText: f.post.title });
    if ((await card.count()) === 0) {
      await p.getByRole("button", { name: "Trang sau", exact: true }).click();
      await card.waitFor();
    }
    await card
      .getByRole("button", { name: "Sửa bài viết", exact: true })
      .click();
    const editForm = p.locator("form.listing-form");
    const updated = f.post.title + " đã sửa UI";
    await editForm.getByLabel("Tiêu đề", { exact: true }).fill(updated);
    await editForm
      .getByLabel("Nội dung", { exact: true })
      .fill(
        "Nội dung đã sửa trong kiểm thử. Bài phải quay lại hàng đợi Admin kiểm duyệt.",
      );
    for (const width of [1440, 390]) await scan(p, "own-editor", width);
    await p.route("**/api/community/posts/" + f.post.id, (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 503,
            json: { error: "Kết nối tạm lỗi; thử lại." },
          })
        : route.continue(),
    );
    await editForm
      .getByRole("button", { name: "Lưu và gửi duyệt lại", exact: true })
      .click();
    await p.getByRole("alert").filter({ hasText: "Kết nối tạm lỗi" }).waitFor();
    assert.equal(
      await editForm.getByLabel("Tiêu đề", { exact: true }).inputValue(),
      updated,
    );
    checks++;
    await p.unroute("**/api/community/posts/" + f.post.id);
    await editForm
      .getByRole("button", { name: "Lưu và gửi duyệt lại", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Đã lưu. Bài viết đang chờ Admin duyệt lại." })
      .waitFor();
    const changed = p.locator(".management-card").filter({ hasText: updated });
    await changed.getByText("Chờ duyệt", { exact: true }).waitFor();
    assert.equal(
      (await other.request.get("/api/community/posts/" + f.post.id)).status(),
      404,
    );
    checks++;
    for (const width of [1440, 390]) await scan(p, "own-posts", width);
    // Read/delete a single real notification; a cancelled delete must not remove it.
    const n = await api(author, "/api/notifications");
    let item = n.find(
      (v) => !v.isRead && v.title.startsWith("[Kiểm thử] Thông báo riêng"),
    );
    assert(item);
    await p.goto("/thong-bao");
    let notification = p
      .locator(".management-card")
      .filter({
        has: p.getByRole("link", {
          name: item.title + " · Chưa đọc",
          exact: true,
        }),
      })
      .first();
    await notification
      .getByRole("button", {
        name: "Đánh dấu đã đọc: " + item.title,
        exact: true,
      })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Đã đánh dấu thông báo là đã đọc." })
      .waitFor();
    checks++;
    const target = (await api(author, "/api/notifications")).find(
      (v) => String(v.id) === String(item.id),
    );
    assert(target.isRead);
    checks++;
    notification = p
      .locator(".management-card")
      .filter({ has: p.getByRole("link", { name: item.title, exact: true }) })
      .first();
    p.once("dialog", (d) => d.dismiss());
    await notification
      .getByRole("button", {
        name: "Xóa thông báo: " + item.title,
        exact: true,
      })
      .click();
    assert.equal(await notification.count(), 1);
    checks++;
    p.once("dialog", (d) => d.accept());
    await notification
      .getByRole("button", {
        name: "Xóa thông báo: " + item.title,
        exact: true,
      })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Đã xóa thông báo." })
      .waitFor();
    assert(
      !(await api(author, "/api/notifications")).some(
        (v) => String(v.id) === String(item.id),
      ),
    );
    checks++;
    for (const width of [1440, 390])
      await scan(p, "individual-notifications", width);
    // A real discussion creation commits, then its first response is intentionally lost.
    await p.goto("/thao-luan");
    await p
      .getByRole("button", { name: "Viết thảo luận", exact: true })
      .click();
    const form = p.locator(".discussion-form");
    const title = "[Kiểm thử] Gửi lại thảo luận " + Date.now();
    await form.getByLabel("Tiêu đề", { exact: true }).fill(title);
    await form
      .getByLabel("Nội dung", { exact: true })
      .fill(
        "Dữ liệu tổng hợp cho kiểm thử mạng yếu, không phải bài chia sẻ thật.",
      );
    let calls = 0,
      firstId,
      firstKey;
    await p.route("**/api/community/posts", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      calls++;
      const key = route.request().headers()["idempotency-key"];
      const response = await route.fetch();
      const body = await response.json();
      assert.equal(response.status(), 201);
      if (calls === 1) {
        firstId = body.data.id;
        firstKey = key;
        return route.abort();
      }
      assert.equal(key, firstKey);
      assert.equal(body.data.id, firstId);
      assert.equal(body.replayed, true);
      checks += 3;
      return route.fulfill({ response });
    });
    await form.getByRole("button", { name: /Gửi/ }).click();
    await p
      .getByText("Mất kết nối. Vui lòng thử lại.", { exact: true })
      .waitFor();
    assert.equal(
      await form.getByLabel("Tiêu đề", { exact: true }).inputValue(),
      title,
    );
    checks++;
    await form.getByRole("button", { name: /Gửi/ }).click();
    await p
      .getByText(
        "Đã gửi bài. Nội dung sẽ xuất hiện sau khi quản trị viên duyệt.",
        { exact: true },
      )
      .waitFor();
    assert.equal(calls, 2);
    checks++;
    // Same end-to-end lost-response test for room creation, including persisted server data.
    const l = await landlord.newPage();
    l.on("pageerror", (e) => errors.push(e.message));
    await l.goto("/dang-phong");
    const roomTitle = "[Kiểm thử] Gửi lại phòng " + Date.now();
    await l.getByLabel("Tiêu đề", { exact: true }).fill(roomTitle);
    await l
      .getByLabel("Mô tả phòng", { exact: true })
      .fill(
        "Phòng giả lập để kiểm tra gửi lại sau mất kết nối, không phải tin cho thuê thật.",
      );
    await l.getByLabel("Địa chỉ", { exact: true }).fill("Hải Châu, Đà Nẵng");
    await l
      .getByLabel("Giá thuê / tháng (đồng)", { exact: true })
      .fill("2500000");
    await l.getByLabel("Diện tích (m²)", { exact: true }).fill("25.5");
    let roomCalls = 0,
      roomKey,
      roomId;
    await l.route("**/api/listings/create", async (route) => {
      roomCalls++;
      const key = route.request().headers()["idempotency-key"];
      const response = await route.fetch();
      const body = await response.json();
      assert.equal(response.status(), 201);
      if (roomCalls === 1) {
        roomKey = key;
        roomId = body.data.externalId;
        return route.abort();
      }
      assert.equal(key, roomKey);
      assert.equal(body.data.externalId, roomId);
      assert.equal(body.replayed, true);
      checks += 3;
      return route.fulfill({ response });
    });
    await l
      .getByRole("button", { name: "Gửi tin chờ duyệt", exact: true })
      .click();
    await l.getByRole("alert").waitFor();
    assert.equal(
      await l.getByLabel("Tiêu đề", { exact: true }).inputValue(),
      roomTitle,
    );
    checks++;
    await l
      .getByRole("button", { name: "Gửi tin chờ duyệt", exact: true })
      .click();
    await l.waitForURL("**/quan-ly-phong?da-gui=1");
    const rooms = await api(landlord, "/api/landlord");
    assert.equal(rooms.listings.filter((v) => v.title === roomTitle).length, 1);
    checks++;
    // Return to own content and delete through the UI, preserving cancel behavior.
    await p.goto("/bai-viet-cua-toi");
    await p
      .getByRole("button", { name: "Sửa bài viết", exact: true })
      .first()
      .waitFor();
    let postCard = p.locator(".management-card").filter({ hasText: updated });
    if ((await postCard.count()) === 0) {
      await p.getByRole("button", { name: "Trang sau", exact: true }).click();
      await postCard.waitFor();
    }
    p.once("dialog", (d) => d.dismiss());
    await postCard
      .getByRole("button", { name: "Xóa bài viết", exact: true })
      .click();
    assert.equal(await postCard.count(), 1);
    checks++;
    p.once("dialog", (d) => d.accept());
    await postCard
      .getByRole("button", { name: "Xóa bài viết", exact: true })
      .click();
    await p
      .getByRole("status")
      .filter({ hasText: "Đã xóa bài viết." })
      .waitFor();
    assert.equal(
      (await author.request.get("/api/community/posts/" + f.post.id)).status(),
      404,
    );
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    fs.writeFileSync(
      out + "/results.json",
      JSON.stringify({ checks, scans, errors }, null, 2),
    );
    console.log(
      `PASS: ${checks} content UI checks; owner editing/deletion/cancel/error retention, comments, individual notifications, real lost-response replay for posts and rooms; ${scans.length} Axe scans without violations.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
