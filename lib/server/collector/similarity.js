import { canonicalListingUrl } from "./parser.js";

// Fit inverse document frequencies to the current batch. Scores rank review
// candidates; they are not calibrated probabilities or moderation decisions.
export function findSimilarListings(input) {
  const rows = input.slice(0, 200);
  const frequencies = new Map();
  const vectors = rows.map(row => {
    const text = [row.title, row.title, row.address, row.summary?.slice(0, 400)]
      .filter(Boolean).join(" ").normalize("NFD").replace(/\p{M}/gu, "")
      .toLowerCase().replaceAll("đ", "d");
    const terms = new Map();
    for (const token of text.match(/[a-z0-9]+/g) ?? []) {
      terms.set(token, (terms.get(token) ?? 0) + 1);
    }
    for (const token of terms.keys()) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    return terms;
  });
  for (const terms of vectors) {
    let squaredNorm = 0;
    for (const [token, count] of terms) {
      const weight = (1 + Math.log(count)) * (1 + Math.log((1 + rows.length) / (1 + frequencies.get(token))));
      terms.set(token, weight);
      squaredNorm += weight * weight;
    }
    for (const [token, weight] of terms) terms.set(token, weight / Math.sqrt(squaredNorm));
  }
  const urls = rows.map(row => canonicalListingUrl(row.url));
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i], b = rows[j];
      if (a.id === b.id || (urls[i] && urls[i] === urls[j])) continue;
      if (a.clusterId && b.clusterId && a.clusterId !== b.clusterId) continue;
      if (Math.min(vectors[i].size, vectors[j].size) < 5) continue;
      let score = 0;
      for (const [token, weight] of vectors[i]) score += weight * (vectors[j].get(token) ?? 0);
      if (score >= 0.84) matches.push({ left: a.id, right: b.id, leftTitle: a.title, rightTitle: b.title, score: Math.min(1, score) });
    }
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 30);
}
