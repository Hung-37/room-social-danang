// UI-only pagination checks. API responses and records exist in the browser test only.
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3033';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const output = process.env.PAGINATION_AUDIT_OUTPUT || 'work/pagination-audit';
const title = '[UI mẫu] Phòng kiểm thử phân trang';
const record = {
  id: 'pagination-fixture', externalId: 'pagination-fixture', contentKind: 'listing',
  title, summary: 'Dữ liệu chỉ tồn tại trong fixture trình duyệt.',
  clusterId: 'hoa-cuong', clusterName: 'Hòa Cường', address: 'Hòa Cường, Đà Nẵng',
  price: 2500000, area: 25, verificationStatus: 'verified', status: 'Đã duyệt',
  comments: 0, tags: [], sourceName: 'Fixture', sourceUrl: 'https://example.com/room',
  updatedAt: '2026-11-15T03:00:00Z', updated: '15/11/2026', imageUrls: [],
};

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : { channel: 'msedge' });
  const widths = [320, 375, 430, 768, 1024, 1280, 1440];
  let total = 1;
  const requests = [];
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/api/**', async route => {
      const request = route.request();
      if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
      const url = new URL(request.url());
      if (url.pathname === '/api/auth/me' || url.pathname === '/api/favorites') {
        return route.fulfill({ status: 401, json: { error: 'Chưa đăng nhập' } });
      }
      if (url.pathname === '/api/site/settings') {
        return route.fulfill({ json: { data: { siteName: 'RoomĐàNẵng' } } });
      }
      if (url.pathname === '/api/listings') {
        const offset = Number(url.searchParams.get('offset') || 0);
        requests.push({ q: url.searchParams.get('q'), cluster: url.searchParams.get('cluster'), offset });
        const count = Math.max(0, Math.min(10, total - offset));
        return route.fulfill({
          json: {
            data: Array.from({ length: count }, (_, index) => ({
              ...record, id: `${offset}-${index}`, externalId: `${offset}-${index}`,
            })),
            meta: { count: total, hasMore: offset + count < total, nextOffset: offset + count },
          },
        });
      }
      return route.fulfill({ json: { data: [], meta: {} } });
    });

    const page = await context.newPage();
    page.on('pageerror', error => { throw error; });
    const results = [];
    for (const width of widths) {
      await page.setViewportSize({ width, height: 900 });
      for (const pageCount of [1, 2, 10]) {
        total = pageCount * 10 - (pageCount === 1 ? 9 : 0);
        await page.goto(new URL('/bang-tin?q=Hai%20Chau&cluster=hoa-cuong', base).toString(), { waitUntil: 'networkidle' });
        const nav = page.getByRole('navigation', { name: 'Phân trang phòng trọ cuối danh sách', exact: true });
        await nav.waitFor();
        await nav.scrollIntoViewIfNeeded();
        const current = nav.locator('button[aria-current="page"]');
        assert.equal(await current.count(), 1, `current page at ${width}px / ${pageCount} pages`);
        assert.equal(await current.innerText(), '1');
        assert(await nav.getByRole('button', { name: 'Trang trước', exact: true }).isDisabled());
        assert.equal(await nav.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled(), pageCount === 1);

        const bounds = await nav.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, width: r.width, scrollWidth: el.scrollWidth };
        });
        assert(bounds.left >= -1 && bounds.right <= width + 1, `pagination outside viewport at ${width}px`);
        assert(bounds.scrollWidth <= bounds.width + 1, `pagination content overflows at ${width}px`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);

        if (pageCount > 1) {
          await nav.getByRole('button', { name: 'Trang sau', exact: true }).click();
          await nav.locator('button[aria-current="page"]').waitFor();
          assert.equal(await nav.locator('button[aria-current="page"]').innerText(), '2');
          const lastRequest = requests.at(-1);
          assert.deepEqual(lastRequest, { q: 'Hai Chau', cluster: 'hoa-cuong', offset: 10 });
          assert(await nav.getByRole('button', { name: 'Trang trước', exact: true }).isEnabled());
          if (pageCount === 2) {
            assert(await nav.getByRole('button', { name: 'Trang sau', exact: true }).isDisabled());
          }
          if (pageCount === 10) {
            for (let pageNumber = 3; pageNumber <= 5; pageNumber++) {
              await nav.getByRole('button', { name: 'Trang sau', exact: true }).click();
              await nav.locator('button[aria-current="page"]').filter({ hasText: String(pageNumber) }).waitFor();
            }
            assert.equal(await nav.locator('button[aria-current="page"]').innerText(), '5');
            if (width <= 430) {
              const visibleNumbers = await nav.locator('.management-page-item:visible > button').allTextContents();
              assert.deepEqual(visibleNumbers, ['1', '5', '10']);
            }
          }
        }

        if ([320, 768, 1440].includes(width)) {
          const scan = await new AxeBuilder({ page }).include('.management-pagination').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          assert.equal(scan.violations.length, 0, `pagination axe violations at ${width}px: ${scan.violations.map(v => v.id).join(', ')}`);
        }
        if (width === 375 && pageCount === 10) {
          await page.screenshot({ path: `${output}/many-pages-mobile-375.png`, fullPage: true });
        }
        if (width === 1280 && pageCount === 10) {
          await page.screenshot({ path: `${output}/many-pages-desktop-1280.png`, fullPage: true });
        }
        results.push({ width, pages: pageCount, current: pageCount > 1 ? pageCount === 10 ? 5 : 2 : 1, overflow: false });
      }
    }
    await page.goto(new URL('/quy-dinh', base).toString(), { waitUntil: 'networkidle' });
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).pathname, '/bang-tin');
    assert.equal(new URL(page.url()).searchParams.get('q'), 'Hai Chau');
    assert.equal(new URL(page.url()).searchParams.get('cluster'), 'hoa-cuong');
    await page.getByRole('navigation', { name: 'Phân trang phòng trọ cuối danh sách', exact: true }).waitFor();
    console.log(JSON.stringify({ widths, scenarios: results.length, axeWidths: [320, 768, 1440], queryAndFilterPreserved: true, results }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
