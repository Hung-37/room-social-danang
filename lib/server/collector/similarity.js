import { canonicalListingUrl } from "./parser.js";
import { listingFeatures, pairFeatures, predict } from "./pair-features.js";
import model from "./listing-model.json" with { type: "json" };

export function findSimilarListings(input) {
  const rows = input.slice(0, 200);
  const fields = rows.map(listingFeatures);
  const vocabularySize = fields.map(parts => new Set(parts.flatMap(terms => [...terms])).size);
  const urls = rows.map(row => canonicalListingUrl(row.url));
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.id === b.id || (urls[i] && urls[i] === urls[j])) continue;
      if (a.clusterId && b.clusterId && a.clusterId !== b.clusterId) continue;
      if (Math.min(vocabularySize[i], vocabularySize[j]) < 5) continue;
      const score = predict(pairFeatures(fields[i], fields[j]), model);
      if (score >= model.threshold) matches.push({ left: a.id, right: b.id, leftTitle: a.title, rightTitle: b.title, score });
    }
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 30);
}
