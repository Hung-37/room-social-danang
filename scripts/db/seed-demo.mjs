import { mysqlConnectionOptions } from '../../lib/mysql-options.js';
import '../lib/env.mjs';
// Explicitly labelled sample data; does not create an administrator or usable demo password.
import mysql from 'mysql2/promise';
import { randomBytes, scryptSync } from 'node:crypto';
if (!process.env.MYSQL_URL) throw new Error('MYSQL_URL required.');
const c = await mysql.createConnection(mysqlConnectionOptions());
try {
  await c.beginTransaction();
  const names = [
    'An tìm phòng',
    'Bình sinh viên',
    'Chi đi làm',
    'Dũng tìm ở ghép',
    'Hà sinh viên',
    'Linh tìm phòng',
    'Chủ trọ Minh',
    'Chủ trọ Lan'
  ];
  for (const [i, name] of names.entries()) {
    const id = 'demo-v10-' + (i + 1),
      salt = randomBytes(16).toString('hex'),
      hash = salt + ':' + scryptSync(randomBytes(32).toString('hex'), salt, 64).toString('hex');
    await c.execute(
      'INSERT IGNORE INTO users(external_id,name,email,password_hash,role) VALUES (?,?,?,?,?)',
      [
        id,
        '[Mẫu] ' + name,
        'mau-' + (i + 1) + '@demo.room.invalid',
        hash,
        i < 6 ? 'student' : 'landlord'
      ]
    );
    await c.execute(
      "INSERT INTO user_controls(user_id,blocked,is_demo,reason,updated_by) VALUES (?,1,1,'Tài khoản dữ liệu mẫu, không dùng đăng nhập.','demo-seed') ON DUPLICATE KEY UPDATE blocked=1,is_demo=1",
      [id]
    );
    if (i >= 6)
      await c.execute(
        "INSERT IGNORE INTO landlord_verifications(user_external_id,status) VALUES (?,'pending')",
        [id]
      );
  }
  const [rows] = await c.query(
    "SELECT id,external_id,name FROM users WHERE external_id LIKE 'demo-v10-%'"
  );
  const users = new Map(rows.map((r) => [r.external_id, r]));
  const posts = [
    [
      'demo-v10-discussion-1',
      '[Mẫu] Cần hỏi gì trước khi đi xem phòng?',
      '[Dữ liệu mẫu] Chủ đề minh họa cách đặt câu hỏi về giá thuê, chi phí điện nước và lịch xem phòng. Đây không phải đánh giá của người thuê thật.'
    ],
    [
      'demo-v10-discussion-2',
      '[Mẫu] Chuẩn bị thông tin trước khi thuê chung',
      '[Dữ liệu mẫu] Chủ đề minh họa trao đổi nội quy, hợp đồng và nhu cầu ở ghép. Các tài khoản bên dưới là dữ liệu mẫu.'
    ]
  ];
  for (const [id, title, summary] of posts)
    await c.execute(
      "INSERT IGNORE INTO community_posts(id,title,summary,cluster_id,cluster_name,post_kind,author_id,author_name,status,trust_score) VALUES (?,?,?,'hai-chau','Hải Châu','question',?,?,'verified',0)",
      [id, title, summary, users.get('demo-v10-1').id, users.get('demo-v10-1').name]
    );
  const questions = [
    'Mình cần hỏi rõ giá thuê và những khoản phí nào?',
    'Nên xác nhận lịch xem phòng trực tiếp với chủ trọ trước.',
    'Cần xem nội dung hợp đồng và điều kiện hoàn cọc.',
    'Mình muốn tìm hiểu quy định về giờ giấc và giữ xe.',
    'Chi phí điện nước và internet nên được ghi rõ.',
    'Có thể hỏi về số người ở tối đa và nội quy chung.',
    'Hãy kiểm tra hiện trạng phòng trước khi quyết định.',
    'Những thông tin còn thiếu có thể hỏi trong hội thoại riêng.'
  ];
  for (let i = 0; i < 16; i++) {
    const user = users.get('demo-v10-' + ((i % 8) + 1));
    await c.execute(
      'INSERT IGNORE INTO community_comments(id,post_id,author_id,author_name,body) VALUES (?,?,?,?,?)',
      [
        'demo-v10-comment-' + (i + 1),
        posts[i % 2][0],
        user.id,
        user.name,
        '[Dữ liệu mẫu] ' + questions[i % questions.length]
      ]
    );
  }
  await c.commit();
  console.log(
    'Demo ready: 8 labelled, locked sample accounts; 2 labelled threads; 16 labelled sample comments. Idempotent; no real testimonials.'
  );
} catch (e) {
  await c.rollback();
  throw e;
} finally {
  await c.end();
}
