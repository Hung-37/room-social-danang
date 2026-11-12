// Creates users, rooms and messages: isolated test database only.
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const base = process.env.TEST_BASE_URL;
if (!base || !process.env.MYSQL_URL)
  throw new Error('Set TEST_BASE_URL and MYSQL_URL for a dedicated test database.');
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
  assert.equal(r.status, status, `${path}: ${JSON.stringify(p)}`);
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
async function register(name, role) {
  return api('/api/auth/register', {
    method: 'POST',
    body: { name, email: `${name}-${stamp}@social.test`, password: 'SocialTest123!', role },
    status: 201
  });
}
const owner = await register('owner', 'landlord'),
  buyer = await register('buyer', 'student'),
  other = await register('outsider', 'student');
const admin = await api('/api/auth/login', {
  method: 'POST',
  body: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }
});
await api('/api/admin/landlords', {
  method: 'PATCH',
  cookie: admin.cookie,
  body: { id: owner.data.id, status: 'verified' }
});
const room = await api('/api/listings/create', {
  method: 'POST',
  cookie: owner.cookie,
  body: {
    title: '[Kiểm thử] Phòng nhắn tin ' + stamp,
    summary: 'Phòng dùng kiểm thử hội thoại, không phải tin thuê thực tế.',
    price: 2000000,
    area: 20,
    address: 'Hải Châu, Đà Nẵng'
  },
  status: 201
});
const rid = room.data.externalId;
await api('/api/chat', {
  method: 'POST',
  cookie: buyer.cookie,
  body: { listingId: rid },
  status: 409
});
await api('/api/listings/' + rid + '/status', {
  method: 'POST',
  cookie: admin.cookie,
  body: { status: 'verified' }
});
await api('/api/chat', { status: 401 });
await api('/api/chat', {
  method: 'POST',
  cookie: owner.cookie,
  body: { listingId: rid },
  status: 400
});
const chat = (
  await api('/api/chat', { method: 'POST', cookie: buyer.cookie, body: { listingId: rid } })
).data.id;
assert.equal(
  (await api('/api/chat', { method: 'POST', cookie: buyer.cookie, body: { listingId: rid } })).data
    .id,
  chat
);
checks++;
for (const method of ['GET', 'POST', 'PATCH'])
  await api('/api/chat/' + chat, {
    method,
    cookie: other.cookie,
    body:
      method === 'GET'
        ? undefined
        : method === 'POST'
          ? { text: 'Không được phép' }
          : { action: 'block' },
    status: 404
  });
assert.deepEqual((await api('/api/chat', { cookie: other.cookie })).data, []);
checks++;
await api('/api/chat/' + chat, { status: 401 });
await api('/api/chat/' + chat, { method: 'POST', cookie: buyer.cookie, body: null, status: 400 });
const message = (
  await api('/api/chat/' + chat, {
    method: 'POST',
    cookie: buyer.cookie,
    body: { text: 'Mình muốn xem phòng thứ bảy.', senderId: owner.data.id },
    status: 201
  })
).data;
assert.equal(message.senderId, buyer.data.id);
checks++;
assert.equal(Number((await api('/api/chat', { cookie: owner.cookie })).data[0].unread), 1);
checks++;
await api('/api/chat/' + chat, {
  method: 'PATCH',
  cookie: owner.cookie,
  body: { action: 'read', upto: message.id }
});
await api('/api/chat/' + chat, {
  method: 'PATCH',
  cookie: owner.cookie,
  body: { action: 'read', upto: 0 }
});
assert.equal(Number((await api('/api/chat', { cookie: owner.cookie })).data[0].unread), 0);
checks++;
await api('/api/chat/' + chat, {
  method: 'POST',
  cookie: owner.cookie,
  body: { text: 'Bạn có thể đến lúc 9 giờ.' },
  status: 201
});
const notif = (await api('/api/notifications', { cookie: buyer.cookie })).data;
assert(notif.some((n) => n.href === '/tin-nhan?hoi-thoai=' + chat));
checks++;
await api('/api/chat/' + chat, {
  method: 'PATCH',
  cookie: owner.cookie,
  body: { action: 'block' }
});
for (const u of [buyer, owner])
  await api('/api/chat/' + chat, {
    method: 'POST',
    cookie: u.cookie,
    body: { text: 'Không gửi khi chặn' },
    status: 409
  });
await api('/api/chat/' + chat, {
  method: 'PATCH',
  cookie: buyer.cookie,
  body: { action: 'unblock' },
  status: 403
});
await api('/api/chat/' + chat, {
  method: 'PATCH',
  cookie: owner.cookie,
  body: { action: 'unblock' }
});
await api('/api/chat/' + chat, {
  method: 'PATCH',
  cookie: buyer.cookie,
  body: { action: 'report', reason: 'Hội thoại kiểm thử cần kiểm tra.' }
});
await api('/api/admin/chat-reports', { cookie: buyer.cookie, status: 401 });
await api('/api/admin/chat-reports', {
  method: 'PATCH',
  cookie: admin.cookie,
  body: { id: 'missing', status: 'resolved' },
  status: 404
});
const reports = (await api('/api/admin/chat-reports', { cookie: admin.cookie })).data;
const report = reports.find((r) => r.conversationId === chat);
assert(report && !('messages' in report));
checks++;
await api('/api/admin/chat-reports', {
  method: 'PATCH',
  cookie: admin.cookie,
  body: { id: report.id, status: 'resolved' }
});
const root = (
  await api(`/api/community/posts/${rid}/comments`, {
    method: 'POST',
    cookie: buyer.cookie,
    body: { text: 'Phòng có ban công không?' },
    status: 201
  })
).data;
const reply = (
  await api(`/api/community/posts/${rid}/comments`, {
    method: 'POST',
    cookie: owner.cookie,
    body: { text: 'Có ban công nhìn ra đường.', parentId: root.id },
    status: 201
  })
).data;
assert.equal(reply.parentId, root.id);
assert.equal(Number(reply.isOwner), 1);
assert.equal(Number(reply.verifiedLandlord), 1);
checks += 3;
assert(
  (await api('/api/notifications', { cookie: buyer.cookie })).data.some(
    (n) => n.type === 'reply' && n.href === '/bai/' + rid + '#binh-luan'
  )
);
checks++;
await api(`/api/community/posts/${rid}/comments`, {
  method: 'POST',
  cookie: buyer.cookie,
  body: { text: 'Không gắn vào parent giả', parentId: 'missing-parent' },
  status: 409
});
const c = await mysql.createConnection(process.env.MYSQL_URL);
try {
  await c.query('INSERT INTO private_messages(conversation_id,sender_id,body) VALUES ?', [
    Array.from({ length: 80 }, (_, i) => [chat, owner.data.id, 'Tin lịch sử ' + i])
  ]);
} finally {
  await c.end();
}
let before = 0;
const ids = [];
for (let i = 0; i < 10; i++) {
  const p = (
    await api('/api/chat/' + chat + (before ? '?before=' + before : ''), { cookie: buyer.cookie })
  ).data;
  ids.push(...p.messages.map((m) => m.id));
  if (!p.hasMore) break;
  before = p.messages[0].id;
}
assert.equal(new Set(ids).size, 82);
checks++;
const after = (await api('/api/chat/' + chat + '?after=' + message.id, { cookie: buyer.cookie }))
  .data;
assert(after.messages.every((m) => m.id > message.id));
checks++;
let limited = false;
for (let i = 0; i < 35; i++) {
  const r = await fetch(base + '/api/chat/' + chat, {
    method: 'POST',
    headers: { Cookie: buyer.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Kiểm tra giới hạn ' + i })
  });
  if (r.status === 429) {
    limited = true;
    break;
  }
  assert.equal(r.status, 201);
}
assert(limited);
checks++;
if (process.env.TEST_SOCIAL_FIXTURES) {
  await mkdir(dirname(process.env.TEST_SOCIAL_FIXTURES), { recursive: true });
  await writeFile(
    process.env.TEST_SOCIAL_FIXTURES,
    JSON.stringify({ chat, roomId: rid, rootId: root.id })
  );
}
console.log(
  `PASS: ${checks} social checks: membership isolation, spoofing prevention, deduplication, read cursors, blocks, reports, replies/badges/notifications, 82-message pagination, rate limits.`
);
