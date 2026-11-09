import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessAdmin,
  isValidEmail,
  isValidPassword,
  validateCommunityPost,
  validateListingInput
} from '../js/domain-policies.js';

test('auth policy accepts valid credentials and rejects malformed input', () => {
  assert.equal(isValidEmail('user@example.com'), true);
  assert.equal(isValidEmail('not-an-email'), false);
  assert.equal(isValidPassword('secret1'), true);
  assert.equal(isValidPassword('123'), false);
});

test('community policy requires a bounded title and body', () => {
  assert.equal(validateCommunityPost({ id: 'post-1', title: 'Tìm phòng', summary: 'Nội dung bài viết đủ dài để hợp lệ.' }), true);
  assert.equal(validateCommunityPost({ id: 'post-1', title: 'Ngắn', summary: 'quá ngắn' }), false);
});

test('listing policy requires valid address, price and area', () => {
  const listing = { title: 'Phòng gần trường', summary: 'Phòng sạch', address: 'Hải Châu', price: 2500000, area: 22 };
  assert.equal(validateListingInput(listing), true);
  assert.equal(validateListingInput({ ...listing, price: -1 }), false);
});

test('only admin role can access admin surfaces', () => {
  assert.equal(canAccessAdmin('admin'), true);
  assert.equal(canAccessAdmin('landlord'), false);
  assert.equal(canAccessAdmin('student'), false);
});
