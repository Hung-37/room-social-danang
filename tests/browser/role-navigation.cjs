// Role-specific navigation checks. All API reads are mocked in memory.
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const assert = require('node:assert/strict');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3012';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));

async function main() {
  const browser = await chromium.launch({ channel: 'msedge' });
  const results = [];
  try {
    for (const role of ['student', 'landlord', 'admin']) {
      const context = await browser.newContext({ baseURL: base, serviceWorkers: 'block' });
      await context.route('**/api/**', async route => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === '/api/auth/me') return route.fulfill({ json: { data: { id: `role-${role}`, name: 'Tài khoản kiểm thử', role } } });
        if (path === '/api/site/settings') return route.fulfill({ json: { data: { siteName: 'RoomĐàNẵng' } } });
        if (path === '/api/notifications') return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } });
        if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
        return route.fulfill({ json: { data: [], meta: {} } });
      });

      const page = await context.newPage();
      page.on('pageerror', error => { throw error; });
      for (const width of [390, 1024]) {
        await page.setViewportSize({ width, height: 844 });
        await page.goto('/thao-luan', { waitUntil: 'networkidle' });
        const roleLinks = role === 'admin' ? [['Quản trị', '/admin']] : role === 'landlord' ? [['Quản lý phòng', '/quan-ly-phong']] : [];
        const forbidden = role === 'admin' ? 'Quản lý phòng' : 'Quản trị';
        if (width < 1024) {
          await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
          const menu = page.locator('#mobile-navigation');
          for (const [label, href] of roleLinks) {
            const link = menu.getByRole('link', { name: label, exact: true });
            assert.equal(await link.getAttribute('href'), href, `${role} mobile link`);
          }
          assert.equal(await menu.getByRole('link', { name: forbidden, exact: true }).count(), 0, `${role} must not get another role's link`);
          const axe = await new AxeBuilder({ page }).include('dialog.site-header-drawer').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          assert.equal(axe.violations.length, 0, `${role} mobile menu axe: ${axe.violations.map(v => v.id).join(', ')}`);
        } else {
          await page.getByRole('button', { name: 'Tài khoản của Tài khoản kiểm thử', exact: true }).click();
          const menu = page.locator('#profile-navigation');
          for (const [label, href] of roleLinks) {
            const link = menu.getByRole('link', { name: label, exact: true });
            assert.equal(await link.getAttribute('href'), href, `${role} desktop link`);
          }
          assert.equal(await menu.getByRole('link', { name: forbidden, exact: true }).count(), 0, `${role} must not get another role's link`);
          const axe = await new AxeBuilder({ page }).include('#profile-navigation').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
          assert.equal(axe.violations.length, 0, `${role} desktop menu axe: ${axe.violations.map(v => v.id).join(', ')}`);
        }
        results.push({ role, width, expectedRoleLinks: roleLinks.map(([label]) => label) });
      }
      await context.close();
    }
    console.log(JSON.stringify({ checks: results, axeScans: 6, wrongRoleLinksVisible: false }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
