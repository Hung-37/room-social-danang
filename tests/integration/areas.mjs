// Creates only its own fixtures; isolated database and matching server required.
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
const base = process.env.TEST_BASE_URL;
if (!base || !process.env.MYSQL_URL)
  throw new Error(
    "Set TEST_BASE_URL and MYSQL_URL for an isolated test database.",
  );
const db = await mysql.createConnection(process.env.MYSQL_URL);
const prefix = "areas-" + Date.now() + "-";
let checks = 0;
async function page(path, expected = 200) {
  const response = await fetch(base + path);
  assert.equal(response.status, expected, path);
  checks++;
  return response.text();
}
try {
  await db.query(
    `INSERT INTO listings(external_id,title,summary,address,cluster_id,verification_status,updated_at) VALUES ?`,
    [
      [
        [
          prefix + "room",
          "Phòng thử khu vực Cẩm Lệ",
          "Nội dung tổng hợp kiểm thử riêng",
          "Lê Thạch, Hòa An, Cẩm Lệ",
          "cam-le",
          "verified",
          new Date(),
        ],
        [
          prefix + "pending",
          "Tin chưa duyệt riêng tư",
          "Nội dung không được công khai",
          "Hòa An, Cẩm Lệ",
          "cam-le",
          "needs_review",
          new Date(),
        ],
        [
          prefix + "old",
          "Tin cũ đã hết hạn",
          "Nội dung không được công khai",
          "Cẩm Lệ",
          "cam-le",
          "verified",
          new Date("2020-01-01"),
        ],
        [
          prefix + "other",
          "Phòng thuộc Sơn Trà",
          "Nội dung tổng hợp kiểm thử riêng",
          "Sơn Trà",
          "son-tra",
          "verified",
          new Date(),
        ],
      ],
    ],
  );
  await db.query(
    "INSERT INTO community_posts(id,title,summary,cluster_id,cluster_name,post_kind,author_name,status) VALUES(?,?,?,?,?,'question','Kiểm thử','verified')",
    [
      prefix + "post",
      "Câu hỏi thử khu vực Cẩm Lệ",
      "Nội dung thảo luận kiểm thử",
      "cam-le",
      "Cẩm Lệ",
    ],
  );
  const short = await page("/cum"),
    long = await page("/khu-vuc");
  for (const html of [short, long]) {
    assert(html.includes("Tìm phòng theo khu vực"));
    checks++;
    for (const id of [
      "cam-le",
      "son-tra",
      "hoa-vang",
      "hai-chau",
      "chua-phan-cum",
    ]) {
      assert(html.includes("/cum/" + id));
      checks++;
    }
    assert(!html.includes("Chưa có dữ liệu"));
    checks++;
  }
  let detail = await page("/cum/cam-le");
  for (const text of [
    "Phòng thử khu vực Cẩm Lệ",
    "Câu hỏi thử khu vực Cẩm Lệ",
  ]) {
    assert(detail.includes(text));
    checks++;
  }
  for (const text of [
    "Tin chưa duyệt riêng tư",
    "Tin cũ đã hết hạn",
    "Phòng thuộc Sơn Trà",
  ]) {
    assert(!detail.includes(text));
    checks++;
  }
  const sontra = await page("/cum/son-tra");
  assert(sontra.includes("Phòng thuộc Sơn Trà"));
  checks++;
  await page("/cum/khong-co-khu-vuc-nay", 404);
  await page("/cum/chua-phan-cum");
  // Direct database changes must be reflected immediately, without rebuilding.
  await db.query(
    "UPDATE listings SET cluster_id='hai-chau',updated_at=updated_at WHERE external_id=?",
    [prefix + "room"],
  );
  detail = await page("/cum/cam-le");
  assert(!detail.includes("Phòng thử khu vực Cẩm Lệ"));
  checks++;
  assert((await page("/cum/hai-chau")).includes("Phòng thử khu vực Cẩm Lệ"));
  checks++;
  console.log(
    `PASS: ${checks} area checks: /cum and /khu-vuc, area links, approved fresh listings, discussions, no private/expired/cross-area leaks, invalid area 404, live database changes.`,
  );
} finally {
  await db.query("DELETE FROM community_posts WHERE id LIKE ?", [prefix + "%"]);
  await db.query("DELETE FROM listings WHERE external_id LIKE ?", [
    prefix + "%",
  ]);
  await db.end();
}
