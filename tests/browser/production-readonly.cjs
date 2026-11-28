// Read-only production UI audit. All non-GET/HEAD browser requests are aborted.
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const base = process.env.PROD_BASE_URL || "https://fantastic-rebirth-production-9b02da1f.up.railway.app/";
const allowedOrigin = "https://fantastic-rebirth-production-9b02da1f.up.railway.app";
assert.equal(new URL(base).origin, allowedOrigin, "This audit only permits the approved production origin.");
const output = path.resolve(process.env.PROD_AUDIT_OUTPUT || "work/production-audit");
const widths = [320, 375, 430, 768, 1024, 1280, 1440];
const appRoot = path.resolve("app");

function getPages(dir = appRoot) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "api") results.push(...getPages(full));
    } else if (entry.name === "page.tsx") {
      const relative = path.relative(appRoot, dir);
      const segments = relative ? relative.split(path.sep) : [];
      const template = "/" + segments.join("/");
      results.push({ template: template === "/" ? "/" : template, dynamic: segments.some(s => s.startsWith("[")) });
    }
  }
  return results.sort((a, b) => a.template.localeCompare(b.template));
}

function slug(value) {
  return value.replace(/^\/+|\/+$/g, "").replace(/\//g, "--").replace(/[^a-z0-9-]/gi, "_") || "home";
}

function roleFor(route) {
  if (route.startsWith("/admin")) return "Admin";
  if (["/profile", "/dang-phong", "/quan-ly-phong", "/tin-nhan", "/thong-bao", "/lich-xem-phong", "/bai-viet-cua-toi"].some(p => route === p || route.startsWith(p + "/"))) return "Đăng nhập";
  return "Khách";
}

async function visibleLinks(page, prefix) {
  return page.locator(`a[href^="${prefix}"]`).evaluateAll(links => links.map(link => new URL(link.href).pathname).filter(Boolean));
}

async function discoverDynamic(page, sources, prefix, template) {
  const found = new Set();
  for (const source of sources) {
    await page.goto(source, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => null);
    await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => null);
    await page.waitForFunction(() => !/(Đang tải|Đang tìm|Đang mở phòng)/.test(document.querySelector("main")?.innerText || ""), null, { timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(250);
    for (const href of await visibleLinks(page, prefix).catch(() => [])) found.add(href);
  }
  return [...found].slice(0, 2).map(route => ({ route, template, role: roleFor(route), discoveredFromPublicLink: true }));
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const pageFiles = getPages();
  const staticRoutes = pageFiles.filter(route => !route.dynamic).map(route => ({ route: route.template, template: route.template, role: roleFor(route.template) }));
  const dynamicTemplates = pageFiles.filter(route => route.dynamic);
  const report = { base: allowedOrigin, startedAt: new Date().toISOString(), widths, pageTemplates: pageFiles, staticRoutes: [], dynamicRoutes: [], pages: [], consoleErrors: [], pageErrors: [], failedRequests: [], responseFailures: [], blockedWrites: 0, menuChecks: [] };
  const requestStart = Date.now();
  const initialResponse = await fetch(base, { redirect: "manual", signal: AbortSignal.timeout(15000) });
  report.productionRoot = { status: initialResponse.status, elapsedMs: Date.now() - requestStart, redirect: initialResponse.headers.get("location") };

  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: "msedge" });
  try {
    const context = await browser.newContext({ baseURL: base, serviceWorkers: "block", reducedMotion: "reduce" });
    await context.route("**/*", async route => {
      const method = route.request().method();
      if (!(["GET", "HEAD"].includes(method))) {
        report.blockedWrites++;
        return route.abort();
      }
      return route.continue();
    });

    const discoverPage = await context.newPage();
    report.dynamicRoutes.push(...await discoverDynamic(discoverPage, ["/bang-tin", "/thao-luan"], "/bai/", "/bai/[id]"));
    report.dynamicRoutes.push(...await discoverDynamic(discoverPage, ["/cum", "/khu-vuc"], "/cum/", "/cum/[id]"));
    await discoverPage.close();

    const concreteRoutes = [...staticRoutes, ...report.dynamicRoutes];
    report.staticRoutes = staticRoutes;
    for (const width of widths) {
      for (const entry of concreteRoutes) {
        const page = await context.newPage();
        const routeErrors = [];
        page.on("console", message => { if (message.type() === "error") { const item = { route: entry.route, width, message: message.text().slice(0, 240) }; report.consoleErrors.push(item); routeErrors.push(item); } });
        page.on("pageerror", error => report.pageErrors.push({ route: entry.route, width, message: error.message }));
        page.on("requestfailed", request => report.failedRequests.push({ route: entry.route, width, path: new URL(request.url()).pathname, reason: request.failure()?.errorText || "failed" }));
        page.on("response", response => { if (response.status() >= 400) report.responseFailures.push({ route: entry.route, width, path: new URL(response.url()).pathname, status: response.status() }); });
        await page.setViewportSize({ width, height: 900 });
        const startedAt = Date.now();
        let response = null;
        let navigationError = null;
        try {
          response = await page.goto(entry.route, { waitUntil: "domcontentloaded", timeout: 30000 });
          await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => null);
          await page.waitForFunction(() => !/(Đang tải|Đang tìm|Đang mở phòng)/.test(document.querySelector("main")?.innerText || ""), null, { timeout: 5000 }).catch(() => null);
          await page.waitForTimeout(250);
        } catch (error) {
          navigationError = error.message;
        }
        const layout = await page.evaluate(() => {
          const rect = element => { const r = element.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; };
          const header = document.querySelector("header");
          const main = document.querySelector("main");
          const visible = element => { const s = getComputedStyle(element), r = element.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0 && r.width > 0 && r.height > 0; };
          const controls = [...document.querySelectorAll("button,a,input,select,textarea")].filter(visible);
          const clippedTextCandidates = [...document.querySelectorAll("main *")].filter(element => {
            if (!visible(element) || element.children.length || !element.textContent?.trim()) return false;
            const style = getComputedStyle(element);
            return (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2) && (style.overflow === "hidden" || style.overflowX === "hidden" || style.overflowY === "hidden" || style.whiteSpace === "nowrap");
          }).slice(0, 12).map(element => ({ selector: element.tagName.toLowerCase() + (element.className && typeof element.className === "string" ? "." + element.className.trim().replace(/\s+/g, ".") : ""), text: element.textContent.trim().slice(0, 80) }));
          const controlOverlaps = [];
          for (let i = 0; i < controls.length; i++) for (let j = i + 1; j < controls.length; j++) {
            const a = controls[i], b = controls[j];
            if (a.contains(b) || b.contains(a)) continue;
            const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
            const overlapX = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
            const overlapY = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
            if (overlapX > 2 && overlapY > 2) controlOverlaps.push([a.tagName.toLowerCase(), b.tagName.toLowerCase()]);
            if (controlOverlaps.length >= 12) break;
          }
          return { viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1, header: header ? rect(header) : null, main: main ? rect(main) : null, title: document.title, heading: document.querySelector("h1")?.innerText || null, visibleControls: controls.length, clippedTextCandidates, controlOverlaps };
        }).catch(() => ({ viewport: width, overflow: null }));
        const finalUrl = new URL(page.url());
        const record = { route: entry.route, template: entry.template, role: entry.role, width, status: response?.status() ?? null, elapsedMs: Date.now() - startedAt, finalPath: finalUrl.pathname + finalUrl.search, redirected: finalUrl.pathname !== entry.route, navigationError, layout, screenshot: path.relative(process.cwd(), path.join(output, `${slug(entry.route)}--${width}.png`)), consoleErrors: routeErrors.length };
        await page.screenshot({ path: path.join(output, `${slug(entry.route)}--${width}.png`), fullPage: true }).catch(error => { record.screenshotError = error.message; });
        if (width === 375 && !navigationError && layout.main) {
          try {
            const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
            record.axeViolations = axe.violations.map(v => ({ id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target) }));
          } catch (error) { record.axeError = error.message; }
        }
        report.pages.push(record);

        if (entry.route === "/" && width <= 1024 && record.status === 200) {
          const toggle = page.getByRole("button", { name: "Mở menu", exact: true });
          if (await toggle.isVisible().catch(() => false)) {
            await toggle.click();
            const nav = page.locator("#mobile-navigation");
            const open = await nav.isVisible().catch(() => false);
            const bounds = await nav.boundingBox().catch(() => null);
            report.menuChecks.push({ width, open, bounds });
            await page.screenshot({ path: path.join(output, `home-menu-open--${width}.png`), fullPage: true }).catch(() => null);
            await page.getByRole("button", { name: "Đóng menu", exact: true }).click().catch(() => null);
          } else report.menuChecks.push({ width, open: null, note: "mobile menu toggle not visible" });
        }
        await page.close();
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
  report.completedAt = new Date().toISOString();
  fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  const overflows = report.pages.filter(page => page.layout.overflow).length;
  const axeViolations = report.pages.reduce((sum, page) => sum + (page.axeViolations?.length || 0), 0);
  console.log(JSON.stringify({ root: report.productionRoot, pageTemplates: pageFiles.length, staticRoutes: staticRoutes.length, dynamicRoutesDiscovered: report.dynamicRoutes.length, viewportVisits: report.pages.length, overflows, axeViolations, consoleErrors: report.consoleErrors.length, pageErrors: report.pageErrors.length, failedRequests: report.failedRequests.length, responseFailures: report.responseFailures.length, blockedWrites: report.blockedWrites, report: path.join(output, "report.json") }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
