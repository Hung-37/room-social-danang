// Focused local accessibility regression check for RoomPhotoGallery.
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3033';
assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const output = process.env.ROOM_PHOTO_AUDIT_OUTPUT || 'work/room-photo-a11y';
const title = '[UI mẫu] Phòng gần biển Sơn Trà';
const room = {
  id: 'ui-room', externalId: 'ui-room', contentKind: 'listing', title,
  summary: 'Fixture trong bộ nhớ để kiểm tra nhãn gallery.',
  clusterId: 'son-tra', clusterName: 'Sơn Trà', address: 'Sơn Trà, Đà Nẵng',
  price: 2500000, area: 25, verificationStatus: 'verified', status: 'Đã duyệt',
  comments: 0, tags: [], sourceName: 'Fixture', sourceUrl: 'https://example.com/room',
  updatedAt: '2026-11-15T03:00:00Z', updated: '15/11/2026',
  imageUrl: '/api/images/ui-audit-photo', imageUrls: [],
};

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : { channel: 'msedge' });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/api/**', async route => {
      if (!['GET', 'HEAD'].includes(route.request().method())) return route.abort();
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/community/posts/ui-room') {
        return route.fulfill({ json: { data: { ...room, price: '2.500.000đ/tháng', area: '25m²' }, meta: {} } });
      }
      if (path === '/api/auth/me' || path === '/api/favorites') {
        return route.fulfill({ status: 401, json: { error: 'Chưa đăng nhập' } });
      }
      if (path === '/api/site/settings') return route.fulfill({ json: { data: { siteName: 'RoomĐàNẵng' } } });
      if (path === '/api/images/ui-audit-photo') return route.fulfill({ status: 503, body: 'fixture image unavailable' });
      return route.fulfill({ json: { data: [], meta: {} } });
    });
    const page = await context.newPage();
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto(new URL('/bai/ui-room', base).toString(), { waitUntil: 'networkidle' });
    await page.getByRole('heading', { name: title, exact: true }).waitFor();
    await page.locator('.photo-open .room-photo-empty').waitFor({ state: 'visible' });
    const cover = page.locator('.detail-cover.photo-open');
    const accessibleName = page.getByRole('button', { name: /Xem ảnh đầy đủ[\s\S]*1\s*\/\s*1/ });
    assert.equal(await accessibleName.count(), 1);
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    const violations = axe.violations.map(rule => ({ id: rule.id, impact: rule.impact, targets: rule.nodes.map(node => node.target) }));
    assert(!violations.some(rule => rule.id === 'label-content-name-mismatch'), JSON.stringify(violations));
    await page.screenshot({ path: `${output}/detail-375.png`, fullPage: true });
    await cover.click();
    assert(await page.locator('dialog.photo-dialog[open]').isVisible());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('dialog.photo-dialog[open]').count(), 0);
    console.log(JSON.stringify({ viewport: '375x844', imageState: 'fallback', accessibleNameIncludesVisibleActionAndCounter: true, axeViolations: violations.length, opensAndCloses: true }, null, 2));
    await context.close();
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
