// Explicitly isolated QA only: creates users/content and injects notification fixtures.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import mysql from "mysql2/promise";
const base = process.env.TEST_BASE_URL;
if (
  process.env.TEST_ISOLATED_DB !== "1" ||
  !base ||
  !["localhost", "127.0.0.1"].includes(new URL(base).hostname) ||
  !process.env.MYSQL_URL ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error(
    "Set TEST_ISOLATED_DB=1, localhost TEST_BASE_URL, isolated MYSQL_URL and TEST_ADMIN_EMAIL/PASSWORD.",
  );
const stamp = Date.now();
let checks = 0;
function equal(a, b) {
  assert.deepEqual(a, b);
  checks++;
}
async function api(
  path,
  { method = "GET", body, cookie = "", status = 200, key } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": "content-qa-" + stamp,
      cookie,
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const p = await r.json();
  equal(r.status, status);
  return {
    ...p,
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
async function register(label, role = "student") {
  return api("/api/auth/register", {
    method: "POST",
    status: 201,
    body: {
      name: "[Kiểm thử] " + label,
      email: `content-${label}-${stamp}@test.local`,
      password: "ContentTest123!",
      role,
    },
  });
}
const admin = await api("/api/auth/login", {
    method: "POST",
    body: {
      email: process.env.TEST_ADMIN_EMAIL,
      password: process.env.TEST_ADMIN_PASSWORD,
    },
  }),
  a = await register("tacgia"),
  b = await register("khac"),
  landlord = await register("chutro", "landlord");
await api("/api/admin/landlords", {
  method: "PATCH",
  cookie: admin.cookie,
  body: { id: landlord.data.id, status: "verified" },
});
const draft = {
  title: "[Kiểm thử] Thảo luận có chủ " + stamp,
  summary:
    "DỮ LIỆU TỔNG HỢP. Nội dung kiểm tra sửa, xóa và chống gửi lại. Không phải nhận xét thật.",
  clusterId: "hai-chau",
  postKind: "question",
};
await api("/api/me/posts", { status: 401 });
await api("/api/me/posts?offset=-1", { cookie: a.cookie, status: 400 });
await api("/api/community/posts", {
  method: "POST",
  cookie: a.cookie,
  body: draft,
  key: "bad",
  status: 400,
});
const key = randomUUID();
const created = await Promise.all(
  Array.from({ length: 8 }, () =>
    api("/api/community/posts", {
      method: "POST",
      cookie: a.cookie,
      body: draft,
      key,
      status: 201,
    }),
  ),
);
const id = created[0].data.id;
equal(new Set(created.map((p) => p.data.id)).size, 1);
equal(created.filter((p) => p.replayed).length, 7);
await api("/api/community/posts", {
  method: "POST",
  cookie: a.cookie,
  body: { ...draft, title: draft.title + " khác" },
  key,
  status: 409,
});
const other = await api("/api/community/posts", {
  method: "POST",
  cookie: b.cookie,
  body: { ...draft, authorName: "Giả mạo" },
  key,
  status: 201,
});
assert.notEqual(other.data.id, id);
checks++;
equal(other.data.authorName, b.data.name.slice(0, 40));
equal(
  (await api("/api/me/posts", { cookie: a.cookie })).data.items.map(
    (v) => v.id,
  ),
  [id],
);
equal(
  (await api("/api/me/posts", { cookie: b.cookie })).data.items.map(
    (v) => v.id,
  ),
  [other.data.id],
);
await api("/api/community/posts/" + id, {
  method: "PATCH",
  status: 401,
  body: { ...draft, version: 1 },
});
await api("/api/community/posts/" + id, {
  method: "PATCH",
  cookie: b.cookie,
  status: 404,
  body: { ...draft, version: 1 },
});
await api("/api/community/posts/" + id, {
  method: "DELETE",
  cookie: b.cookie,
  status: 404,
  body: { version: 1 },
});
await api("/api/community/posts/" + id + "/status", {
  method: "PATCH",
  cookie: admin.cookie,
  body: { status: "verified", version: 1 },
});
let own = (await api("/api/me/posts", { cookie: a.cookie })).data.items[0];
equal(own.version, 2);
const changed = {
  ...draft,
  title: draft.title + " đã sửa",
  version: own.version,
};
await api("/api/community/posts/" + id, {
  method: "PATCH",
  cookie: a.cookie,
  body: changed,
});
await api("/api/community/posts/" + id, { status: 404 });
await api("/api/community/posts/" + id + "/comments", { status: 404 });
await api("/api/community/posts/" + id, {
  method: "PATCH",
  cookie: a.cookie,
  status: 409,
  body: changed,
});
await api("/api/community/posts/" + id + "/status", {
  method: "PATCH",
  cookie: admin.cookie,
  status: 409,
  body: { status: "verified", version: 2 },
});
own = (await api("/api/me/posts", { cookie: a.cookie })).data.items[0];
equal(own.status, "needs_review");
equal(own.version, 3);
await api("/api/community/posts/" + id + "/status", {
  method: "PATCH",
  cookie: admin.cookie,
  body: { status: "verified", version: 3 },
});
await api("/api/community/posts/" + id);
const parent = (
  await api("/api/community/posts/" + id + "/comments", {
    method: "POST",
    cookie: a.cookie,
    status: 201,
    body: { text: "Bình luận riêng của tác giả để kiểm thử." },
  })
).data;
const reply = (
  await api("/api/community/posts/" + id + "/comments", {
    method: "POST",
    cookie: b.cookie,
    status: 201,
    body: {
      text: "Phản hồi của người khác được giữ lại.",
      parentId: parent.id,
    },
  })
).data;
equal(parent.isMine, true);
equal(parent.version, 1);
const anonymous = (await api("/api/community/posts/" + id + "/comments")).data;
equal(
  anonymous.every((v) => !v.isMine && !("authorExternalId" in v)),
  true,
);
const endpoint = "/api/community/posts/" + id + "/comments/" + parent.id;
await api(endpoint, {
  method: "PATCH",
  cookie: b.cookie,
  status: 404,
  body: { text: "Không có quyền sửa", version: 1 },
});
await api(endpoint, {
  method: "DELETE",
  cookie: b.cookie,
  status: 404,
  body: { version: 1 },
});
await api(endpoint, {
  method: "PATCH",
  cookie: a.cookie,
  status: 400,
  body: { text: "Không có phiên bản" },
});
await api(endpoint, {
  method: "PATCH",
  cookie: a.cookie,
  body: { text: "Nội dung bình luận sau chỉnh sửa.", version: 1 },
});
await api(endpoint, {
  method: "PATCH",
  cookie: a.cookie,
  status: 409,
  body: { text: "Ghi chồng bị chặn", version: 1 },
});
let comments = (
  await api("/api/community/posts/" + id + "/comments", { cookie: a.cookie })
).data;
equal(
  comments.find((v) => v.id === reply.id).parentText,
  "Nội dung bình luận sau chỉnh sửa.",
);
await api(endpoint, {
  method: "DELETE",
  cookie: a.cookie,
  body: { version: 2 },
});
const after = await api("/api/community/posts/" + id + "/comments");
equal(after.meta.total, 1);
equal(after.data[0].id, reply.id);
equal(after.data[0].parentText, "Bình luận đã được xóa");
equal(after.data[0].parentAuthor, "Thành viên");
await api("/api/community/posts/" + id + "/comments", {
  method: "POST",
  cookie: b.cookie,
  status: 409,
  body: { text: "Không trả lời bình luận đã xóa", parentId: parent.id },
});
await api("/api/community/posts/" + other.data.id + "/comments/" + reply.id, {
  method: "DELETE",
  cookie: b.cookie,
  status: 404,
  body: { version: 1 },
});
await api("/api/favorites", {
  method: "PUT",
  cookie: b.cookie,
  body: { id, saved: true },
});
await api("/api/community/posts/" + id, {
  method: "DELETE",
  cookie: a.cookie,
  status: 409,
  body: { version: 3 },
});
await api("/api/community/posts/" + id, {
  method: "DELETE",
  cookie: a.cookie,
  body: { version: 4 },
});
await api("/api/community/posts/" + id, { status: 404 });
await api("/api/community/posts/" + id + "/status", {
  method: "PATCH",
  cookie: admin.cookie,
  status: 404,
  body: { status: "verified" },
});
await api("/api/community/posts", {
  method: "POST",
  cookie: a.cookie,
  key,
  body: draft,
  status: 410,
});
equal(
  (await api("/api/favorites", { cookie: b.cookie })).data.some(
    (v) => v.id === id,
  ),
  false,
);
const db = await mysql.createConnection(process.env.MYSQL_URL);
try {
  const [deleted] = await db.query(
    "SELECT title,summary,deleted_at FROM community_posts WHERE id=?",
    [id],
  );
  equal(deleted[0].summary, "");
  assert(deleted[0].deleted_at);
  checks++;
  const [stored] = await db.query(
    "SELECT response_json,deleted FROM mutation_requests WHERE user_id=? AND scope='community_create' AND request_key=?",
    [a.data.id, key],
  );
  equal(stored[0].response_json, null);
  equal(Number(stored[0].deleted), 1);
  const [logs] = await db.query(
    "SELECT action FROM moderation_logs WHERE entity_id=? AND action IN ('owner_edited','owner_deleted')",
    [id],
  );
  equal(logs.length, 2);
  const roomDraft = {
    title: "[Kiểm thử] Phòng chống gửi trùng " + stamp,
    summary: draft.summary,
    address: "Hải Châu, Đà Nẵng",
    price: "2500000",
    area: "25.5",
    clusterId: "hai-chau",
  };
  const roomKey = randomUUID();
  const rooms = await Promise.all(
    Array.from({ length: 8 }, () =>
      api("/api/listings/create", {
        method: "POST",
        cookie: landlord.cookie,
        key: roomKey,
        body: roomDraft,
        status: 201,
      }),
    ),
  );
  const roomId = rooms[0].data.externalId;
  equal(new Set(rooms.map((v) => v.data.externalId)).size, 1);
  equal(rooms.filter((v) => v.replayed).length, 7);
  await api("/api/listings/create", {
    method: "POST",
    cookie: landlord.cookie,
    key: roomKey,
    body: { ...roomDraft, price: 3000000 },
    status: 409,
  });
  const retryKey = randomUUID();
  await api("/api/listings/create", {
    method: "POST",
    cookie: landlord.cookie,
    key: retryKey,
    body: { ...roomDraft, imageIds: ["does-not-exist"] },
    status: 400,
  });
  await api("/api/listings/create", {
    method: "POST",
    cookie: landlord.cookie,
    key: retryKey,
    body: roomDraft,
    status: 201,
  });
  await api("/api/listings/" + roomId + "/status", {
    method: "POST",
    cookie: admin.cookie,
    body: { status: "rejected" },
  });
  await api("/api/admin/listings/" + roomId, {
    method: "DELETE",
    cookie: admin.cookie,
    body: { reason: "Tin tổng hợp kiểm thử được xóa sau kiểm tra." },
  });
  await api("/api/listings/create", {
    method: "POST",
    cookie: landlord.cookie,
    key: roomKey,
    body: roomDraft,
    status: 410,
  });
  await api("/api/community/posts", {
    method: "POST",
    cookie: landlord.cookie,
    key: roomKey,
    body: draft,
    status: 201,
  });
  // Pagination remains scoped to the author, including pending/rejected posts.
  for (let i = 0; i < 21; i++)
    await api("/api/community/posts", {
      method: "POST",
      cookie: a.cookie,
      body: { ...draft, title: "[Kiểm thử] Trang riêng " + stamp + " " + i },
      status: 201,
    });
  const first = (await api("/api/me/posts", { cookie: a.cookie })).data,
    last = (await api("/api/me/posts?offset=20", { cookie: a.cookie })).data;
  equal(first.items.length, 20);
  equal(first.hasMore, true);
  equal(last.items.length, 1);
  equal(new Set([...first.items, ...last.items].map((v) => v.id)).size, 21);
  // More than 50 notifications: badge count includes the older unread items.
  const [uids] = await db.query("SELECT id FROM users WHERE external_id=?", [
    a.data.id,
  ]);
  for (let i = 0; i < 55; i++)
    await db.execute(
      "INSERT INTO notifications(user_id,type,title,body,href) VALUES (?,'test',?,'Dữ liệu tổng hợp','/profile')",
      [uids[0].id, "[Kiểm thử] Thông báo riêng " + stamp + " " + i],
    );
  const n = await api("/api/notifications", { cookie: a.cookie });
  equal(n.data.length, 50);
  assert(n.meta.unreadCount >= 55);
  checks++;
  const nid = String(n.data[0].id);
  await api("/api/notifications/" + nid, { method: "PATCH", status: 401 });
  await api("/api/notifications/" + nid, {
    method: "PATCH",
    cookie: b.cookie,
    status: 404,
  });
  await api("/api/notifications/" + nid, {
    method: "DELETE",
    cookie: b.cookie,
    status: 404,
  });
  await api("/api/notifications/" + nid, { method: "PATCH", cookie: a.cookie });
  await api("/api/notifications/" + nid, { method: "PATCH", cookie: a.cookie });
  const marked = await api("/api/notifications", { cookie: a.cookie });
  equal(marked.meta.unreadCount, n.meta.unreadCount - 1);
  await api("/api/notifications/" + nid, {
    method: "DELETE",
    cookie: a.cookie,
  });
  equal(
    (await api("/api/notifications", { cookie: a.cookie })).data.some(
      (v) => String(v.id) === nid,
    ),
    false,
  );
  await api("/api/notifications", { method: "PATCH", cookie: a.cookie });
  equal(
    (await api("/api/notifications", { cookie: a.cookie })).meta.unreadCount,
    0,
  );
  await api("/api/notifications/invalid", {
    method: "DELETE",
    cookie: a.cookie,
    status: 400,
  });
  const ui = await api("/api/community/posts", {
    method: "POST",
    cookie: a.cookie,
    key: randomUUID(),
    body: { ...draft, title: "[Kiểm thử] UI quyền tác giả " + stamp },
    status: 201,
  });
  await api("/api/community/posts/" + ui.data.id + "/status", {
    method: "PATCH",
    cookie: admin.cookie,
    body: { status: "verified" },
  });
  const uiComment = (
    await api("/api/community/posts/" + ui.data.id + "/comments", {
      method: "POST",
      cookie: a.cookie,
      body: { text: "Bình luận UI có quyền sở hữu." },
      status: 201,
    })
  ).data;
  for (let i = 0; i < 2; i++)
    await db.execute(
      "INSERT INTO notifications(user_id,type,title,body,href) VALUES (?,'test',?,'Thông báo tổng hợp dành riêng cho kiểm thử UI','/profile')",
      [uids[0].id, "[Kiểm thử] Thông báo riêng " + stamp + " UI " + i],
    );
  if (process.env.TEST_CONTENT_FIXTURES)
    await writeFile(
      process.env.TEST_CONTENT_FIXTURES,
      JSON.stringify({
        base,
        admin: admin.cookie,
        author: a.cookie,
        other: b.cookie,
        landlord: landlord.cookie,
        post: ui.data,
        comment: uiComment,
        stamp,
      }),
      { mode: 0o600 },
    );
} finally {
  await db.end();
}
console.log(
  `PASS: ${checks} content checks: owner edit/delete, re-review, stale versions, comment reply privacy, DB idempotency concurrent/retry/conflict/rollback/deletion, private pagination, individual notifications and unread totals.`,
);
