import { mysqlConnectionOptions } from '../../lib/mysql-options.js';
import '../lib/env.mjs';
// Export only the project's explicitly labelled demo rows and selected collected public listings.
import mysql from 'mysql2/promise';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
if (!process.env.MYSQL_URL || !process.env.REAL_LISTING_IDS_FILE)
  throw new Error('MYSQL_URL and REAL_LISTING_IDS_FILE required.');
const ids = JSON.parse(await readFile(process.env.REAL_LISTING_IDS_FILE, 'utf8'));
if (
  !Array.isArray(ids) ||
  ids.some((s) => typeof s !== 'string' || !s.startsWith('tromoi-da-nang:'))
)
  throw new Error('Only explicitly selected Trọ Mới listing IDs may be exported.');
const c = await mysql.createConnection(mysqlConnectionOptions());
const esc = mysql.escape;
const dir = process.env.EXPORT_DATA_DIR || 'database/seeds';
await mkdir(dir, { recursive: true });
function insert(table, row, omit = []) {
  const entries = Object.entries(row).filter(([k]) => !omit.includes(k));
  return (
    'INSERT IGNORE INTO `' +
    table +
    '` (' +
    entries.map(([k]) => '`' + k + '`').join(',') +
    ') VALUES (' +
    entries
      .map(([, v]) =>
        esc(
          v instanceof Date
            ? v.toISOString().slice(0, 19).replace('T', ' ')
            : typeof v === 'object' && v !== null
              ? JSON.stringify(v)
              : v
        )
      )
      .join(',') +
    ');'
  );
}
try {
  let sql =
    '-- Public listing snapshot, collected from Trọ Mới. Keep attribution and review before publication.\n-- Apply schema/migrations first. Existing rows are preserved.\nSET NAMES utf8mb4;\n';
  let count = 0;
  if (ids.length) {
    const [rows] = await c.query(
      'SELECT * FROM listings WHERE external_id IN (' + ids.map(() => '?').join(',') + ')',
      ids
    );
    for (const row of rows) {
      if (row.owner_external_id) throw new Error('Refusing to export user-owned listing.');
      sql += insert('listings', row, ['id']) + '\n';
      count++;
    }
    const [analyses] = await c.query(
      'SELECT * FROM listing_ai_analysis WHERE listing_id IN (' +
        ids.map(() => '?').join(',') +
        ')',
      ids
    );
    for (const row of analyses) sql += insert('listing_ai_analysis', row) + '\n';
  }
  await writeFile(dir + '/collected-listings.sql', sql);
  let demo =
    '-- Explicitly labelled sample users/comments. Accounts are locked and have random, undisclosed passwords.\n-- No admin or real testimonial accounts. Apply schema first. Idempotent inserts.\nSET NAMES utf8mb4;\n';
  const [users] = await c.query("SELECT * FROM users WHERE external_id LIKE 'demo-v10-%'");
  for (const row of users) demo += insert('users', row, ['id']) + '\n';
  const [controls] = await c.query("SELECT * FROM user_controls WHERE user_id LIKE 'demo-v10-%'");
  for (const row of controls) demo += insert('user_controls', row) + '\n';
  const [verifications] = await c.query(
    "SELECT * FROM landlord_verifications WHERE user_external_id LIKE 'demo-v10-%'"
  );
  for (const row of verifications) demo += insert('landlord_verifications', row) + '\n';
  const [posts] = await c.query(
    "SELECT p.*,u.external_id AS authorExternal FROM community_posts p JOIN users u ON u.id=p.author_id WHERE p.id LIKE 'demo-v10-discussion-%'"
  );
  for (const row of posts) {
    const entries = Object.entries(row).filter(
      ([k]) => !['author_id', 'authorExternal'].includes(k)
    );
    demo +=
      'INSERT IGNORE INTO community_posts (' +
      entries.map(([k]) => '`' + k + '`').join(',') +
      ',author_id) SELECT ' +
      entries
        .map(([, v]) => esc(v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : v))
        .join(',') +
      ',u.id FROM users u WHERE external_id=' +
      esc(row.authorExternal) +
      ';\n';
  }
  const [comments] = await c.query(
    "SELECT a.*,u.external_id AS authorExternal FROM community_comments a JOIN users u ON u.id=a.author_id WHERE a.id LIKE 'demo-v10-comment-%'"
  );
  for (const row of comments) {
    const entries = Object.entries(row).filter(
      ([k]) => !['author_id', 'authorExternal'].includes(k)
    );
    demo +=
      'INSERT IGNORE INTO community_comments (' +
      entries.map(([k]) => '`' + k + '`').join(',') +
      ',author_id) SELECT ' +
      entries
        .map(([, v]) => esc(v instanceof Date ? v.toISOString().slice(0, 19).replace('T', ' ') : v))
        .join(',') +
      ',u.id FROM users u WHERE external_id=' +
      esc(row.authorExternal) +
      ';\n';
  }
  await writeFile(dir + '/demo-data.sql', demo);
  console.log(
    JSON.stringify({
      realListings: count,
      demoUsers: users.length,
      demoPosts: posts.length,
      demoComments: comments.length,
      output: dir
    })
  );
} finally {
  await c.end();
}
