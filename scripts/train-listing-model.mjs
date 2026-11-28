import { readFileSync, writeFileSync } from "node:fs";
import { listingFeatures, pairFeatures, predict } from "../lib/server/collector/pair-features.js";

const fixture = new URL("../data/fixtures/sample-data.json", import.meta.url);
const rows = JSON.parse(readFileSync(fixture)).map(r => ({ ...r, summary: r.description }));
// Split by original listing before constructing any augmented pairs.
function examples(group) {
  const result = [];
  function add(a, b, label) {
    result.push({ x: pairFeatures(listingFeatures(a), listingFeatures(b)), label });
  }
  for (const [i, row] of group.entries()) {
    add(row, { ...row, address: "", title: "Cho thuê " + row.title }, 1);
    add(row, { ...row, title: "Tin mới", summary: row.summary.slice(0, 90) }, 1);
    add(row, { ...row, summary: "", title: row.title + " Đà Nẵng" }, 1);
    for (const other of group.slice(i + 1)) {
      add(row, other, 0);
      // Same district or boilerplate title alone is insufficient evidence.
      add(row, { ...other, address: row.address }, 0);
      add(row, { ...other, title: row.title }, 0);
    }
  }
  return result;
}
const train = examples(rows.slice(0, 7));
const heldOut = examples(rows.slice(7));
const model = { weights: [0, 0, 0], bias: 0, threshold: 0.70 };
const positives = train.filter(e => e.label).length;
for (let epoch = 0; epoch < 2400; epoch++) {
  const gradient = [0, 0, 0];
  let intercept = 0;
  for (const { x, label } of train) {
    const error = (predict(x, model) - label) / (2 * (label ? positives : train.length - positives));
    intercept += error;
    x.forEach((value, i) => { gradient[i] += error * value; });
  }
  model.bias -= 0.3 * intercept;
  model.weights = model.weights.map((weight, i) => weight - 0.3 * (gradient[i] + 0.002 * weight));
}
const metrics = { tp: 0, fp: 0, tn: 0, fn: 0 };
for (const { x, label } of heldOut) {
  const hit = predict(x, model) >= model.threshold;
  metrics[label ? (hit ? "tp" : "fn") : (hit ? "fp" : "tn")]++;
}
writeFileSync(new URL("../lib/server/collector/listing-model.json", import.meta.url), JSON.stringify(model, null, 2) + "\n");
console.log({ trainingPairs: train.length, heldOutPairs: heldOut.length, ...metrics });
