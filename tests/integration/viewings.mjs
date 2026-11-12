// Writes fixtures and checks concurrency: isolated test database only.
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const base = process.env.TEST_BASE_URL;
if (
  !base ||
  !process.env.MYSQL_URL ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error(
    'Set TEST_BASE_URL, MYSQL_URL, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for an isolated database.'
  );
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
    status: 201,
    body: {
      name,
      email: `visit-${role}-${Math.random().toString(36).slice(2)}-${stamp}@test.local`,
      password: 'ViewingTest123!',
      role
    }
  });
}
const owner = await register('Chủ trọ Minh', 'landlord'),
  owner2 = await register('Chủ trọ Lan', 'landlord'),
  buyer = await register('An tìm phòng'),
  buyer2 = await register('Bình tìm phòng'),
  outsider = await register('Người ngoài');
const admin = await api('/api/auth/login', {
  method: 'POST',
  body: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }
});
for (const host of [owner, owner2])
  await api('/api/admin/landlords', {
    cookie: admin.cookie,
    method: 'PATCH',
    body: { id: host.data.id, status: 'verified' }
  });
async function room(host, title) {
  const r = (
    await api('/api/listings/create', {
      cookie: host.cookie,
      method: 'POST',
      status: 201,
      body: {
        title: title + ' ' + stamp,
        summary: 'Phòng thử nghiệm lịch hẹn, có cửa sổ và hợp đồng minh bạch.',
        address: 'Hải Châu, Đà Nẵng',
        price: 2500000,
        area: 25
      }
    })
  ).data.externalId;
  await api('/api/listings/' + r + '/status', {
    cookie: admin.cookie,
    method: 'POST',
    body: { status: 'verified' }
  });
  return r;
}
const room1 = await room(owner, 'Phòng thử lịch hướng Đông'),
  room2 = await room(owner2, 'Phòng thử lịch hướng Tây');
async function chat(user, listing) {
  return (
    await api('/api/chat', { cookie: user.cookie, method: 'POST', body: { listingId: listing } })
  ).data.id;
}
const first = await chat(buyer, room1),
  second = await chat(buyer2, room1),
  third = await chat(buyer, room2);
const when = new Date(Date.now() + 2 * 86400000);
when.setUTCSeconds(0, 0);
const start = when.toISOString();
async function request(user, conversation = first, startsAt = start, status = 201) {
  return (
    await api('/api/appointments', {
      cookie: user.cookie,
      method: 'POST',
      status,
      body: {
        conversationId: conversation,
        startsAt,
        note: 'Mình đi xem cùng bạn, xin chủ trọ xác nhận.'
      }
    })
  ).data;
}
async function change(user, visit, action, status = 200, version = visit.version) {
  return (
    await api('/api/appointments/' + visit.id, {
      cookie: user.cookie,
      method: 'PATCH',
      status,
      body: { action, version }
    })
  ).data;
}
await api('/api/appointments', { status: 401 });
await api('/api/appointments', { method: 'POST', body: {}, status: 401 });
await api('/api/appointments/missing', {
  method: 'PATCH',
  body: { action: 'cancel', version: 1 },
  status: 401
});
await api('/api/appointments?conversation=' + first, { cookie: outsider.cookie, status: 404 });
await request(outsider, first, start, 404);
await request(owner, first, start, 403);
await request(buyer, first, 'not-a-date', 400);
await request(buyer, first, new Date(Date.now() - 86400000).toISOString(), 400);
await request(buyer, first, new Date(Date.now() + 61 * 86400000).toISOString(), 400);
await request(buyer, first, '2026-02-31T09:00:00+07:00', 400);
await request(buyer, first, start.replace(/Z$/, ''), 400);
let one = await request(buyer);
await request(buyer, first, start, 409);
await change(outsider, one, 'confirm', 404);
await change(buyer, one, 'confirm', 403);
await change(owner, one, 'confirm', 409, 99);
await change(owner, one, 'complete', 409);
const stored = (await api('/api/appointments?conversation=' + first, { cookie: buyer.cookie }))
  .data[0];
assert.equal(stored.startsAt, start);
assert.equal(new Date(stored.endsAt) - new Date(stored.startsAt), 30 * 60000);
checks += 2;
const two = await request(buyer2, second);
async function attempt(visit) {
  const r = await fetch(base + '/api/appointments/' + visit.id, {
    method: 'PATCH',
    headers: { cookie: owner.cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'confirm', version: 1 })
  });
  return { status: r.status, body: await r.json(), visit };
}
const results = await Promise.all([attempt(one), attempt(two)]);
assert.deepEqual(results.map((r) => r.status).sort(), [200, 409], JSON.stringify(results));
checks++;
const accepted = results.find((r) => r.status === 200);
const rejected = results.find((r) => r.status === 409);
let confirmed = accepted.body.data;
const acceptedBuyer = accepted.visit.id === one.id ? buyer : buyer2;
const rejectedBuyer = acceptedBuyer === buyer ? buyer2 : buyer;
const rejectedChat = acceptedBuyer === buyer ? second : first;
await change(owner, confirmed, 'complete', 409);
await change(owner, confirmed, 'confirm', 409, 1);
// Cancellation remains available even while the conversation is blocked.
const acceptedChat = acceptedBuyer === buyer ? first : second;
await api('/api/chat/' + acceptedChat, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'block' }
});
await change(acceptedBuyer, confirmed, 'cancel');
await change(acceptedBuyer, { ...confirmed, version: confirmed.version + 1 }, 'cancel', 409);
await api('/api/chat/' + acceptedChat, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'unblock' }
});
confirmed = await change(owner, rejected.visit, 'confirm');
assert.equal(confirmed.status, 'confirmed');
checks++;
if (rejectedBuyer !== buyer) {
  await change(buyer2, confirmed, 'cancel');
  const activeRequest = await request(buyer, first);
  confirmed = await change(owner, activeRequest, 'confirm');
}
const otherHost = await request(buyer, third, new Date(when.getTime() + 15 * 60000).toISOString());
await change(owner2, otherHost, 'confirm', 409);
await change(owner2, otherHost, 'decline');
await api('/api/chat/' + first, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'block' }
});
await request(buyer, first, start, 409);
await api('/api/chat/' + first, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'unblock' }
});
await change(buyer, confirmed, 'cancel');
const proposal = await request(buyer, first);
await api('/api/chat/' + first, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'block' }
});
await change(owner, proposal, 'confirm', 409);
await change(buyer, proposal, 'cancel');
await api('/api/chat/' + first, {
  cookie: owner.cookie,
  method: 'PATCH',
  body: { action: 'unblock' }
});
await api('/api/listings/' + room1 + '/status', {
  cookie: admin.cookie,
  method: 'POST',
  body: { status: 'rejected' }
});
await request(buyer, first, start, 409);
await api('/api/listings/' + room1 + '/status', {
  cookie: admin.cookie,
  method: 'POST',
  body: { status: 'verified' }
});
const completedRequest = await request(buyer, first),
  completedConfirmed = await change(owner, completedRequest, 'confirm');
const c = await mysql.createConnection(process.env.MYSQL_URL);
try {
  await c.execute(
    'UPDATE viewing_appointments SET starts_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 HOUR),ends_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 30 MINUTE) WHERE id=?',
    [completedConfirmed.id]
  );
  await change(owner, completedConfirmed, 'complete');
  const history = (await api('/api/appointments?history=1', { cookie: buyer.cookie })).data;
  assert(history.some((v) => v.id === completedConfirmed.id && v.status === 'completed'));
  checks++;
  assert(!(await api('/api/appointments', { cookie: outsider.cookie })).data.length);
  checks++;
  // Seed 201 old conversations to ensure filtering occurs BEFORE the 200-result cap.
  const oldId = 'old-search-' + stamp;
  await c.execute(
    'INSERT INTO conversations(id,listing_id,room_title,buyer_id,seller_id,updated_at) VALUES (?,?,?,?,?,?)',
    [
      oldId,
      'fixture-old-' + stamp,
      'Phòng tìm sâu bí mật ' + stamp,
      buyer.data.id,
      owner.data.id,
      '2000-01-01 00:00:00'
    ]
  );
  for (let i = 0; i < 201; i++)
    await c.execute(
      'INSERT INTO conversations(id,listing_id,room_title,buyer_id,seller_id) VALUES (?,?,?,?,?)',
      [
        'new-search-' + stamp + '-' + i,
        'fixture-new-' + stamp + '-' + i,
        'Hội thoại khác ' + i,
        buyer.data.id,
        owner.data.id
      ]
    );
  assert(!(await api('/api/chat', { cookie: buyer.cookie })).data.some((v) => v.id === oldId));
  checks++;
  const q = encodeURIComponent('Phòng tìm sâu bí mật ' + stamp);
  assert.equal((await api('/api/chat?q=' + q, { cookie: buyer.cookie })).data[0].id, oldId);
  checks++;
  assert.equal((await api('/api/chat?q=' + q, { cookie: outsider.cookie })).data.length, 0);
  checks++;
  await api('/api/chat?q=' + encodeURIComponent('x'.repeat(101)), {
    cookie: buyer.cookie,
    status: 400
  });
  await api('/api/chat?filter=unknown', { cookie: buyer.cookie, status: 400 });
  const sent = (
    await api('/api/chat/' + first, {
      cookie: buyer.cookie,
      method: 'POST',
      status: 201,
      body: { text: 'Tiền điện 100% rõ ràng, có hợp đồng.' }
    })
  ).data;
  const unread = (await api('/api/chat?filter=unread', { cookie: owner.cookie })).data;
  assert(unread.some((v) => v.id === first));
  checks++;
  await api('/api/chat/' + first, {
    cookie: owner.cookie,
    method: 'PATCH',
    body: { action: 'read', upto: sent.id }
  });
  assert(
    !(await api('/api/chat?filter=unread', { cookie: owner.cookie })).data.some(
      (v) => v.id === first
    )
  );
  checks++;
  await api('/api/chat/' + first, {
    cookie: owner.cookie,
    method: 'PATCH',
    body: { action: 'block' }
  });
  assert(
    (await api('/api/chat?filter=blocked', { cookie: buyer.cookie })).data.some(
      (v) => v.id === first
    )
  );
  checks++;
  await api('/api/chat/' + first + '/search?q=điện', { status: 401 });
  await api('/api/chat/' + first + '/search?q=điện', { cookie: outsider.cookie, status: 404 });
  await api('/api/chat/' + first + '/search?q=x', { cookie: buyer.cookie, status: 400 });
  const match = (await api('/api/chat/' + first + '/search?q=100%25', { cookie: owner.cookie }))
    .data;
  assert.equal(match.messages[0].id, sent.id);
  checks++;
  const rows = Array.from({ length: 75 }, (_, i) => [
    first,
    buyer.data.id,
    'Từ khóa lịch hẹn ' + i
  ]);
  await c.query('INSERT INTO private_messages(conversation_id,sender_id,body) VALUES ?', [rows]);
  let before = 0,
    all = [];
  while (true) {
    const list = (
      await api(
        '/api/chat/' +
          first +
          '/search?q=' +
          encodeURIComponent('Từ khóa lịch hẹn') +
          (before ? '&before=' + before : ''),
        { cookie: buyer.cookie }
      )
    ).data;
    all.push(...list.messages.map((m) => m.id));
    if (!list.hasMore) break;
    before = list.messages.at(-1).id;
  }
  assert.equal(new Set(all).size, 75);
  checks++;
  await api('/api/chat/' + first, {
    cookie: owner.cookie,
    method: 'PATCH',
    body: { action: 'unblock' }
  });
  // Repeated simultaneous confirmations: seed requests to avoid testing the request rate limiter here.
  for (let round = 0; round < 10; round++) {
    const a = { id: `race-${stamp}-${round}-a`, version: 1 },
      b = { id: `race-${stamp}-${round}-b`, version: 1 };
    const t = new Date(when.getTime() + (round + 1) * 3600000),
      e = new Date(t.getTime() + 1800000),
      sql = (d) => d.toISOString().slice(0, 19).replace('T', ' ');
    await c.query(
      'INSERT INTO viewing_appointments(id,conversation_id,buyer_id,seller_id,starts_at,ends_at) VALUES ?',
      [
        [
          [a.id, first, buyer.data.id, owner.data.id, sql(t), sql(e)],
          [b.id, second, buyer2.data.id, owner.data.id, sql(t), sql(e)]
        ]
      ]
    );
    const race = await Promise.all([attempt(a), attempt(b)]);
    assert.deepEqual(race.map((v) => v.status).sort(), [200, 409], JSON.stringify(race));
    checks++;
    await change(owner, race.find((v) => v.status === 200).body.data, 'cancel');
    await change(owner, race.find((v) => v.status === 409).visit, 'decline');
  }
  const notif = (await api('/api/notifications', { cookie: owner.cookie })).data;
  assert(notif.some((n) => n.type === 'viewing'));
  checks++;
  if (process.env.TEST_VIEWING_FIXTURES) {
    await mkdir(dirname(process.env.TEST_VIEWING_FIXTURES), { recursive: true });
    await writeFile(
      process.env.TEST_VIEWING_FIXTURES,
      JSON.stringify({
        chat: first,
        room: room1,
        owner: owner.cookie,
        buyer: buyer.cookie,
        outsider: outsider.cookie
      })
    );
  }
} finally {
  await c.end();
}
console.log(
  `PASS: ${checks} viewing/search checks; participant access, UTC times, transitions, stale actions, concurrent overlap protection for both people, notifications, deep inbox search, unread/blocked filters, 75 search results pagination.`
);
