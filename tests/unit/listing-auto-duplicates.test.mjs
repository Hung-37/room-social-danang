import test from 'node:test';
import assert from 'node:assert/strict';
import { findAutoDuplicates, findSimilarListings } from '../../lib/server/collector/similarity.js';

const HASH_A = 'a'.repeat(64);
const HASH_B = 'f'.repeat(64);
const base = {
  id: 'a',
  title: 'Phòng trọ có gác lửng gần cầu Hòa Cầm full nội thất',
  summary: 'Phòng rộng rãi ban công thoáng mát bếp riêng vệ sinh chung giờ giấc tự do',
  address: 'Hòa Cầm, Hải Châu, Đà Nẵng',
  clusterId: 'hai-chau',
  url: 'https://tromoi.com/phong-tro/a',
};

test('auto-archives only near-identical copies with matching cover image', () => {
  const sameImage = { ...base, id: 'b', url: 'https://phongtro.vn/phong/123', imageHash: HASH_A };
  const otherImage = { ...base, id: 'c', url: 'https://phongtro.vn/phong/456', imageHash: HASH_B };
  const withA = { ...base, imageHash: HASH_A };

  const auto = findAutoDuplicates([withA, sameImage, otherImage]);
  assert.deepEqual(auto.map(pair => [pair.left, pair.right]), [['a', 'b']]);
  assert.ok(auto[0].score >= 0.95);
  assert.ok(auto[0].near >= 0.9);

  // Text lookalike without the same photo stays a manual suggestion only.
  const suggested = findSimilarListings([withA, sameImage, otherImage]);
  assert.ok(suggested.some(pair => pair.left === 'a' && pair.right === 'c'));
});

test('auto-duplicates require image hashes on both sides', () => {
  const noHash = { ...base, id: 'd', url: 'https://phongtro.vn/phong/789' };
  assert.deepEqual(findAutoDuplicates([{ ...base, imageHash: HASH_A }, noHash]), []);
});
