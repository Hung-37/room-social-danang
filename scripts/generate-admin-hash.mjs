import { randomBytes, scryptSync } from 'node:crypto';

const password = process.env.ADMIN_PASSWORD;
if (!password) {
  console.error('Thiếu biến môi trường ADMIN_PASSWORD. Hãy đặt biến này trước khi chạy script.');
  process.exitCode = 1;
} else {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  console.log(salt + ':' + hash);
}
