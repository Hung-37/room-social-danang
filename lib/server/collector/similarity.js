import { canonicalListingUrl } from "./parser.js";
import { listingFeatures, pairFeatures, predict } from "./pair-features.js";
import { withImageHashes } from "./listing-image.js";
import model from "./listing-model.json" with { type: "json" };

function collectPairs(rows) {
  const fields = rows.map(listingFeatures);
  const vocabularySize = fields.map(parts => new Set(parts.fields.flatMap(terms => [...terms])).size);
  const urls = rows.map(row => canonicalListingUrl(row.url));
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.id === b.id || (urls[i] && urls[i] === urls[j])) continue;
      if (a.clusterId && b.clusterId && a.clusterId !== b.clusterId) continue;
      if (Math.min(vocabularySize[i], vocabularySize[j]) < 5) continue;
      const features = pairFeatures(fields[i], fields[j]);
      const score = predict(features, model);
      if (score >= model.threshold) matches.push({ left: a.id, right: b.id, leftTitle: a.title, rightTitle: b.title, score, near: features[3] });
    }
  }
  return matches.sort((a, b) => b.score - a.score);
}

export function findSimilarListings(input) {
  return collectPairs(input.slice(0, 200)).slice(0, 30);
}

// Auto-archive only fires on near-certain copies: a very high model score plus
// an almost identical cover image. Pairs without image hashes never qualify.
export function findAutoDuplicates(input) {
  return collectPairs(input.slice(0, 200))
    .filter(pair => pair.score >= 0.95 && pair.near >= 0.9)
    .slice(0, 30);
}

export async function scanSimilarListings(rows) {
  return findSimilarListings(await withImageHashes(rows));
}

export async function scanAutoDuplicates(rows) {
  return findAutoDuplicates(await withImageHashes(rows));
}
