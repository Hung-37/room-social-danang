// Generates labelled synthetic pictures/rooms. Isolated database/server only.
import assert from "node:assert/strict";
import sharp from "sharp";
import mysql from "mysql2/promise";
import { writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.XDG_CACHE_HOME ||= join(tmpdir(), "room-photo-test-cache");
await mkdir(process.env.XDG_CACHE_HOME, { recursive: true });
const base = process.env.TEST_BASE_URL,
  fixture = process.env.TEST_PHOTO_FIXTURES;
if (
  !base ||
  !fixture ||
  !process.env.MYSQL_URL ||
  !process.env.TEST_ADMIN_EMAIL ||
  !process.env.TEST_ADMIN_PASSWORD
)
  throw new Error(
    "Set isolated TEST_BASE_URL/MYSQL_URL, TEST_ADMIN_EMAIL/PASSWORD and TEST_PHOTO_FIXTURES.",
  );
let checks = 0;
async function api(
  path,
  { method = "GET", body, cookie = "", status = 200 } = {},
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const p = await r.json();
  assert.equal(r.status, status, path + JSON.stringify(p));
  checks++;
  return {
    data: p.data,
    cookie: r.headers
      .getSetCookie()
      .map((v) => v.split(";")[0])
      .join("; "),
  };
}
const stamp = Date.now();
const admin = await api("/api/auth/login", {
  method: "POST",
  body: {
    email: process.env.TEST_ADMIN_EMAIL,
    password: process.env.TEST_ADMIN_PASSWORD,
  },
});
const owner = await api("/api/auth/register", {
  method: "POST",
  status: 201,
  body: {
    name: "Chủ trọ kiểm thử ảnh",
    email: `photos-${stamp}@test.local`,
    password: "PhotosTest123!",
    role: "landlord",
  },
});
await api("/api/admin/landlords", {
  method: "PATCH",
  cookie: admin.cookie,
  body: { id: owner.data.id, status: "verified" },
});
async function upload(width, height, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/><rect x="20" y="20" width="${width - 40}" height="${height - 40}" rx="20" fill="none" stroke="#173b32" stroke-width="16"/><rect x="${width * 0.2}" y="${height * 0.25}" width="${width * 0.6}" height="${height * 0.5}" fill="#faf3df"/><text x="50%" y="50%" text-anchor="middle" font-size="${Math.min(width, height) / 12}" font-family="sans-serif" fill="#173b32">KIEM THU ANH</text><text x="50%" y="62%" text-anchor="middle" font-size="${Math.min(width, height) / 18}" fill="#173b32">${width} x ${height}</text></svg>`;
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  const form = new FormData();
  form.append(
    "file",
    new Blob([buffer], { type: "image/png" }),
    "synthetic-room.png",
  );
  const r = await fetch(base + "/api/images", {
    method: "POST",
    headers: { cookie: owner.cookie },
    body: form,
  });
  const p = await r.json();
  assert.equal(r.status, 201, JSON.stringify(p));
  checks++;
  return p.data;
}
const images = [];
for (const [w, h, c] of [
  [1600, 1200, "#b3d2bc"],
  [800, 1400, "#a9cddc"],
  [2400, 600, "#e0c792"],
  [320, 240, "#d6b4bf"],
])
  images.push(await upload(w, h, c));
const portrait = await upload(800, 1400, "#a9cddc"),
  panorama = await upload(2400, 600, "#e0c792");
const rooms = {};
for (const [kind, ids] of [
  ["gallery", images.map((i) => i.id)],
  ["portrait", [portrait.id]],
  ["panorama", [panorama.id]],
  ["broken", []],
  ["empty", []],
]) {
  const listing = await api("/api/listings/create", {
    method: "POST",
    status: 201,
    cookie: owner.cookie,
    body: {
      title: `[Kiểm thử] Ảnh ${kind} ${stamp}`,
      summary:
        "DỮ LIỆU TỔNG HỢP kiểm thử cách căn ảnh. Đây không phải tin cho thuê thực tế.",
      address: "Hải Châu, Đà Nẵng",
      clusterId: "hai-chau",
      price: 2500000,
      area: 25,
      imageIds: ids,
    },
  });
  rooms[kind] = listing.data.externalId;
  await api(`/api/listings/${rooms[kind]}/status`, {
    method: "POST",
    cookie: admin.cookie,
    body: { status: "verified" },
  });
}
const db = await mysql.createConnection(process.env.MYSQL_URL);
try {
  await db.query("UPDATE listings SET image_url=? WHERE external_id=?", [
    "/api/images/nonexistent-photo-fixture",
    rooms.broken,
  ]);
} finally {
  await db.end();
}
for (const image of [...images, portrait, panorama]) {
  const r = await fetch(base + image.url);
  assert.equal(r.status, 200);
  checks++;
  const meta = await sharp(Buffer.from(await r.arrayBuffer())).metadata();
  assert.equal(meta.format, "webp");
  checks++;
  assert(meta.width <= 1600 && meta.height <= 1600);
  checks++;
}
const details = await api("/api/community/posts/" + rooms.gallery);
assert.deepEqual(
  details.data.imageUrls,
  images.map((image) => image.url),
);
checks++;
await writeFile(
  fixture,
  JSON.stringify(
    { base, owner: owner.cookie, admin: admin.cookie, rooms, images },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log(
  `PASS: ${checks} photo API checks; labelled landscape, portrait, panorama, small, missing/broken photos; uploads normalized without stretching, gallery order and public access. Isolated QA fixtures only.`,
);
