function terms(text) {
  return new Set((text ?? "").normalize("NFD").replace(/\p{M}/gu, "")
    .toLowerCase().replaceAll("đ", "d").match(/[a-z0-9]+/g) ?? []);
}
export function listingFeatures(row) {
  return [terms(row.title), terms(row.summary?.slice(0, 400)), terms(row.address)];
}
export function pairFeatures(left, right) {
  return left.map((a, index) => {
    const b = right[index];
    if (!a.size || !b.size) return 0;
    let shared = 0;
    for (const term of a) if (b.has(term)) shared++;
    return 2 * shared / (a.size + b.size);
  });
}
export function predict(features, model) {
  const logit = features.reduce((sum, value, i) => sum + value * model.weights[i], model.bias);
  return 1 / (1 + Math.exp(-logit));
}
