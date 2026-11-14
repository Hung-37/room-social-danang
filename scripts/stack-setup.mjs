import { randomBytes } from 'node:crypto';
import { writeFileSync, existsSync } from 'node:fs';
const destination = new URL('../.env.docker', import.meta.url);
if (existsSync(destination)) {
  console.log('Keeping existing .env.docker.');
} else {
  const secret = () => randomBytes(32).toString('hex');
  writeFileSync(destination, [
    'MYSQL_ROOT_PASSWORD=' + secret(),
    'MYSQL_PASSWORD=' + secret(),
    'ADMIN_EMAIL=admin@roomdanang.local',
    'ADMIN_PASSWORD=' + secret(),
    'ADMIN_SESSION_SECRET=' + secret(),
    'USER_SESSION_SECRET=' + secret(),
    'WEB_PORT=3000',
    ''
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  console.log('Created .env.docker. Read admin credentials locally in that file; do not commit it.');
}
