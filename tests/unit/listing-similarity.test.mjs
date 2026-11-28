import test from 'node:test';
import assert from 'node:assert/strict';
import { findSimilarListings } from '../../lib/server/collector/similarity.js';

test('rank near copies across URLs without flagging exact URLs or unrelated areas', () => {
  const base = { id: 'a', title: 'Phòng có gác gần cầu Hòa Cầm', summary: 'Ban công thoáng mát, bếp riêng', clusterId: 'cam-le', url: 'https://tromoi.com/phong-tro/a' };
  const matches = findSimilarListings([base,
    { ...base, id: 'b', title: 'Phong co gac gan cau Hoa Cam', url: 'https://tromoi.com/phong-tro/b' },
    { ...base, id: 'c', url: base.url + '?utm_source=test' },
    { ...base, id: 'd', clusterId: 'hai-chau' },
    { id: 'e', title: 'Studio bên biển Mỹ Khê có hồ bơi' }]);
  assert.ok(matches.some(pair => pair.left === 'a' && pair.right === 'b'));
  assert.ok(!matches.some(pair => pair.left === 'a' && pair.right === 'c'));
  assert.ok(matches.every(pair => !['d','e'].includes(pair.right) && pair.score <= 1));
  assert.deepEqual(findSimilarListings([{id:'x',title:''}, {id:'y',title:''}]), []);
});

test('collector review maps source URLs, reports the scanned batch and preserves input', async () => {
  const { reviewCollectedBatch } = await import('../../lib/server/collector/similarity.js');
  const first = { externalId: 'one', source: { url: 'https://example.com/room/1' },
    title: 'Phòng gác lửng gần cầu Hòa Cầm', summary: 'Phòng có bếp riêng và ban công', address: '36 Lê Văn Tâm' };
  const rows = [first, { ...first, externalId: 'two', source: { url: 'https://example.com/room/2' } }];
  const original = structuredClone(rows);
  const review = await reviewCollectedBatch(rows);
  assert.equal(review.similarityScanned, 2);
  assert.deepEqual(review.similarListings.map(p => [p.left, p.right]), [['one','two']]);
  assert.deepEqual(rows, original);
  assert.deepEqual(await reviewCollectedBatch([]), {similarityScanned: 0, similarListings: []});
});
