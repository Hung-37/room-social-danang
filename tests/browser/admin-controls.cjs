// Synthetic users/model only; uses test:v10 fixtures and isolated database.
const req = require('node:module').createRequire(
  require('node:path').join(__dirname, '../../package.json')
);
const { chromium } = req('playwright'),
  { default: AxeBuilder } = req('@axe-core/playwright');
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL,
  file = process.env.TEST_COLLECTOR_FIXTURES,
  out = process.env.TEST_SCREENSHOT_DIR || 'work/v10-ui';
if (!base || !file) throw new Error('TEST_BASE_URL and TEST_COLLECTOR_FIXTURES required.');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const f = JSON.parse(fs.readFileSync(file));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--no-sandbox']
  });
  const local = new URL(base).protocol === 'http:';
  if (local) assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  async function context(cookie) {
    const c = await browser.newContext({ baseURL: base });
    c.setDefaultTimeout(15000);
    for (const part of cookie.split('; ')) {
      const split = part.indexOf('=');
      await c.addCookies([
        {
          name: part.slice(0, split),
          value: part.slice(split + 1),
          url: base,
          httpOnly: true,
          secure: !local,
          sameSite: 'Lax'
        }
      ]);
    }
    return c;
  }
  const admin = await context(f.admin),
    user = await context(f.user);
  const a = await admin.newPage(),
    p = await user.newPage();
  const errors = [];
  for (const page of [a, p]) page.on('pageerror', (e) => errors.push(e.message));
  let checks = 0;
  await a.goto('/admin/nguoi-dung');
  await a.getByLabel('Tìm người dùng', { exact: true }).fill(f.email);
  const card = a.locator('.user-card').filter({ hasText: f.email });
  await card.getByRole('button', { name: 'Khóa tài khoản', exact: true }).click();
  await a
    .getByLabel('Lý do cập nhật', { exact: true })
    .fill('Khóa tài khoản trong kiểm thử giao diện.');
  await a.getByRole('button', { name: 'Xác nhận cập nhật', exact: true }).click();
  await card.getByText('Bị khóa', { exact: true }).waitFor();
  assert.equal((await user.request.get('/api/auth/me')).status(), 401);
  checks++;
  await p.goto('/profile');
  await p.getByRole('link', { name: 'Đăng nhập để xem hồ sơ', exact: true }).waitFor();
  checks++;
  await card.getByRole('button', { name: 'Mở khóa', exact: true }).click();
  await a.getByLabel('Lý do cập nhật', { exact: true }).fill('Mở khóa sau kiểm thử giao diện.');
  await a.getByRole('button', { name: 'Xác nhận cập nhật', exact: true }).click();
  await card.getByText('Hoạt động', { exact: true }).waitFor();
  assert.equal((await user.request.get('/api/auth/me')).status(), 200);
  checks++;
  await a.goto('/admin/cau-hinh');
  await a
    .getByLabel('Tên website', { exact: true })
    .fill('RoomĐàNẵng kiểm thử cấu hình và trải nghiệm');
  await a
    .getByLabel('Quy định đăng tin và bình luận', { exact: true })
    .fill(
      'Quy định kiểm thử: thông tin trung thực, không công khai dữ liệu riêng tư, mọi tin phòng phải chờ duyệt.'
    );
  await a.getByRole('button', { name: 'Lưu cấu hình', exact: true }).click();
  await a.getByText('Đã lưu cấu hình vào MySQL.', { exact: true }).waitFor();
  await a.reload();
  assert.equal(
    await a.getByLabel('Tên website', { exact: true }).inputValue(),
    'RoomĐàNẵng kiểm thử cấu hình và trải nghiệm'
  );
  checks++;
  await p.goto('/quy-dinh');
  await p
    .getByRole('heading', {
      name: 'Quy định sử dụng RoomĐàNẵng kiểm thử cấu hình và trải nghiệm',
      exact: true
    })
    .waitFor();
  await p
    .getByText(
      'Quy định kiểm thử: thông tin trung thực, không công khai dữ liệu riêng tư, mọi tin phòng phải chờ duyệt.',
      { exact: true }
    )
    .waitFor();
  checks++;
  const sourceName = 'Nguồn UI ' + Date.now();
  await a.getByLabel('Tên nguồn', { exact: true }).fill(sourceName);
  await a.getByLabel('URL nguồn HTTPS', { exact: true }).fill('https://feed.example.vn/rooms');
  await a.getByRole('button', { name: 'Lưu nguồn', exact: true }).click();
  const source = a.locator('.configured-sources article').filter({ hasText: sourceName });
  await source.getByText('Đang tắt', { exact: false }).waitFor();
  await source.getByRole('button', { name: 'Bật nguồn', exact: true }).click();
  await source.getByText('Đang bật', { exact: false }).waitFor();
  await a.reload();
  await a
    .locator('.configured-sources article')
    .filter({ hasText: sourceName })
    .getByText('Đang bật', { exact: false })
    .waitFor();
  checks++;
  await a
    .locator('.configured-sources article')
    .filter({ hasText: sourceName })
    .getByRole('button', { name: 'Tắt nguồn', exact: true })
    .click();
  await a
    .locator('.configured-sources article')
    .filter({ hasText: sourceName })
    .getByText('Đang tắt', { exact: false })
    .waitFor();
  checks++;
  await a.goto('/admin');const draft='[{"title":"Phòng trọ kiểm thử Hải Châu","description":"Mô tả phòng cho kiểm thử lỗi kết nối.","price":"2 triệu","area":"25.5m²","address":"Hải Châu, Đà Nẵng"}]';await a.getByPlaceholder('Dán JSON hoặc CSV tại đây...').fill(draft);
  await a.route('**/api/import/listings',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({data:[],saved:0,persistence:{status:'error',databaseSaved:0},ai:{enabled:false,analyzed:0,errors:[]}})}));
  await a.getByRole('button',{name:'Lọc và nhập dữ liệu',exact:true}).click();await a.getByText('Chưa lưu đầy đủ dữ liệu vào MySQL. Kiểm tra kết nối rồi thử lại.',{exact:true}).waitFor();assert.equal(await a.getByPlaceholder('Dán JSON hoặc CSV tại đây...').inputValue(),draft);checks++;await a.unroute('**/api/import/listings');
  await a.goto('/admin?tab=listings');
  const listing = a
    .locator('.source-row')
    .filter({ hasText: 'Phòng trọ Hải Châu kiểm thử' })
    .first();
  await listing.getByText('Xem nội dung và ảnh', { exact: true }).click();
  await listing.getByText('Phân tích AI:', { exact: false }).waitFor();
  checks++;
  const scans = [];
  for (const width of [1440, 390])
    for (const [page, url, label] of [
      [a, '/admin/cau-hinh', 'settings'],
      [a, '/admin/nguoi-dung', 'users'],
      [p, '/quy-dinh', 'rules']
    ]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url);
      await page.waitForTimeout(900);
      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        label + ' overflow ' + width
      );
      checks++;
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      scans.push({
        width,
        label,
        violations: r.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))
      });
      await page.screenshot({ path: path.join(out, label + '-' + width + '.png'), fullPage: true });
    }
  await p.setViewportSize({ width: 320, height: 800 });
  await p.goto('/quy-dinh');
  await p.waitForTimeout(500);
  assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  checks++;
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'accessibility.json'), JSON.stringify(scans, null, 2));
  assert(
    scans.every((s) => !s.violations.length),
    JSON.stringify(scans)
  );
  console.log(JSON.stringify({ checks, errors, scans }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
