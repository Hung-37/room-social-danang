import { readFileSync, writeFileSync } from "node:fs";
import { predict } from "../lib/server/collector/pair-features.js";

const data = JSON.parse(readFileSync(new URL("../data/fixtures/reviewed-listing-pairs.json", import.meta.url)));
const baseline = {
  weights: [2.7989266972734947, 4.5101366468060915, 3.527143495335126],
  bias: -6.044009926994489, threshold: 0.7
};
// Freeze the shipped text weights and intercept. Learn regularized corrections
// for photo and address evidence at the existing shortlist threshold.
function fit(rows) {
  const prior = [...baseline.weights, 0, 0, 0, 0, 0];
  const model = { weights: [...prior], bias: baseline.bias, threshold: baseline.threshold };
  const positives = rows.filter(r => r.label).length;
  for (let epoch = 0; epoch < 1600; epoch++) {
    const grad = prior.map(() => 0);

    for (const { features, label } of rows) {
      const error = (predict(features, model) - label) / (2 * (label ? positives : rows.length - positives));

      features.forEach((v,i) => { grad[i] += error * v; });
    }

    model.weights = model.weights.map((w,i) => i < baseline.weights.length ? w : w - 0.25 * (grad[i] + 0.02 * (w - prior[i])));
  }
  return model;
}
// Hold out connected components so repeated listings cannot leak between folds.
const remaining = new Set(data);
const counts = () => ({ tp: 0, fp: 0, tn: 0, fn: 0 });
const before = counts(), after = counts(), withoutImages = counts();
let folds = 0;
while (remaining.size) {
  const first = remaining.values().next().value;
  const ids = new Set([first.left, first.right]), group = [];
  let changed;
  do {
    changed = false;
    for (const row of remaining) {
      if (!ids.has(row.left) && !ids.has(row.right)) continue;
      remaining.delete(row);
      group.push(row);
      ids.add(row.left); ids.add(row.right);
      changed = true;
    }
  } while (changed);
  const m = fit(data.filter(r => !ids.has(r.left) && !ids.has(r.right)));
  for (const { pair, label, features } of group) {
    if (Number(predict(features, m) >= m.threshold) !== label) console.log({ pair, label, score: predict(features, m) });
    const missing = [...features]; missing[3] = missing[4] = 0;
    for (const [metrics, score] of [[before,predict(features.slice(0,3),baseline)], [after,predict(features,m)], [withoutImages,predict(missing,m)]]) {
      metrics[label ? (score >= m.threshold ? "tp" : "fn") : (score >= m.threshold ? "fp" : "tn")]++;
    }
  }
  folds++;
}
console.log({ folds, before, after, withoutImages });
writeFileSync(new URL("../lib/server/collector/listing-model.json", import.meta.url), JSON.stringify(fit(data), null, 2) + "\n");
