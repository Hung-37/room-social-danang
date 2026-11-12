// Writes test accounts/comments: run only against an isolated test database.
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const fixtureFile = process.env.TEST_FIXTURE_FILE || 'work/comment-fixtures.json';
  const output = process.env.TEST_SCREENSHOT_DIR || 'work/experience';
  if (!process.env.TEST_BASE_URL)
    throw new Error('Set TEST_BASE_URL and run test:comments first to create TEST_FIXTURE_FILE.');
  const fixtures = JSON.parse(fs.readFileSync(fixtureFile));
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    headless: true,
    args: ['--no-sandbox']
  });
  const context = await browser.newContext({
    baseURL: process.env.TEST_BASE_URL,
    viewport: { width: 1440, height: 1000 }
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  let checks = 0;
  await page.goto('/bai/' + fixtures.publicId);
  await page.getByRole('heading', { name: fixtures.title, exact: true }).waitFor();
  checks++;
  await page.getByRole('heading', { name: /Bình luận/ }).waitFor();
  await page.waitForLoadState('networkidle');
  for (let i = 0; i < 5; i++)
    await page.getByRole('button', { name: /Xem bình luận cũ hơn/ }).click();
  await page.waitForTimeout(500);
  assert.equal(await page.locator('.comment-item').count(), 105);
  checks++;
  await page.goto('/bai/' + fixtures.pendingId);
  await page.getByRole('heading', { name: 'Chưa tìm thấy bài đăng này' }).waitFor();
  checks++;
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Tìm phòng', exact: true }).fill('Phòng đã duyệt');
  await page.getByRole('button', { name: 'Tìm phòng', exact: true }).click();
  await page.waitForURL('**/bang-tin?**');
  await page
    .locator('.room-card h3 a[href="/bai/' + fixtures.roomId + '"]')
    .filter({ hasText: '[Kiểm thử] Phòng đã duyệt' })
    .waitFor();
  assert.equal(await page.getByLabel('Tìm kiếm', { exact: true }).inputValue(), 'Phòng đã duyệt');
  checks++;
  const stamp = Date.now(),
    email = `ui-v6-${stamp}@test.local`,
    password = 'BrowserTest123!';
  const registration = await context.request.post('/api/auth/register', {
    data: { name: 'Bạn đọc cộng đồng', email, password, role: 'student' }
  });
  assert.equal(registration.status(), 201);
  checks++;
  await context.clearCookies();
  await page.goto('/bai/' + fixtures.roomId);
  await page.locator('.sign-in-callout').getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/dang-nhap?next=**');
  await page.getByRole('link', { name: 'Đăng ký', exact: true }).click();
  await page.waitForURL('**/dang-ky?next=**');
  await page.getByRole('link', { name: 'Đăng nhập', exact: true }).click();
  await page.waitForURL('**/dang-nhap?next=**');
  checks++;
  await page.getByPlaceholder('ban@email.com').fill(email);
  await page.getByPlaceholder('Nhập mật khẩu').fill(password);
  await page.getByRole('button', { name: /Đăng nhập/ }).click();
  await page.waitForURL('**/bai/' + fixtures.roomId + '**');
  await page.getByLabel('Bạn muốn hỏi hoặc chia sẻ điều gì?').waitFor();
  checks++;
  const draft = 'Xin hỏi phòng có internet và phí giữ xe là bao nhiêu? ' + stamp;
  await page.getByLabel('Bạn muốn hỏi hoặc chia sẻ điều gì?').fill(draft);
  await page.route('**/api/community/posts/*/comments', async (route) => {
    if (route.request().method() === 'POST')
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Kết nối tạm ngắt, hãy thử lại.' })
      });
    return route.continue();
  });
  await page.getByRole('button', { name: 'Gửi bình luận', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Kết nối tạm ngắt' }).waitFor();
  assert.equal(await page.getByLabel('Bạn muốn hỏi hoặc chia sẻ điều gì?').inputValue(), draft);
  assert.equal(await page.locator('.comment-item').filter({ hasText: draft }).count(), 0);
  checks++;
  await page.unroute('**/api/community/posts/*/comments');
  await page.getByRole('button', { name: 'Gửi bình luận', exact: true }).click();
  await page.getByText('Đã gửi bình luận. Cảm ơn bạn đã chia sẻ!').waitFor();
  await page.getByText(draft, { exact: true }).waitFor();
  assert.equal(await page.getByLabel('Bạn muốn hỏi hoặc chia sẻ điều gì?').inputValue(), '');
  checks++;
  await page.goto('/thao-luan');
  await page.getByRole('button', { name: 'Viết thảo luận', exact: true }).click();
  await page.locator('#viet-bai input[name=title]').fill('Hỏi kinh nghiệm về phòng ở ' + stamp);
  await page
    .locator('#viet-bai textarea')
    .fill(
      'Mình đang tìm phòng quanh Hải Châu, mọi người có lưu ý gì về tiền cọc và phí điện nước không?'
    );
  await page.getByRole('button', { name: 'Gửi bài chờ duyệt' }).click();
  await page.getByText('Đã gửi bài. Nội dung sẽ xuất hiện sau khi quản trị viên duyệt.').waitFor();
  checks++;
  await page.getByRole('button', { name: 'Đóng biểu mẫu thảo luận' }).click();
  assert.equal(
    await page
      .getByRole('button', { name: 'Viết thảo luận', exact: true })
      .evaluate((e) => e === document.activeElement),
    true
  );
  checks++;
  const a11y = [];
  const paths = [
    '/',
    '/bang-tin',
    '/thao-luan',
    '/bai/' + fixtures.roomId,
    '/bai/' + fixtures.publicId,
    '/dang-nhap',
    '/dang-ky'
  ];
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of paths) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const d = await page.evaluate(() => ({
        w: innerWidth,
        s: document.documentElement.scrollWidth
      }));
      assert(d.s <= d.w + 1, `Overflow ${path} ${width}: ${JSON.stringify(d)}`);
      checks++;
      if (width !== 320) {
        const report = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();
        a11y.push({
          path,
          width,
          violations: report.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary }))
          }))
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click();
  await page
    .locator('#mobile-navigation')
    .getByRole('link', { name: /Thảo luận/ })
    .waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#mobile-navigation').count(), 0);
  assert.equal(
    await page
      .getByRole('button', { name: 'Mở menu', exact: true })
      .evaluate((e) => e === document.activeElement),
    true
  );
  checks++;
  await page.goto('/');
  await page.keyboard.press('Tab');
  assert.equal(
    await page.locator('.skip-link').evaluate((e) => e === document.activeElement),
    true
  );
  await page.keyboard.press('Enter');
  assert.equal(
    await page.locator('#main-content').evaluate((e) => e === document.activeElement),
    true
  );
  checks++;
  assert.deepEqual(errors, []);
  assert.equal(
    a11y.filter((p) => p.violations.length).length,
    0,
    JSON.stringify(a11y.filter((p) => p.violations.length))
  );
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(
    require('node:path').join(output, 'accessibility.json'),
    JSON.stringify(a11y, null, 2)
  );
  fs.writeFileSync(
    require('node:path').join(output, 'browser-errors.json'),
    JSON.stringify(errors)
  );
  console.log(
    JSON.stringify(
      { checks, uncaughtErrors: errors, accessibility: a11y.filter((p) => p.violations.length) },
      null,
      2
    )
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
