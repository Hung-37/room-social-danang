// Writes fixtures: run only against an isolated test database.
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL;
if (!base || !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD)
  throw new Error(
    'Set TEST_BASE_URL, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for an isolated database.'
  );
let checks = 0;
async function api(path, { cookie = '', method = 'GET', body, status = 200 } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const p = await r.json();
  assert.equal(r.status, status, method + ' ' + path + ' ' + JSON.stringify(p));
  checks++;
  return {
    data: p.data,
    cookie: r.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
  };
}
const stamp = Date.now();
async function register(name, role = 'student') {
  return api('/api/auth/register', {
    method: 'POST',
    body: { name, email: `v8-${name}-${stamp}@test.local`, password: 'ManagementTest123!', role },
    status: 201
  });
}
const owner = await register('owner', 'landlord'),
  other = await register('other', 'landlord'),
  buyer = await register('buyer');
const admin = await api('/api/auth/login', {
  method: 'POST',
  body: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }
});
const loginBody = { email: `v8-buyer-${stamp}@test.local`, password: 'ManagementTest123!' };
for (const path of ['/api/profile', '/api/favorites', '/api/landlord/listings/no-room'])
  await api(path, { status: 401 });
await api('/api/profile', { method: 'PATCH', body: { name: 'test' }, status: 401 });
await api('/api/favorites', { method: 'PUT', body: { id: 'x', saved: true }, status: 401 });
await api('/api/landlord/listings/no-room', { cookie: buyer.cookie, status: 403 });
async function upload(cookie, buffer, type = 'image/png', status = 201) {
  const f = new FormData();
  f.append('file', new Blob([buffer], { type }), 'test.png');
  const r = await fetch(base + '/api/images', {
    method: 'POST',
    headers: cookie ? { cookie } : {},
    body: f
  });
  const p = await r.json();
  assert.equal(r.status, status, JSON.stringify(p));
  checks++;
  return p.data;
}
const png = await sharp({ create: { width: 800, height: 500, channels: 3, background: '#b7d8a5' } })
  .png()
  .toBuffer();
await upload('', png, 'image/png', 401);
await upload(buyer.cookie, png, 'image/png', 403);
await upload(owner.cookie, png, 'image/png', 403);
await api('/api/admin/landlords', {
  cookie: admin.cookie,
  method: 'PATCH',
  body: { id: owner.data.id, status: 'verified' }
});
await api('/api/admin/landlords', {
  cookie: admin.cookie,
  method: 'PATCH',
  body: { id: other.data.id, status: 'verified' }
});
await upload(
  owner.cookie,
  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  'image/svg+xml',
  400
);
await upload(owner.cookie, Buffer.from('not an image'), 'image/png', 400);
await upload(owner.cookie, Buffer.alloc(5 * 1024 * 1024 + 1), 'image/png', 413);
const image = await upload(owner.cookie, png);
assert(image.bytes < png.length * 3);
checks++;
async function photo(id, cookie = '', status = 200) {
  const r = await fetch(base + '/api/images/' + id, { headers: cookie ? { cookie } : {} });
  assert.equal(r.status, status);
  checks++;
  if (status === 200) {
    assert.equal(r.headers.get('content-type'), 'image/webp');
    assert.match(r.headers.get('cache-control'), /no-store/);
    assert.equal((await sharp(Buffer.from(await r.arrayBuffer())).metadata()).format, 'webp');
    checks += 3;
  }
}
await photo(image.id, '', 404);
await photo(image.id, other.cookie, 404);
await photo(image.id, owner.cookie);
await photo(image.id, admin.cookie);
const form = {
  title: 'Phòng ảnh thật v8 ' + stamp,
  summary: 'Phòng có cửa sổ, nội thất và thông tin chi phí rõ ràng.',
  address: 'Hải Châu, Đà Nẵng',
  price: 2600000,
  area: 28,
  imageIds: [image.id]
};
await api('/api/listings/create', {
  cookie: owner.cookie,
  method: 'POST',
  body: { ...form, price: 0.1 },
  status: 400
});
await api('/api/listings/create', {
  cookie: owner.cookie,
  method: 'POST',
  body: { ...form, area: 0.001 },
  status: 400
});
await api('/api/listings/create', {
  cookie: other.cookie,
  method: 'POST',
  body: form,
  status: 400
});
await photo(image.id, owner.cookie);
await api('/api/listings/create', {
  cookie: owner.cookie,
  method: 'POST',
  body: { ...form, imageIds: [image.id, image.id] },
  status: 400
});
const room = (
  await api('/api/listings/create', {
    cookie: owner.cookie,
    method: 'POST',
    body: form,
    status: 201
  })
).data.externalId;
const path = '/api/landlord/listings/' + room;
await api(path, { cookie: other.cookie, status: 404 });
await api(path, { cookie: other.cookie, method: 'PATCH', body: { action: 'hide' }, status: 404 });
await api('/api/admin/listings/' + room + '/preview', { status: 401 });
await api('/api/admin/listings/' + room + '/preview', { cookie: owner.cookie, status: 401 });
const preview = (await api('/api/admin/listings/' + room + '/preview', { cookie: admin.cookie }))
  .data;
assert.deepEqual(preview.imageUrls, ['/api/images/' + image.id]);
checks++;
await photo(image.id, '', 404);
await api('/api/favorites', {
  cookie: buyer.cookie,
  method: 'PUT',
  body: { id: room, saved: true },
  status: 404
});
await api('/api/listings/' + room + '/status', {
  cookie: admin.cookie,
  method: 'POST',
  body: { status: 'verified' }
});
await photo(image.id);
const detail = (await api('/api/community/posts/' + room)).data;
assert.deepEqual(detail.imageUrls, ['/api/images/' + image.id]);
checks++;
await api('/api/favorites', {
  cookie: buyer.cookie,
  method: 'PUT',
  body: { id: room, saved: true }
});
await api('/api/favorites', {
  cookie: buyer.cookie,
  method: 'PUT',
  body: { id: room, saved: true }
});
let list = (await api('/api/favorites', { cookie: buyer.cookie })).data;
assert.equal(list.length, 1);
assert.equal(list[0].title, form.title);
checks += 2;
assert.equal((await api('/api/favorites', { cookie: other.cookie })).data.length, 0);
checks++;
const second = (await api('/api/auth/user-login', { method: 'POST', body: loginBody })).cookie;
assert.equal((await api('/api/favorites', { cookie: second })).data[0].id, room);
checks++;
let profile = (await api('/api/profile', { cookie: buyer.cookie })).data;
assert(profile.user.createdAt);
assert.equal(Number(profile.stats.comments), 0);
checks += 2;
await api('/api/profile', {
  cookie: buyer.cookie,
  method: 'PATCH',
  body: { name: 'x' },
  status: 400
});
await api('/api/profile', {
  cookie: buyer.cookie,
  method: 'PATCH',
  body: { name: 'x'.repeat(81) },
  status: 400
});
await api('/api/profile', {
  cookie: buyer.cookie,
  method: 'PATCH',
  body: { name: 'Tên mới được lưu', role: 'admin', email: 'spoof@test.local', id: other.data.id }
});
profile = (await api('/api/auth/me', { cookie: second })).data;
assert.equal(profile.name, 'Tên mới được lưu');
assert.equal(profile.role, 'student');
assert.equal(profile.email, loginBody.email);
checks += 3;
let current = (await api(path, { cookie: owner.cookie })).data;
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { ...form, action: 'edit', revision: 'stale' },
  status: 409
});
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: {
    ...form,
    action: 'edit',
    revision: current.revision,
    title: 'Phòng đã sửa v8 ' + stamp,
    verificationStatus: 'verified',
    ownerExternalId: other.data.id
  }
});
await api('/api/community/posts/' + room, { status: 404 });
await photo(image.id, '', 404);
await photo(image.id, owner.cookie);
current = (await api(path, { cookie: owner.cookie })).data;
assert.equal(current.verificationStatus, 'needs_review');
checks++;
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'resubmit', revision: 'old' },
  status: 409
});
list = (await api('/api/favorites', { cookie: buyer.cookie })).data;
assert.equal(Number(list[0].available), 0);
assert.equal(list[0].title, null);
checks += 2;
await api('/api/listings/' + room + '/status', {
  cookie: admin.cookie,
  method: 'POST',
  body: { status: 'verified' }
});
current = (await api(path, { cookie: owner.cookie })).data;
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'rented', revision: current.revision }
});
await api('/api/community/posts/' + room, { status: 404 });
await photo(image.id, '', 404);
current = (await api(path, { cookie: owner.cookie })).data;
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'resubmit', revision: current.revision }
});
assert.equal((await api(path, { cookie: owner.cookie })).data.verificationStatus, 'needs_review');
checks++;
current = (await api(path, { cookie: owner.cookie })).data;
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'hide', revision: current.revision }
});
await api('/api/community/posts/' + room, { status: 404 });
await api('/api/admin/landlords', {
  cookie: admin.cookie,
  method: 'PATCH',
  body: { id: owner.data.id, status: 'rejected' }
});
current = (await api(path, { cookie: owner.cookie })).data;
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { ...form, action: 'edit', revision: current.revision },
  status: 403
});
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'resubmit', revision: current.revision },
  status: 403
});
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'rented', revision: current.revision }
});
await api('/api/favorites', {
  cookie: buyer.cookie,
  method: 'PUT',
  body: { id: room, saved: false }
});
assert.equal((await api('/api/favorites', { cookie: second })).data.length, 0);
checks++;
await api('/api/admin/landlords', {
  cookie: admin.cookie,
  method: 'PATCH',
  body: { id: owner.data.id, status: 'verified' }
});
current = (await api(path, { cookie: owner.cookie })).data;
await api(path, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { ...form, imageIds: [], action: 'edit', revision: current.revision }
});
await photo(image.id, owner.cookie, 404);
const publicFeed = await fetch(
  base + '/api/listings?q=' + encodeURIComponent('Phòng ảnh thật v8 ' + stamp)
);
assert.match(publicFeed.headers.get('cache-control') || '', /no-store/);
assert.equal((await publicFeed.json()).data.length, 0);
checks += 2;
if (process.env.TEST_MANAGEMENT_FIXTURES)
  await writeFile(
    process.env.TEST_MANAGEMENT_FIXTURES,
    JSON.stringify({ room, owner: owner.cookie, buyer: buyer.cookie, second, admin: admin.cookie })
  );
console.log(
  `PASS: ${checks} management checks; ownership, edit/review lifecycle, stale edits, hidden/rented gates, image validation/access, transactional attachments, durable profile and favorites across sessions.`
);
