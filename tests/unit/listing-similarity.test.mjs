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
