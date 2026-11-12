// Writes fixtures. Use a dedicated test database matching TEST_BASE_URL, never production.
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
    'Set TEST_BASE_URL, MYSQL_URL, TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD for an isolated test database.'
  );
let checks = 0;
async function request(path, { cookie = '', method = 'GET', body, status = 200 } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  checks++;
  return {
    data,
    cookie: response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
  };
}
const stamp = Date.now();
const admin = await request('/api/auth/login', {
  method: 'POST',
  body: { email: process.env.TEST_ADMIN_EMAIL, password: process.env.TEST_ADMIN_PASSWORD }
});
const user = await request('/api/auth/register', {
  method: 'POST',
  body: {
    name: 'Người dùng kiểm thử',
    email: `comments-${stamp}@test.local`,
    password: 'CommentTest123!',
    role: 'student'
  },
  status: 201
});
const connection = await mysql.createConnection(process.env.MYSQL_URL);
const publicId = `regression-${stamp}-old`,
  pendingId = `regression-${stamp}-pending`,
  rejectedId = `regression-${stamp}-rejected`,
  roomId = `regression-${stamp}-room`,
  staleId = `regression-${stamp}-stale`;
const title = '[Kiểm thử] Câu hỏi từ đầu học kỳ ' + stamp;
try {
  await connection.query(
    'INSERT INTO community_posts (id,title,summary,cluster_id,post_kind,status,updated_at) VALUES ?',
    [
      Array.from({ length: 56 }, (_, i) => [
        i === 0 ? publicId : `regression-${stamp}-new-${i}`,
        i === 0 ? title : `[Kiểm thử] Thảo luận mới ${i}`,
        'Nội dung kiểm thử cho phân trang, chi tiết và quyền xem bình luận.',
        'hai-chau',
        'question',
        'verified',
        new Date(Date.now() - (56 - i) * 60000)
      ])
    ]
  );
  await connection.query(
    'INSERT INTO community_posts (id,title,summary,cluster_id,status) VALUES ?',
    [
      ['pending', 'rejected'].map((status, i) => [
        i ? rejectedId : pendingId,
        'Bài chưa công khai',
        'Nội dung không được lộ ra API phụ.',
        'hai-chau',
        status === 'pending' ? 'needs_review' : 'rejected'
      ])
    ]
  );
  await connection.query(
    'INSERT INTO listings (external_id,title,summary,price,area_m2,address,cluster_id,verification_status,updated_at) VALUES ?',
    [
      [
        [
          roomId,
          '[Kiểm thử] Phòng đã duyệt',
          'Nội dung phòng kiểm thử bình luận SQL.',
          2500000,
          25,
          'Hải Châu, Đà Nẵng',
          'hai-chau',
          'verified',
          new Date()
        ],
        [
          staleId,
          'Phòng hết hạn',
          'Nội dung cũ không được công khai.',
          2000000,
          20,
          'Đà Nẵng',
          'hai-chau',
          'verified',
          new Date('2020-01-01')
        ]
      ]
    ]
  );
  await request('/api/community/posts?includePending=true', { status: 401 });
  const publicAdmin = (await request('/api/community/posts?limit=50', { cookie: admin.cookie }))
    .data.data;
  assert(!publicAdmin.some((p) => p.id === pendingId));
  checks++;
  const moderation = (
    await request('/api/community/posts?limit=50&includePending=true', { cookie: admin.cookie })
  ).data.data;
  assert(moderation.some((p) => p.id === pendingId));
  checks++;
  const feed = (await request('/api/community/posts?limit=50')).data.data;
  assert(!feed.some((p) => p.id === publicId));
  checks++;
  assert.equal((await request(`/api/community/posts/${publicId}`)).data.data.title, title);
  checks++;
  for (const id of [pendingId, rejectedId, staleId, 'missing-thread']) {
    for (const suffix of ['', '/comments', '/interactions'])
      await request(`/api/community/posts/${id}${suffix}`, { status: 404 });
    await request(`/api/community/posts/${id}/comments`, {
      method: 'POST',
      cookie: user.cookie,
      body: { text: 'Không được phép ghi ở đây' },
      status: 404
    });
    await request(`/api/community/posts/${id}/interactions`, {
      method: 'POST',
      cookie: user.cookie,
      body: { reaction: 'like' },
      status: 404
    });
  }
  await request(`/api/community/posts/${publicId}/comments`, {
    method: 'POST',
    body: { text: 'Ẩn danh' },
    status: 401
  });
  await request(`/api/community/posts/${publicId}/comments`, {
    method: 'POST',
    cookie: user.cookie,
    body: null,
    status: 400
  });
  const commentIds = [];
  for (let start = 0; start < 105; start += 5)
    await Promise.all(
      Array.from({ length: Math.min(5, 105 - start) }, async (_, j) => {
        const text = `Bình luận ${start + j} cho kiểm thử hơn 100 phản hồi`;
        const saved = await request(`/api/community/posts/${publicId}/comments`, {
          method: 'POST',
          cookie: user.cookie,
          body: { text },
          status: 201
        });
        assert.equal(saved.data.data.text, text);
        checks++;
        commentIds.push(saved.data.data.id);
      })
    );
  const defaultPage = (await request(`/api/community/posts/${publicId}/comments`)).data;
  assert.equal(defaultPage.data.length, 20);
  assert.equal(defaultPage.meta.total, 105);
  checks += 2;
  const returned = [];
  for (let offset = 0; offset < 105; offset += 20) {
    const p = (await request(`/api/community/posts/${publicId}/comments?limit=20&offset=${offset}`))
      .data;
    returned.push(...p.data.map((c) => c.id));
    assert.equal(p.meta.total, 105);
    checks++;
  }
  assert.equal(new Set(returned).size, 105);
  assert.deepEqual(new Set(returned), new Set(commentIds));
  checks += 2;
  const roomComment = await request(`/api/community/posts/${roomId}/comments`, {
    method: 'POST',
    cookie: user.cookie,
    body: { text: 'Phòng có chỗ để xe không?' },
    status: 201
  });
  assert.equal(roomComment.data.data.text, 'Phòng có chỗ để xe không?');
  checks++;
  assert.equal((await request(`/api/community/posts/${roomId}/comments`)).data.meta.total, 1);
  checks++;
  const rooms = (await request('/api/listings?q=' + encodeURIComponent('Phòng đã duyệt'))).data
    .data;
  assert.equal(rooms.find((r) => r.externalId === roomId).commentCount, 1);
  checks++;
  await request(`/api/community/posts/${roomId}/interactions`, {
    method: 'POST',
    cookie: user.cookie,
    body: { reaction: 'like' }
  });
  assert.equal((await request(`/api/community/posts/${roomId}/interactions`)).data.data.total, 1);
  checks++;
  await request(`/api/community/posts/${publicId}/status`, {
    method: 'PATCH',
    cookie: admin.cookie,
    body: { status: 'rejected' }
  });
  for (const suffix of ['', '/comments', '/interactions'])
    await request(`/api/community/posts/${publicId}${suffix}`, { status: 404 });
  await request(`/api/community/posts/${publicId}/status`, {
    method: 'PATCH',
    cookie: admin.cookie,
    body: { status: 'verified' }
  });
  if (process.env.TEST_FIXTURE_FILE) {
    await mkdir(dirname(process.env.TEST_FIXTURE_FILE), { recursive: true });
    await writeFile(
      process.env.TEST_FIXTURE_FILE,
      JSON.stringify({ publicId, roomId, pendingId, rejectedId, title }, null, 2)
    );
  }
  console.log(
    `PASS: ${checks} regression assertions; 4 reported bugs fixed, complete 105-comment pagination, correct saved payload, room SQL comments/counts/reactions, hidden and stale parent access blocked.`
  );
} finally {
  await connection.end();
}
