// Isolated QA database is required. No external crawl.
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
const base = process.env.TEST_BASE_URL;
if (
  !base ||
  !process.env.MYSQL_URL ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error('Set test server/admin/database.');
let checks = 0;
async function api(path, { cookie = '', method = 'GET', body, status = 200 } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const p = await r.json();
  assert.equal(r.status, status, path + JSON.stringify(p));
  checks++;
  return {
    ...p,
    cookie: r.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
  };
}
const stamp = Date.now(),
  admin = await api('/api/auth/login', {
    method: 'POST',
    body: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }
  });
const email = 'v10-user-' + stamp + '@test.local',
  student = await api('/api/auth/register', {
    method: 'POST',
    status: 201,
    body: { name: 'Người dùng QA ' + stamp, email, password: 'NewFeatureTest123!', role: 'student' }
  });
for (const path of ['/api/admin/users', '/api/admin/settings']) {
  await api(path, { status: 401 });
  await api(path, { cookie: student.cookie, status: 401 });
}
const first = (await api('/api/admin/settings', { cookie: admin.cookie })).data;
assert.equal('ai' in first, false);
assert.equal('aiEnabled' in first.settings, false);
checks += 2;
async function settings(patch) {
  const p = (await api('/api/admin/settings', { cookie: admin.cookie })).data;
  return (
    await api('/api/admin/settings', {
      cookie: admin.cookie,
      method: 'PUT',
      body: { settings: { ...p.settings, ...patch }, version: p.version }
    })
  ).data;
}
for(const invalid of [{siteName:'x'.repeat(61)},{contactEmail:'invalid email'},{registrationEnabled:'true'}])await api('/api/admin/settings',{cookie:admin.cookie,method:'PUT',body:{settings:{...first.settings,...invalid},version:first.version},status:400});
await settings({
  siteName: 'RoomĐàNẵng QA',
  contactEmail: 'help@test.local'
});
assert.equal((await api('/api/site/settings')).data.siteName, 'RoomĐàNẵng QA');
checks++;
await api('/api/admin/settings', {
  cookie: admin.cookie,
  method: 'PUT',
  body: { settings: first.settings, version: first.version },
  status: 409
});
await settings({ registrationEnabled: false });
await api('/api/auth/register', {
  method: 'POST',
  body: {
    name: 'Should not register',
    email: 'closed-' + stamp + '@test.local',
    password: 'Test123456!'
  },
  status: 403
});
await settings({ registrationEnabled: true });
let user = (await api('/api/admin/users?q=' + encodeURIComponent(email), { cookie: admin.cookie }))
  .data[0];
assert.equal(user.id, student.data.id);
assert(!('password_hash' in user));
checks += 2;
await api('/api/admin/users', {
  cookie: admin.cookie,
  method: 'PATCH',
  body: { id: user.id, blocked: true, version: 0, reason: 'Khóa tài khoản để kiểm thử.' }
});
await api('/api/auth/me', { cookie: student.cookie, status: 401 });
await api('/api/profile', {
  cookie: student.cookie,
  method: 'PATCH',
  body: { name: 'Không được đổi' },
  status: 401
});
await api('/api/auth/user-login', {
  method: 'POST',
  body: { email, password: 'NewFeatureTest123!' },
  status: 401
});
await api('/api/admin/users', {
  cookie: student.cookie,
  method: 'PATCH',
  body: { id: user.id, blocked: false, version: 1, reason: 'Tự mở khóa không được.' },
  status: 401
});
await api('/api/admin/users', {
  cookie: admin.cookie,
  method: 'PATCH',
  body: { id: user.id, blocked: false, version: 0, reason: 'Phiên bản cũ.' },
  status: 409
});
await api('/api/admin/users', {
  cookie: admin.cookie,
  method: 'PATCH',
  body: { id: user.id, blocked: false, version: 1, reason: 'Mở khóa sau kiểm thử.' }
});
await api('/api/auth/me', { cookie: student.cookie });
const dataRows = [
  {
    id: 'v10-import-' + stamp,
    title: 'Phòng trọ Hải Châu kiểm thử ' + stamp,
    description: 'Phòng có cửa sổ và hợp đồng, cần kiểm tra điện nước.',
    price: '2.5 triệu',
    area: '25.5m²',
    address: 'Hải Châu, Đà Nẵng'
  },
  {
    id: 'v10-other-city-' + stamp,
    title: 'Phòng trọ Hà Nội',
    description: 'Phòng cho thuê Cầu Giấy, Hà Nội.',
    price: '3 triệu',
    area: '25m²',
    address: 'Hà Nội'
  }
];
let result = await api('/api/import/listings', {
  cookie: admin.cookie,
  method: 'POST',
  body: { format: 'json', content: JSON.stringify(dataRows) }
});
assert.equal(result.saved, 1);
assert.equal(result.data[0].area, 25.5);
assert.equal(result.rejected.length, 1);
assert.equal(result.status, 'completed');
assert.equal('ai' in result, false);
checks += 5;
const listingId = result.data[0].externalId;
const preview = (
  await api('/api/admin/listings/' + listingId + '/preview', { cookie: admin.cookie })
).data;
assert.equal('ai' in preview, false);
checks++;
const c = await mysql.createConnection(process.env.MYSQL_URL);
try {
  const [logs] = await c.query('SELECT * FROM collector_runs ORDER BY id DESC LIMIT 1');
  assert.equal(logs[0].status, 'completed');
  assert(logs[0].started_at);
  checks += 2;
  for (const id of ['phongtro123-da-nang', 'tromoi-da-nang', 'thuephongtro-da-nang'])
    await api('/api/collector/check', {
      cookie: admin.cookie,
      method: 'POST',
      body: { sourceId: id, enabled: false }
    });
  const sources = (await api('/api/collector/check', { cookie: admin.cookie })).data;
  assert.equal(sources.find((s) => s.id === 'phongtro123-da-nang').enabled, false);
  checks++;
  const custom = (
    await api('/api/collector/check', {
      cookie: admin.cookie,
      method: 'POST',
      body: {
        name: 'Nguồn QA lưu database',
        url: 'https://feed.example.vn/rooms',
        permission: 'public_feed',
        enabled: false
      }
    })
  ).data;
  assert(
    (await api('/api/collector/check', { cookie: admin.cookie })).data.some(
      (s) => s.id === custom.id
    )
  );
  checks++;
  await api('/api/collector/check', {
    cookie: admin.cookie,
    method: 'POST',
    body: {
      sourceId: custom.id,
      name: 'Nguồn QA đã sửa',
      url: 'https://feed.example.vn/rooms',
      permission: 'public_feed',
      enabled: false
    }
  });
  assert.equal(
    (await api('/api/collector/check', { cookie: admin.cookie })).data.find(
      (s) => s.id === custom.id
    ).name,
    'Nguồn QA đã sửa'
  );
  checks++;
  await api('/api/collector/check', {
    cookie: admin.cookie,
    method: 'POST',
    body: { name: 'Unsafe source', url: 'http://localhost:11435', enabled: true },
    status: 400
  });
  await api('/api/collector/run', {
    cookie: admin.cookie,
    method: 'POST',
    body: { sourceId: custom.id },
    status: 403
  });
  await api('/api/collector/check',{cookie:admin.cookie,method:'POST',body:{name:'Bộ chọn lỗi',url:'https://feed.example.vn/rooms',enabled:false,selectors:{itemSelector:'[broken'}},status:400});
  // Template runtime file is restored and only QA has COLLECTOR_INCLUDE_DEMO enabled.
  const file = join(process.env.TEST_RUNTIME_DIR || join(process.cwd(), '.next/standalone'), 'fixtures/listings.json'),
    original = await readFile(file);
  try {
    await writeFile(file, JSON.stringify([{ ...dataRows[0], id: 'collector-template-' + stamp }]));
    result = await api('/api/collector/run', {
      cookie: admin.cookie,
      method: 'POST',
      body: { sourceId: 'data-template' }
    });
      assert.equal(result.meta.persistence.databaseSaved, 1);
      assert.equal(result.meta.status, 'completed');
      assert.equal('ai' in result.meta, false);
    checks += 3;
    result = await api('/api/collector/init', { cookie: admin.cookie, method: 'POST', body: {} });
      assert.equal(result.meta.persistence.storage, 'mysql');
      assert.equal('ai' in result.meta, false);
    checks += 2;
  } finally {
    await writeFile(file, original);
  }
  await settings({ collectorEnabled: false });
  await api('/api/collector/run', {
    cookie: admin.cookie,
    method: 'POST',
    body: { sourceId: 'data-template' },
    status: 503
  });
  // Re-crawled content changes return an approved source listing to review.
  await api('/api/listings/' + listingId + '/status', {
    cookie: admin.cookie,
    method: 'POST',
    body: { status: 'verified' }
  });
  await api('/api/import/listings', {
    cookie: admin.cookie,
    method: 'POST',
    body: {
      format: 'json',
      content: JSON.stringify([
        { ...dataRows[0], description: 'Nội dung đã thay đổi, cần Admin xem xét và duyệt lại.' }
      ])
    }
  });
  const [updated] = await c.query('SELECT verification_status FROM listings WHERE external_id=?', [
    listingId
  ]);
  assert.equal(updated[0].verification_status, 'needs_review');
  checks++;
  const [audit] = await c.query(
    "SELECT COUNT(*) AS n FROM moderation_logs WHERE entity_type IN ('user','settings')"
  );
  assert(Number(audit[0].n) > 3);
  checks++;
  if (process.env.TEST_COLLECTOR_FIXTURES) {
    await mkdir(dirname(process.env.TEST_COLLECTOR_FIXTURES), { recursive: true });
    await writeFile(
      process.env.TEST_COLLECTOR_FIXTURES,
      JSON.stringify({ admin: admin.cookie, user: student.cookie, id: user.id, email, listingId })
    );
  }
} finally {
  await c.end();
}
console.log(
  `PASS: ${checks} collector checks: persisted settings/source toggles, blocked sessions, user controls, unified import/init/run without AI, decimal areas, city filter, database logs and re-review on source changes.`
);
