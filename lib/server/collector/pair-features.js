function normalize(text) {
  return (text ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replaceAll("đ", "d");
}
function terms(text) {
  return new Set(normalize(text).match(/[a-z0-9]+/g) ?? []);
}
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const term of a) if (b.has(term)) shared++;
  return 2 * shared / (a.size + b.size);
}
function addressParts(text) {
  const first = normalize(text).split(",")[0].trim();
  // A numbered street such as "Đường 2 Tháng 9" has no house number.
  const house = /^(?:so\s+|lo\s+)?(k?\d+[a-z]?(?:\/\d+[a-z]?)*)(?:\s*-\s*|\s+)(.+)$/.exec(first);
  const district = /^(?:(?:quan|huyen|phuong)\s+)?(?:hai chau|cam le|thanh khe|lien chieu|ngu hanh son|son tra|hoa vang|da nang)$/.test(first) || /^(?:quan|huyen|phuong)\s/.test(first);
  return { number: house?.[1], street: terms((house?.[2] ?? first).replace(/^duong\s+/, "")), district };
}
export function listingFeatures(row) {
  const fields = [terms(row.title), terms(row.summary?.slice(0, 400)), terms(row.address)];
  return { fields, address: addressParts(row.address), hash: row.imageHash, dateOnly: /^\s*\d{1,2}\/\d{1,2}\/\d{4}\s*$/.test(row.summary ?? "") };
}
export function pairFeatures(a, b) {
  const [title, summary, addr] = a.fields.map((field, i) => overlap(field, b.fields[i]));
  const x = a.address, y = b.address;
  const numberedStreet = x.number && y.number && overlap(x.street, y.street) >= 0.8;
  let near = 0, far = 0;
  if ([a.hash,b.hash].every(h => /^[0-9a-f]{64}$/i.test(h ?? ""))) {
    const bits = BigInt("0x" + a.hash) ^ BigInt("0x" + b.hash);
    const distance = bits.toString(2).replaceAll("0", "").length;
    near = Math.max(0, 1 - distance / 48);
    far = Math.min(1, Math.max(0, (distance - 48) / 80));
  }
  return [title, summary, addr, near, far, numberedStreet ? (x.number === y.number ? 1 : -1) : 0, x.district || y.district ? addr : 0,
    a.dateOnly || b.dateOnly ? summary : 0];
}
export function predict(features, model) {
  return 1 / (1 + Math.exp(-features.reduce((sum, val, i) => sum + val * model.weights[i], model.bias)));
}
