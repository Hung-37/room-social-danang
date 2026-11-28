import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { listingFeatures, pairFeatures } from "../../lib/server/collector/pair-features.js";
import { imageHash, withImageHashes } from "../../lib/server/collector/listing-image.js";
import reviewed from "../../data/fixtures/reviewed-listing-pairs.json" with { type: "json" };
import uncertain from "../../data/fixtures/uncertain-listing-pairs.json" with { type: "json" };

test("house number agreement requires a matching street; district and date alone are weak evidence", () => {
  const features = address => listingFeatures({ address, summary: "03/07/2020" });
  const compare = (a,b) => pairFeatures(features(a),features(b));
  assert.equal(compare("K123/97 Đường Cù Chính Lan", "k123/97 Cù Chính Lan, Thanh Khê")[5], 1);
  assert.equal(compare("36 Lê Văn Tâm", "38 Lê Văn Tâm")[5], -1);
  assert.equal(compare("36 Lê Văn Tâm", "36 Võ Nguyên Giáp")[5], 0);
  assert.deepEqual(compare("Quận Hải Châu", "Quận Hải Châu").slice(5), [0,1,1]);
  assert.equal(compare("Đường 2 Tháng 9", "Đường 2 Tháng 9")[5], 0);
});

test("cover hash survives encoding changes; blank and unavailable images are neutral", async () => {
  const raw = Buffer.from(Array.from({length: 128*128}, (_,i) => Math.round(127+100*Math.sin(i%128/9+Math.floor(i/128)/12))));
  const img = sharp(raw,{raw:{width:128,height:128,channels:1}});
  const a = listingFeatures({imageHash: await imageHash(await img.clone().png().toBuffer())});
  const b = listingFeatures({imageHash: await imageHash(await img.clone().jpeg().toBuffer())});
  assert.ok(pairFeatures(a,b)[3] > 0.85);
  const blank = await sharp({create:{width:32,height:32,channels:3,background:"white"}}).png().toBuffer();
  assert.equal(await imageHash(blank),null);
  const [missing] = await withImageHashes([{imageUrl:"https://invalid.example/cover.jpg"}]);
  assert.deepEqual(pairFeatures(a,listingFeatures(missing)).slice(3,5),[0,0]);
});

test("review snapshot has 22 labelled pairs and eight disjoint unlabelled pairs", () => {
  const all = [...reviewed,...uncertain];
  assert.equal(new Set(all.map(r => JSON.stringify([r.left,r.right].sort()))).size,30);
  assert.equal(reviewed.filter(r=>r.label===1).length,13);
  assert.equal(reviewed.filter(r=>r.label===0).length,9);
  assert.ok(uncertain.length===8 && uncertain.every(r=>!("label" in r)));
});
