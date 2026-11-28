const fs = require("node:fs");
const path = require("node:path");
const { runDynamicLayoutAudit } = require("./layout-contract.cjs");

async function collectFormControls(page) {
  return page.evaluate(() => {
    const excluded = new Set([
      "checkbox",
      "radio",
      "file",
      "hidden",
      "color",
      "range",
      "button",
      "submit",
      "reset",
      "image",
    ]);
    return Array.from(
      document.querySelectorAll(
        "main input, main select, main textarea, .modal-form input",
      ),
    )
      .filter(
        (control) =>
          !(control instanceof HTMLInputElement && excluded.has(control.type)),
      )
      .map((control) => {
        const rect = control.getBoundingClientRect();
        const css = getComputedStyle(control);
        return {
          field:
            control.id ||
            control.name ||
            control.getAttribute("aria-label") ||
            control.type ||
            control.localName,
          kind: control.localName,
          compact: Boolean(
            control.closest(
              ".user-filters, .chat-report-toolbar",
            ),
          ),
          height: Math.round(rect.height * 10) / 10,
          width: Math.round(rect.width),
          font: parseFloat(css.fontSize),
          paddingInline: [css.paddingInlineStart, css.paddingInlineEnd],
          radius: css.borderTopLeftRadius,
          hidden: !rect.width || !rect.height || css.visibility === "hidden",
        };
      })
      .filter((control) => !control.hidden);
  });
}

async function auditLayout({ contexts, api, stamp, room, post, chat, out }) {
  const visitRoom = await api(
    "owner",
    "/api/listings/create",
    "POST",
    {
      title: "[Kiểm thử] Phòng xem lịch " + stamp,
      summary: "Tin tổng hợp để kiểm thử biểu mẫu đề xuất lịch xem.",
      address: "14 Nguyễn Văn Linh, Hải Châu, Đà Nẵng",
      price: 2500000,
      area: 25,
    },
    201,
  );
  await api(
    "admin",
    "/api/listings/" + visitRoom.externalId + "/status",
    "POST",
    {
      status: "verified",
    },
  );
  const visitChat = await api("student", "/api/chat", "POST", {
    listingId: visitRoom.externalId,
  });
  const pages = [
    [
      "home",
      "/",
      "guest",
      "form[action='/bang-tin'] input|above;form[action='/bang-tin'] button|above",
    ],
    [
      "feed",
      "/bang-tin",
      "guest",
      ".explorer-filters input[type=search]|above;.explorer-filters select[aria-label='Khu vực']|above",
    ],
    ["room", "/bai/" + room.externalId, "student", "text=Nhắn chủ trọ"],
    ["discussion-detail", "/bai/" + post.id, "student", "text=Gửi bình luận"],
    [
      "community",
      "/thao-luan",
      "student",
      "text=Viết thảo luận;.explorer-filters input[type=search]",
    ],
    ["areas", "/khu-vuc", "guest"],
    ["clusters", "/cum", "guest"],
    ["cluster", "/cum/hai-chau", "guest"],
    ["rules", "/quy-dinh", "guest"],
    [
      "login",
      "/dang-nhap",
      "guest",
      ".modal-form input[type=email];.modal-form button[type=submit]",
    ],
    [
      "register",
      "/dang-ky",
      "guest",
      ".modal-form input[type=email];.modal-form button[type=submit]",
    ],
    ["profile", "/profile", "student", "text=Chỉnh sửa hồ sơ"],
    ["my-posts", "/bai-viet-cua-toi", "student"],
    ["notifications", "/thong-bao", "student"],
    ["inbox", "/tin-nhan?hoi-thoai=" + chat.id, "student", "textarea"],
    [
      "visit-form",
      "/tin-nhan?hoi-thoai=" + visitChat.id,
      "student",
      ".visit-request summary",
    ],
    ["appointments", "/lich-xem-phong", "student"],
    ["create-room", "/dang-phong", "owner", "text=Gửi tin chờ duyệt"],
    ["manage-rooms", "/quan-ly-phong", "owner"],
    ["manage-room", "/quan-ly-phong/" + room.externalId, "owner"],
    ["admin", "/admin", "admin", ".admin-topbar button.secondary-btn"],
    [
      "admin-listings",
      "/admin?tab=listings",
      "admin",
      "input[aria-label='Tìm bài đăng quản trị'];text=Tải lại",
    ],
    ["admin-reports", "/admin?tab=reports", "admin"],
    ["admin-landlords", "/admin/chu-tro", "admin"],
    ["admin-users", "/admin/nguoi-dung", "admin"],
    ["admin-settings", "/admin/cau-hinh", "admin", "text=Lưu cấu hình"],
    ["admin-chat", "/admin/tin-nhan", "admin"],
    ["404", "/ui-layout-missing-page", "guest"],
  ];
  const report = { pages: [] };
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [768, 1024],
    [1366, 768],
    [1920, 1080],
  ]) {
    for (const [name, url, role, actions = ""] of pages) {
      const page = await contexts[role].newPage();
      await page.setViewportSize({ width, height });
      const errors = new Set();
      page.on("pageerror", (e) => errors.add("JS " + e.name));
      page.on("response", (r) => {
        if (
          r.status() >= 500 ||
          (r.status() === 404 &&
            ["image", "font", "stylesheet", "script"].includes(
              r.request().resourceType(),
            ))
        )
          errors.add(r.status() + " " + new URL(r.url()).pathname);
      });
      page.on("requestfailed", (r) => {
        if (!r.failure()?.errorText.includes("ABORTED"))
          errors.add(r.resourceType() + " " + r.failure()?.errorText);
      });
      const issues = [];
      let controls = [];
      try {
        const res = await page.goto(url, { waitUntil: "domcontentloaded" });
        await page.locator("main").waitFor();
        if (["login", "register"].includes(name))
          await page.locator(".modal-form").waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page
          .waitForLoadState("networkidle", { timeout: 1800 })
          .catch(() => {});
        if (res.status() !== (name === "404" ? 404 : 200))
          issues.push("HTTP " + res.status());
        const layout = await page.evaluate(() => ({
          viewport: document.querySelector("meta[name=viewport]")?.content,
          overflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
          offenders: [...document.querySelectorAll("main *")]
            .filter((el) => {
              const r = el.getBoundingClientRect(),
                p = el.closest('[class*="scroll"],[class*="table-wrap"]');
              return (
                r.width &&
                r.right > innerWidth + 2 &&
                !p &&
                getComputedStyle(el).position !== "absolute"
              );
            })
            .slice(0, 8)
            .map(
              (el) =>
                el.tagName + "." + String(el.className).replace(/\s+/g, "."),
            ),
        }));
        if (
          !/width=device-width/.test(layout.viewport) ||
          !/initial-scale=1/.test(layout.viewport)
        )
          issues.push("viewport");
        if (layout.overflow > 1)
          issues.push(
            "overflow " + layout.overflow + "px " + layout.offenders.join(", "),
          );
        for (const spec of actions.split(";").filter(Boolean)) {
          const [selector, location] = spec.split("|");
          const target = page.locator(selector).first();
          if (!(await target.isVisible().catch(() => false))) {
            issues.push("missing/hidden " + selector);
            continue;
          }
          if (location === "above") {
            const box = await target.boundingBox();
            if (box.y < 0 || box.y + box.height > height)
              issues.push("below fold " + selector + " y=" + Math.round(box.y));
          }
          const clickable = await target
            .click({ trial: true, timeout: 1200 })
            .then(
              () => true,
              () => false,
            );
          if (!clickable) issues.push("blocked " + selector);
          await page.evaluate(() => scrollTo(0, 0));
        }
        if (name === "visit-form") {
          await page.locator(".visit-request summary").click();
          await page
            .locator(".visit-request input[type=datetime-local]")
            .waitFor();
          await page
            .getByRole("button", { name: "Gửi đề xuất lịch" })
            .click({ trial: true });
        }
        controls = await collectFormControls(page);
        if (process.env.TEST_FORM_MEASURE_ONLY !== "1") {
          for (const field of controls) {
            const height = width >= 768 && field.compact ? 36 : 40;
            if (
              field.kind === "textarea"
                ? field.height < 88
                : field.height !== height
            )
              issues.push(`control height ${field.field}: ${field.height}px`);
            if (field.font !== (width < 768 ? 16 : 14))
              issues.push(`control font ${field.field}: ${field.font}px`);
          }
        }
        if (
          role !== "admin" &&
          width <= 768 &&
          !["login", "register", "404"].includes(name)
        ) {
          const menu = page.locator(".mobile-menu-btn");
          if (await menu.isVisible()) {
            const glyph = await menu
              .locator("svg")
              .isVisible();
            if (!glyph)
              issues.push("invisible mobile menu icon");
            await menu.click();
            const nav = page.locator("#mobile-navigation");
            const findRooms = nav.getByRole("link", { name: /Tìm phòng/ });
            try {
              await findRooms.click({ trial: true, timeout: 1500 });
            } catch {
              issues.push("mobile room link unavailable");
            }
            if (name === "home") {
              await page.screenshot({
                path: path.join(out, "home-" + width + "-menu.png"),
                animations: "disabled",
              });
            }
            await page.keyboard.press("Escape");
            await nav.waitFor({ state: "detached" });
          } else issues.push("missing user mobile toggle");
        }
        if (role === "admin" && width <= 768) {
          const toggle = page.locator(".admin-menu-toggle");
          if (await toggle.isVisible()) {
            await toggle.click();
            const nav = page.locator("#admin-mobile-navigation");
            if (
              !(await nav.isVisible()) ||
              (await nav.locator("a").count()) < 7
            )
              issues.push("admin menu incomplete");
            await page.screenshot({
              path: path.join(out, name + "-" + width + "-menu.png"),
              animations: "disabled",
            });
            await page.keyboard.press("Escape");
            if (await nav.isVisible())
              issues.push("admin menu did not close on Escape");
          } else issues.push("missing admin mobile toggle");
        }
        await page.screenshot({
          path: path.join(out, name + "-" + width + ".png"),
          animations: "disabled",
          fullPage: [
            "visit-form",
            "appointments",
            "admin-listings",
            "manage-rooms",
            "room",
          ].includes(name),
        });
        if (name === "home" && issues.length === 0) {
          const search = page.getByRole("search", { name: "" });
          await search.getByRole("searchbox").fill(room.title);
          await search.getByRole("button", { name: "Tìm phòng" }).click();
          await page.waitForURL(
            (url) =>
              url.pathname === "/bang-tin" &&
              url.searchParams.get("q") === room.title,
          );
          const query = await page.getByRole("searchbox").inputValue();
          if (query !== room.title)
            issues.push("home search query did not reach the feed");
        }
      } catch (error) {
        issues.push(error.message.split("\n")[0]);
      }
      report.pages.push({
        name,
        width,
        height,
        role,
        controls,
        issues: [...issues, ...errors],
      });
      await page.close();
    }
    report.pages.push(
      ...(await runDynamicLayoutAudit({
        contexts,
        api,
        width,
        height,
        out,
      })),
    );
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify(report.pages, null, 2),
    );
    console.log("Layout audit completed at " + width + "px");
  }
  const failures = report.pages.filter((page) => page.issues.length);
  if (failures.length)
    throw new Error(
      failures.length + " responsive layout cases failed. See results.json.",
    );
}

module.exports = { auditLayout };
