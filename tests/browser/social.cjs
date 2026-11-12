const { createRequire } = require('node:module');
const req = createRequire(require('node:path').join(__dirname, '../../package.json'));
const { chromium } = req('playwright');
const { default: AxeBuilder } = req('@axe-core/playwright');
const fs = require('fs');
const out =
  process.env.TEST_SCREENSHOT_DIR || require('node:path').join(__dirname, '../../work/social-ui');
if (!process.env.TEST_BASE_URL || !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD)
  throw new Error(
    'Set TEST_BASE_URL, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD; use a dedicated test database.'
  );
const assert = require('node:assert/strict');
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ['--no-sandbox']
  });
  const base = process.env.TEST_BASE_URL;
  const headers = { 'x-forwarded-for': 'social-ui-' + Date.now() };
  const buyer = await b.newContext({ baseURL: base, extraHTTPHeaders: headers }),
    owner = await b.newContext({ baseURL: base, extraHTTPHeaders: headers }),
    admin = await b.newContext({ baseURL: base, extraHTTPHeaders: headers });
  let checks = 0;
  const stamp = Date.now();
  async function api(ctx, path, method = 'GET', data) {
    const r = await ctx.request.fetch(path, { method, data });
    const p = await r.json();
    assert(r.ok(), path + JSON.stringify(p));
    checks++;
    if (new URL(base).protocol === 'http:') {
      assert(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
      await ctx.addCookies((await ctx.cookies()).map((c) => ({ ...c, secure: false })));
    }
    return p.data;
  }
  await api(admin, '/api/auth/login', 'POST', {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD
  });
  const u = await api(owner, '/api/auth/register', 'POST', {
    name: 'Chủ trọ UI',
    email: `owner-ui-${stamp}@test.local`,
    password: 'SocialTest123!',
    role: 'landlord'
  });
  await api(buyer, '/api/auth/register', 'POST', {
    name: 'Người tìm phòng',
    email: `buyer-ui-${stamp}@test.local`,
    password: 'SocialTest123!',
    role: 'student'
  });
  await api(admin, '/api/admin/landlords', 'PATCH', { id: u.id, status: 'verified' });
  const room = await api(owner, '/api/listings/create', 'POST', {
    title: '[Minh họa] Phòng có ban công ' + stamp,
    summary: 'Phòng kiểm thử tính năng trao đổi riêng và bình luận công khai.',
    address: 'Hải Châu, Đà Nẵng',
    price: 2300000,
    area: 24
  });
  await api(admin, '/api/listings/' + room.externalId + '/status', 'POST', { status: 'verified' });
  const p = await buyer.newPage(),
    s = await owner.newPage();
  const errors = [];
  for (const page of [p, s]) page.on('pageerror', (e) => errors.push(e.message));
  await s.goto('/tin-nhan');
  await s.getByText('Chưa có cuộc trò chuyện.', { exact: false }).waitFor();
  await p.goto('/bai/' + room.externalId);
  await p.getByRole('button', { name: 'Nhắn chủ trọ', exact: true }).click();
  await p.waitForURL('**/tin-nhan?hoi-thoai=**');
  const chat = new URL(p.url()).searchParams.get('hoi-thoai');
  await p.getByLabel('Tin nhắn riêng', { exact: true }).waitFor();
  checks++;
  await s.bringToFront();
  await s.getByRole('button', { name: /Người tìm phòng/ }).waitFor({ timeout: 15000 });
  await s.getByRole('button', { name: /Người tìm phòng/ }).click();
  checks++;
  await s.getByLabel('Tin nhắn riêng', { exact: true }).waitFor();
  await p
    .getByLabel('Tin nhắn riêng', { exact: true })
    .fill('Mình có thể xem phòng vào thứ bảy không?');
  await p.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
  await s.bringToFront();
  await s
    .getByLabel('Nội dung tin nhắn')
    .getByText('Mình có thể xem phòng vào thứ bảy không?', { exact: true })
    .waitFor({ timeout: 15000 });
  checks++;
  await s.getByLabel('Tin nhắn riêng', { exact: true }).fill('Được nhé, bạn đến lúc 9 giờ nhé.');
  await s.getByRole('button', { name: 'Gửi tin nhắn', exact: true }).click();
  await p.bringToFront();
  await p
    .getByLabel('Nội dung tin nhắn')
    .getByText('Được nhé, bạn đến lúc 9 giờ nhé.', { exact: true })
    .waitFor({ timeout: 15000 });
  checks++;
  await s.getByRole('button', { name: 'Chặn hội thoại', exact: true }).click();
  await p.bringToFront();
  await p.getByText('Cuộc trò chuyện đang bị chặn.', { exact: true }).waitFor({ timeout: 15000 });
  assert.equal(await p.getByLabel('Tin nhắn riêng', { exact: true }).count(), 0);
  checks++;
  await s.getByRole('button', { name: 'Bỏ chặn', exact: true }).click();
  await p.bringToFront();
  await p.getByLabel('Tin nhắn riêng', { exact: true }).waitFor({ timeout: 15000 });
  checks++;
  await p.getByText('Báo cáo cuộc trò chuyện', { exact: true }).click();
  await p
    .getByLabel('Lý do báo cáo', { exact: true })
    .fill('Báo cáo kiểm thử giao diện hội thoại.');
  await p.getByRole('button', { name: 'Gửi báo cáo', exact: true }).click();
  await p.getByText('Đã gửi báo cáo tới quản trị viên.').waitFor();
  checks++;
  await p.goto('/bai/' + room.externalId);
  await p.getByLabel('Bạn muốn hỏi hoặc chia sẻ điều gì?').fill('Tiền điện được tính như thế nào?');
  await p.getByRole('button', { name: 'Gửi bình luận', exact: true }).click();
  await p.getByText('Đã gửi bình luận. Cảm ơn bạn đã chia sẻ!').waitFor();
  await s.goto('/bai/' + room.externalId);
  const root = s.locator('.comment-item').filter({ hasText: 'Tiền điện được tính như thế nào?' });
  await root.getByRole('button', { name: 'Trả lời', exact: true }).click();
  await s
    .getByLabel('Bạn muốn hỏi hoặc chia sẻ điều gì?')
    .fill('Tiền điện được ghi rõ trong hợp đồng nhé.');
  await s.getByRole('button', { name: 'Gửi bình luận', exact: true }).click();
  const reply = s
    .locator('.comment-item')
    .filter({ hasText: 'Tiền điện được ghi rõ trong hợp đồng nhé.' });
  await reply.getByText('Chủ phòng', { exact: true }).waitFor();
  await reply.getByText('Chủ trọ đã xác minh', { exact: true }).waitFor();
  checks++;
  await p.goto('/thong-bao');
  await p.getByRole('link', { name: /Có người trả lời bình luận/ }).click();
  await p.waitForURL('**/bai/' + room.externalId + '#binh-luan');
  checks++;
  const scans = [];
  fs.mkdirSync(out, { recursive: true });
  for (const width of [1440, 390]) {
    await p.setViewportSize({ width, height: 900 });
    for (const path of ['/tin-nhan?hoi-thoai=' + chat, '/thong-bao']) {
      await p.goto(path);
      await p.waitForTimeout(1200);
      const d = await p.evaluate(() => ({
        w: innerWidth,
        s: document.documentElement.scrollWidth
      }));
      assert(d.s <= d.w + 1, JSON.stringify(d));
      checks++;
      const result = await new AxeBuilder({ page: p })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      scans.push({
        width,
        path,
        violations: result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target)
        }))
      });
      await p.screenshot({
        path: `${out}/${path.startsWith('/tin-nhan') ? 'inbox' : 'notifications'}-${width}.png`,
        fullPage: true
      });
    }
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    require('node:path').join(out, 'accessibility.json'),
    JSON.stringify(scans, null, 2)
  );
  assert(
    scans.every((s) => s.violations.length === 0),
    JSON.stringify(scans)
  );
  console.log(JSON.stringify({ checks, errors, scans }, null, 2));
  await b.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
