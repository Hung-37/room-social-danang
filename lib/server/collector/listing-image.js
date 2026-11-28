import sharp from "sharp";

const hosts = new Set(["tromoi.com", "pt123.cdn.static123.com", "img.thuephongtro.com", "file.phongtro.vn", "img.meeyland.com", "static.timnhatro.vn"]);
const limit = 2 * 1024 * 1024;
export async function imageHash(bytes) {
  const pixels = await sharp(bytes, { limitInputPixels: 16000000 }).rotate().resize(17, 16, { fit: "fill" }).removeAlpha().greyscale().raw().toBuffer();
  let bits = 0n;
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const pos = y * 17 + x;
      bits = (bits << 1n) | BigInt(pixels[pos] > pixels[pos + 1]);
    }
  }
  // A nearly blank cover has too little structure for reliable matching.
  const ones = bits.toString(2).replaceAll("0", "").length;
  return ones < 12 || ones > 244 ? null : bits.toString(16).padStart(64, "0");
}

async function loadHash(value, signal) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !hosts.has(url.hostname) || url.username || url.password || url.port) return null;
    const response = await fetch(url, { signal, redirect: "error" });
    if (!response.ok || !/^image\/(jpeg|webp|png|avif)(;|$)/i.test(response.headers.get("content-type") ?? "") || Number(response.headers.get("content-length")) > limit) {
      await response.body?.cancel();
      return null;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > limit) return null;
      chunks.push(chunk);
    }
    return await imageHash(Buffer.concat(chunks));
  } catch { return null; }
}

export async function withImageHashes(input, budgetMs = 10000) {
  const rows = input.slice(0, 200);
  const queue = [...new Set(rows.map(row => row.imageUrl).filter(Boolean))];
  const hashes = new Map();
  const deadline = AbortSignal.timeout(budgetMs);
  async function worker() {
    while (queue.length && !deadline.aborted) {
      const url = queue.shift();
      hashes.set(url, await loadHash(url, AbortSignal.any([deadline, AbortSignal.timeout(3500)])));
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, queue.length) }, worker));
  return rows.map(row => ({ ...row, imageHash: hashes.get(row.imageUrl) ?? null }));
}
