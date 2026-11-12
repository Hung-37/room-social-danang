// Uses cookies from test:viewings; never run against production.
const { createRequire } = require('node:module');
const path = require('node:path');
const req = createRequire(path.join(__dirname, '../../package.json'));
const { chromium } = req('playwright');
const { default: AxeBuilder } = req('@axe-core/playwright');
const fs = require('node:fs'),
  assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL,
  file = process.env.TEST_VIEWING_FIXTURES;
if (!base || !file) throw new Error('Set TEST_BASE_URL and TEST_VIEWING_FIXTURES.');
const out = process.env.TEST_SCREENSHOT_DIR || path.join(__dirname, '../../work/viewing-ui');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const f = JSON.parse(fs.readFileSync(file));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--no-sandbox']
  });
  const local = new URL(base).protocol === 'http:';
  if (local) assert(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
  async function context(cookie) {
    const ctx = await browser.newContext({ baseURL: base });
    ctx.setDefaultTimeout(15000);
    ctx.setDefaultNavigationTimeout(20000);
    for (const part of cookie.split('; ')) {
      const i = part.indexOf('=');
      await ctx.addCookies([
        {
          name: part.slice(0, i),
          value: part.slice(i + 1),
          url: base,
          httpOnly: true,
          secure: !local,
          sameSite: 'Lax'
        }
      ]);
    }
    return ctx;
  }
  const buyer = await context(f.buyer),
    owner = await context(f.owner),
    outsider = await context(f.outsider);
  const p = await buyer.newPage(),
    s = await owner.newPage(),
    x = await outsider.newPage();
  const errors = [];
  for (const page of [p, s, x]) page.on('pageerror', (e) => errors.push(e.message));
  let checks = 0;
  const prior = await (await owner.request.get('/api/appointments?conversation=' + f.chat)).json();
  for (const item of prior.data || []) {
    if (['requested', 'confirmed'].includes(item.status)) {
      const r = await owner.request.patch('/api/appointments/' + item.id, {
        data: { action: 'cancel', version: item.version }
      });
      assert(r.ok());
    }
  }
  await p.goto('/tin-nhan?hoi-thoai=' + f.chat);
  await p.getByLabel('Tin nhắn riêng', { exact: true }).waitFor();
  await p.getByText('Đề xuất giờ xem phòng', { exact: true }).click();
  const future = new Date(Date.now() + 3 * 86400000);
  future.setUTCSeconds(0, 0);
  const vn = new Date(future.getTime() + 7 * 3600000).toISOString().slice(0, 16);
  await p.getByLabel('Ngày giờ xem phòng (giờ Việt Nam)', { exact: true }).fill(vn);
  await p.getByLabel('Ghi chú cho chủ trọ', { exact: true }).fill('Mình đến cùng một người bạn.');
  await p.getByRole('button', { name: 'Gửi đề xuất lịch', exact: true }).click();
  await p
    .getByText('Đã gửi đề xuất. Lịch chỉ được chốt khi chủ trọ xác nhận.', { exact: true })
    .waitFor();
  checks++;
  await s.goto('/tin-nhan?hoi-thoai=' + f.chat);
  const panel = s.getByRole('region', { name: 'Lịch xem phòng', exact: true });
  await panel.getByRole('button', { name: 'Xác nhận lịch', exact: true }).click();
  await s
    .getByRole('region', { name: 'Xác nhận cập nhật lịch', exact: true })
    .getByRole('button', { name: 'Đồng ý cập nhật', exact: true })
    .click();
  await panel.getByText('Đã xác nhận', { exact: true }).waitFor();
  checks++;
  await p.bringToFront();
  await p
    .getByRole('region', { name: 'Lịch xem phòng', exact: true })
    .getByText('Đã xác nhận', { exact: true })
    .waitFor({ timeout: 15000 });
  checks++;
  // Polling must keep exactly one search panel and one calendar. Duplicate React keys used to append panels every five seconds.
  await p.waitForTimeout(11000);
  assert.equal(await p.locator('.message-search').count(), 1);
  assert.equal(await p.getByRole('region', { name: 'Lịch xem phòng', exact: true }).count(), 1);
  checks += 2;
  await p.getByText('Tìm trong tin nhắn', { exact: true }).click();
  await p.getByLabel('Từ khóa tin nhắn', { exact: true }).fill('100%');
  await p
    .locator('.message-results')
    .getByText('Tiền điện 100% rõ ràng, có hợp đồng.', { exact: true })
    .waitFor();
  checks++;
  const log = p.getByRole('log', { name: 'Lịch sử tin nhắn', exact: true });
  await log.focus();
  await log.evaluate((el) => {
    el.scrollTop = 0;
  });
  await log.press('PageDown');
  await p.waitForTimeout(300);
  assert(await log.evaluate((el) => el.scrollTop > 0));
  checks++;
  await p.getByLabel('Từ khóa tin nhắn', { exact: true }).fill('Từ khóa lịch hẹn');
  await p.locator('.message-results').getByText('Từ khóa lịch hẹn 74', { exact: true }).waitFor();
  const results = p.getByRole('region', { name: 'Kết quả tìm tin nhắn', exact: true });
  await results.focus();
  await results.press('PageDown');
  await p.waitForTimeout(300);
  assert(await results.evaluate((el) => el.scrollTop > 0));
  checks++;
  await p.getByLabel('Tìm hội thoại', { exact: true }).fill('Phòng tìm sâu bí mật');
  await p.getByRole('button', { name: /Phòng tìm sâu bí mật/ }).waitFor();
  assert.equal(await p.locator('.chat-preview').count(), 1);
  checks++;
  await p.getByLabel('Tìm hội thoại', { exact: true }).fill('');
  await p.getByLabel('Lọc hội thoại', { exact: true }).selectOption('blocked');
  await p.getByText('Không có hội thoại phù hợp.', { exact: false }).waitFor();
  checks++;
  await p.getByLabel('Lọc hội thoại', { exact: true }).selectOption('all');
  await p.getByLabel('Tìm hội thoại', { exact: true }).fill('Phòng thử lịch hướng Đông');
  await p.getByRole('button', { name: /Phòng thử lịch hướng Đông/ }).waitFor();
  checks++;
  const scans = [];
  for (const width of [1440, 390]) {
    for (const [page, url, label] of [
      [p, '/tin-nhan?hoi-thoai=' + f.chat, 'inbox'],
      [s, '/lich-xem-phong', 'owner-calendar'],
      [p, '/lich-xem-phong', 'buyer-calendar']
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await page.waitForTimeout(1100);
      if (label === 'inbox') {
        await page.getByLabel('Tìm hội thoại', { exact: true }).fill('Phòng thử lịch hướng Đông');
        await page.getByText('Tìm trong tin nhắn', { exact: true }).click();
        await page.getByLabel('Từ khóa tin nhắn', { exact: true }).fill('100%');
        await page.locator('.message-results article').waitFor();
      }
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        label + ' overflow'
      );
      checks++;
      const result = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      scans.push({
        width,
        label,
        violations: result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target)
        }))
      });
      await page.screenshot({ path: path.join(out, label + '-' + width + '.png'), fullPage: true });
    }
  }
  await p.setViewportSize({ width: 320, height: 800 });
  await p.goto('/tin-nhan?hoi-thoai=' + f.chat);
  await p.waitForTimeout(1000);
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  checks++;
  await p.goto('/lich-xem-phong');
  await p.getByRole('button', { name: 'Hủy lịch', exact: true }).click();
  await p
    .getByRole('region', { name: 'Xác nhận cập nhật lịch', exact: true })
    .getByRole('button', { name: 'Đồng ý cập nhật', exact: true })
    .click();
  await p.getByText('Chưa có lịch xem phòng trong mục này.', { exact: true }).waitFor();
  checks++;
  await p.getByLabel('Hiển thị lịch', { exact: true }).selectOption('history');
  await p.getByText('Đã hủy', { exact: true }).first().waitFor();
  checks++;
  await x.goto('/tin-nhan?hoi-thoai=' + f.chat);
  await x
    .getByRole('alert')
    .getByText('Không tìm thấy cuộc trò chuyện.', { exact: true })
    .waitFor();
  assert.equal(await x.getByRole('region', { name: 'Lịch xem phòng', exact: true }).count(), 0);
  checks++;
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'accessibility.json'), JSON.stringify(scans, null, 2));
  assert(
    scans.every((v) => v.violations.length === 0),
    JSON.stringify(scans)
  );
  console.log(JSON.stringify({ checks, errors, scans }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
