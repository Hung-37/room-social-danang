import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, scryptSync } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const script = new URL('../../scripts/generate-admin-hash.mjs', import.meta.url);
function run(password) {
  return spawnSync(process.execPath, [fileURLToPath(script)], {
    encoding: 'utf8', env: { ...process.env, ADMIN_PASSWORD: password },
  });
}

test('admin hash script fails clearly without a password and emits no hash', () => {
  const result = run('');
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /ADMIN_PASSWORD/);
});

test('admin hash script emits only a salted hash compatible with user authentication', () => {
  const password = randomBytes(32).toString('hex');
  const first = run(password);
  const second = run(password);
  for (const result of [first, second]) {
    assert.equal(result.status, 0);
    assert.equal(result.stderr, '');
    assert.match(result.stdout, /^[a-f0-9]{32}:[a-f0-9]{128}\r?\n$/);
    assert.equal(result.stdout.includes(password), false);
    const [salt, hash] = result.stdout.trim().split(':');
    assert.equal(hash, scryptSync(password, salt, 64).toString('hex'));
  }
  assert.notEqual(first.stdout, second.stdout);
});
