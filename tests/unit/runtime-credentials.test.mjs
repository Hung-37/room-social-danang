import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertProductionCredentials, getAdminCredentials } from '../../lib/server/runtime-credentials.js';

const names = ['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'USER_SESSION_SECRET'];
test('administrator has no default password in any environment', () => {
  for (const NODE_ENV of ['production', 'development', 'test', undefined]) {
    assert.equal(getAdminCredentials({ NODE_ENV }).password, '');
  }
  const password = randomBytes(32).toString('hex');
  assert.equal(getAdminCredentials({ ADMIN_PASSWORD: password }).password, password);
  assert.equal(getAdminCredentials({ NODE_ENV: 'production' }).email, '');
  assert.equal(getAdminCredentials({ NODE_ENV: 'development' }).email, 'developer@example.invalid');
});
test('production refuses each missing or blank credential without disclosing values', () => {
  const env = { NODE_ENV: 'production', ...Object.fromEntries(names.map(name => [name, randomBytes(32).toString('hex')])) };
  for (const name of names) for (const value of [undefined, '', '   ']) {
    assert.throws(() => assertProductionCredentials({ ...env, [name]: value }), error => {
      assert.ok(error.message.includes(name));
      for (const key of names) assert.ok(!error.message.includes(env[key]));
      return true;
    });
  }
  assert.doesNotThrow(() => assertProductionCredentials(env));
});

test('development does not require production credentials', () => {
  assert.doesNotThrow(() => assertProductionCredentials({ NODE_ENV: 'development' }));
});
