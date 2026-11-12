// Uses explicitly labelled synthetic images/accounts from test:photos.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const base = process.env.TEST_BASE_URL,
  file = process.env.TEST_PHOTO_FIXTURES;
if (!base || !file)
  throw new Error("Set TEST_BASE_URL and TEST_PHOTO_FIXTURES for isolated QA.");
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Local synthetic test server required.");
const out = process.env.TEST_SCREENSHOT_DIR || "work/photos-ui";
fs.mkdirSync(out, { recursive: true });
(async () => {
  const f = JSON.parse(fs.readFileSync(file));
  // Restore the fixture's original order so repeated visual runs stay deterministic.
  const draftResponse = await fetch(
    base + "/api/landlord/listings/" + f.rooms.gallery,
    { headers: { cookie: f.owner } },
  );
  assert.equal(draftResponse.status, 200);
  const draft = (await draftResponse.json()).data;
  const reset = await fetch(
    base + "/api/landlord/listings/" + f.rooms.gallery,
    {
      method: "PATCH",
      headers: { cookie: f.owner, "Content-Type": "application/json" },
      body: JSON.stringify({
        ...draft,
        action: "edit",
        price: Number(draft.price),
        area: Number(draft.area),
        imageIds: f.images.map((image) => image.id),
      }),
    },
  );
  assert.equal(reset.status, 200);
  const approval = await fetch(
    base + "/api/listings/" + f.rooms.gallery + "/status",
    {
      method: "POST",
      headers: { cookie: f.admin, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "verified" }),
    },
  );
  assert.equal(approval.status, 200);
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
  try {
    const context = await browser.newContext({ baseURL: base });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let checks = 0;
    async function scan(label, width) {
      const r = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      fs.writeFileSync(
        `${out}/axe-${label}-${width}.json`,
        JSON.stringify(r.violations, null, 2),
      );
      assert.equal(r.violations.length, 0, JSON.stringify(r.violations));
      checks++;
      await page.screenshot({
        path: `${out}/${label}-${width}.png`,
        fullPage: true,
      });
    }
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 950 });
      await page.goto("/bang-tin?q=" + encodeURIComponent(draft.title.match(/\d+$/)[0]));
      await page.locator(".room-card").first().waitFor();
      await page
        .locator(".room-card")
        .filter({ hasText: "Ảnh broken" })
        .getByText("Ảnh chưa tải được", { exact: true })
        .waitFor();
      checks++;
      await page
        .locator(".room-card")
        .filter({ hasText: "Ảnh empty" })
        .getByText("Chưa có ảnh phòng", { exact: true })
        .waitFor();
      checks++;
      const covers = await page.locator(".room-cover").evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return r.width / r.height;
        }),
      );
      assert.equal(covers.length, 5);
      checks++;
      assert(covers.every((r) => Math.abs(r - 4 / 3) < 0.02));
      checks++;
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      checks++;
      if (width !== 320) await scan("feed", width);
      await page.goto("/bai/" + f.rooms.gallery);
      await page.locator(".room-gallery button").last().waitFor();
      assert.equal(await page.locator(".room-gallery button").count(), 4);
      checks++;
      await page
        .getByRole("button", { name: "Xem ảnh phòng 2", exact: true })
        .click();
      const image = page.locator(".detail-cover > img");
      await page.waitForFunction(() => {
        const i = document.querySelector(".detail-cover > img");
        return i?.complete && i.naturalWidth > 0;
      });
      assert((await image.getAttribute("src")).endsWith(f.images[1].id));
      checks++;
      assert.equal(
        await image.evaluate((i) => getComputedStyle(i).objectFit),
        "contain",
      );
      checks++;
      assert(await image.evaluate((i) => i.naturalHeight > i.naturalWidth));
      checks++;
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      checks++;
      if (width !== 320) await scan("detail", width);
      await page
        .getByRole("button", {
          name: "Xem ảnh phòng 2 kích thước đầy đủ",
          exact: true,
        })
        .click();
      await page.getByRole("dialog").waitFor();
      await page.waitForFunction(
        () => document.body.style.overflow === "hidden",
      );
      checks++;
      await page.keyboard.press("ArrowRight");
      await page
        .getByRole("dialog")
        .getByText("Ảnh 3 / 4", { exact: true })
        .waitFor();
      checks++;
      await page.getByRole("button", { name: "Ảnh tiếp", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByText("Ảnh 4 / 4", { exact: true })
        .waitFor();
      checks++;
      assert.equal(
        await page
          .locator(".photo-dialog-image > img")
          .evaluate((i) => getComputedStyle(i).objectFit),
        "contain",
      );
      checks++;
      if (width !== 320) await scan("viewer", width);
      await page.keyboard.press("Escape");
      await page.getByRole("dialog").waitFor({ state: "hidden" });
      await page.waitForFunction(
        () => document.body.style.overflow !== "hidden",
      );
      checks++;
      assert.equal(
        await page
          .locator(".photo-open")
          .evaluate((el) => el === document.activeElement),
        true,
      );
      checks++;
    }
    await page.goto("/bai/" + f.rooms.empty);
    await page
      .locator(".detail-cover")
      .getByText("Chưa có ảnh phòng", { exact: true })
      .waitFor();
    assert.equal(await page.locator(".photo-open").count(), 0);
    checks++;
    const owner = await browser.newContext({ baseURL: base });
    for (const value of f.owner.split("; ")) {
      const i = value.indexOf("=");
      await owner.addCookies([
        {
          name: value.slice(0, i),
          value: value.slice(i + 1),
          url: base,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);
    }
    const editor = await owner.newPage();
    await editor.goto("/quan-ly-phong/" + f.rooms.gallery);
    await editor
      .getByRole("button", { name: "Đặt làm bìa: ảnh 2", exact: true })
      .click();
    assert(
      (
        await editor
          .locator(".photo-grid figure img")
          .first()
          .getAttribute("src")
      ).endsWith(f.images[1].id),
    );
    checks++;
    const [saved] = await Promise.all([
      editor.waitForResponse(
        (r) =>
          r.url().includes("/api/landlord/listings/") &&
          r.request().method() === "PATCH",
      ),
      editor
        .getByRole("button", { name: "Lưu và gửi duyệt lại", exact: true })
        .click(),
    ]);
    assert.equal(saved.status(), 200);
    checks++;
    let r = await fetch(base + "/api/community/posts/" + f.rooms.gallery);
    assert.equal(r.status, 404);
    checks++;
    r = await fetch(base + "/api/listings/" + f.rooms.gallery + "/status", {
      method: "POST",
      headers: { cookie: f.admin, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "verified" }),
    });
    assert.equal(r.status, 200);
    checks++;
    r = await fetch(base + "/api/community/posts/" + f.rooms.gallery);
    const data = await r.json();
    assert.equal(data.data.imageUrl, f.images[1].url);
    checks++;
    assert.equal(data.data.imageUrls[0], f.images[1].url);
    checks++;
    assert.deepEqual(errors, []);
    checks++;
    console.log(
      `PASS: ${checks} photo browser checks; 4:3 feed, portrait/panorama/small/error states, contained detail/viewer, keyboard/Escape/focus/scroll, 320/390/1440px, durable cover selection and re-review; 6 Axe scans with zero violations.`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
