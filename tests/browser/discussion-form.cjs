// Discussion form layout and role checks. Every API response is mocked in memory.
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const assert = require('node:assert/strict');

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3011';
assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
const widths = [320, 375, 390, 430, 768, 1024, 1440];

async function runRole(browser, role) {
  const context = await browser.newContext({ baseURL: base, serviceWorkers: 'block' });
  const submissions = [];
  await context.route('**/api/**', async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({ json: { data: { id: `ui-${role}`, name: 'Tài khoản kiểm thử', role } } });
    }
    if (path === '/api/site/settings') return route.fulfill({ json: { data: { siteName: 'RoomĐàNẵng' } } });
    if (path === '/api/notifications') return route.fulfill({ json: { data: [], meta: { unreadCount: 0 } } });
    if (path === '/api/favorites') return route.fulfill({ json: { data: [] } });
    if (path === '/api/community/posts' && request.method() === 'POST') {
      submissions.push(JSON.parse(request.postData() || '{}'));
      return route.fulfill({ json: { data: { id: `post-${submissions.length}` } } });
    }
    if (!['GET', 'HEAD'].includes(request.method())) return route.abort();
    return route.fulfill({ json: { data: [], meta: { count: 0, hasMore: false, nextOffset: 0 } } });
  });

  const page = await context.newPage();
  page.on('pageerror', error => { throw error; });
  const measurements = [];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/thao-luan', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Tài khoản của Tài khoản kiểm thử', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Viết thảo luận', exact: true }).click();
    const panel = page.locator('#viet-bai');
    await panel.waitFor();
    assert.equal(await panel.getByRole('heading', { name: 'Viết thảo luận', exact: true }).count(), 1);
    assert.equal(await panel.getByText('Gửi một câu hỏi, chia sẻ một trải nghiệm', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Viết thảo luận', exact: true }).isVisible(), false);
    const boxes = await panel.locator('.discussion-form > label, .discussion-form .form-row > label').evaluateAll(labels =>
      labels.map(label => {
        const control = label.querySelector('input,textarea,select');
        const labelBox = label.getBoundingClientRect();
        const controlBox = control.getBoundingClientRect();
        return { x: labelBox.x, y: labelBox.y, width: labelBox.width, right: labelBox.right, controlWidth: controlBox.width, controlRight: controlBox.right };
      })
    );
    assert.equal(boxes.length, 4);
    assert(boxes.every(box => box.width > 150 && box.controlWidth > 140 && box.controlRight <= box.right + 1), JSON.stringify({ width, boxes }));
    const [topic, area] = boxes.slice(2);
    assert.equal(Math.abs(topic.y - area.y) < 2, width > 650, `topic/area layout at ${width}px`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `page overflow at ${width}px`);
    measurements.push({ width, topicColumns: width > 650 ? 2 : 1, overflow: false });
    if ([320, 768, 1440].includes(width)) {
      const axe = await new AxeBuilder({ page }).include('#viet-bai').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      assert.equal(axe.violations.length, 0, `axe at ${width}px: ${axe.violations.map(v => v.id).join(', ')}`);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/thao-luan', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Viết thảo luận', exact: true }).click();
  await page.getByLabel('Tiêu đề').fill('Cần hỏi gì trước khi đặt cọc?');
  await page.getByLabel('Nội dung').fill('Tôi muốn kiểm tra giấy tờ và điều khoản trước khi đặt cọc phòng.');
  await page.getByRole('button', { name: 'Gửi bài chờ duyệt', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Đã gửi bài.' }).waitFor();
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].title, 'Cần hỏi gì trước khi đặt cọc?');
  assert.equal(submissions[0].summary, 'Tôi muốn kiểm tra giấy tờ và điều khoản trước khi đặt cọc phòng.');
  await context.close();
  return measurements;
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const roles = {};
    for (const role of ['student', 'landlord']) roles[role] = await runRole(browser, role);
    console.log(JSON.stringify({ roles, widths, accessibilityWidths: [320, 768, 1440], mockSubmissionsPerRole: 1 }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
