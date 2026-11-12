/** Shared, conservative area classification for collected and landlord listings. */
export const UNASSIGNED_CLUSTER_ID = "chua-phan-cum";
const rules = [
  {
    id: "bach-khoa-su-pham",
    local: ["hoa khanh", "hoa minh", "hoa lien"],
    district: ["lien chieu"],
    street: ["nguyen luong bang", "ton duc thang"],
    school: ["dai hoc bach khoa", "dai hoc su pham"],
  },
  {
    id: "hoa-cuong",
    local: ["hoa cuong"],
    district: [],
    street: ["xo viet nghe tinh", "nui thanh"],
    school: ["dai hoc dong a", "dai hoc kien truc"],
  },
  {
    id: "hai-chau",
    local: [],
    district: ["hai chau", "thanh khe"],
    street: ["le dinh duong", "hung vuong", "dong da", "trung nu vuong"],
    school: ["dai hoc su pham ky thuat"],
  },
  {
    id: "ngu-hanh-son",
    local: ["my an", "khue my", "hoa hai", "an thuong"],
    district: ["ngu hanh son"],
    street: ["phan tu"],
    school: ["dai hoc kinh te"],
  },
  {
    id: "nam-da-nang",
    local: ["hoa quy", "khu do thi dai hoc", "nam da nang"],
    district: [],
    street: ["tran dai nghia"],
    school: [
      "vku",
      "dai hoc viet han",
      "dai hoc cong nghe thong tin va truyen thong viet han",
    ],
  },
  {
    id: "son-tra",
    local: ["an hai", "nai hien dong", "tho quang", "man thai", "phuoc my"],
    district: ["son tra"],
    street: ["pham van dong"],
    school: [],
  },
  {
    id: "cam-le",
    local: ["hoa an", "hoa tho", "hoa phat", "khue trung", "hoa xuan"],
    district: ["cam le"],
    street: ["le thach"],
    school: [],
  },
  {
    id: "hoa-vang",
    local: [
      "hoa nhon",
      "hoa phuoc",
      "hoa phu",
      "hoa ninh",
      "hoa son",
      "hoa tien",
      "hoa bac",
    ],
    district: ["hoa vang"],
    street: [],
    school: [],
  },
];
const validIds = new Set([
  UNASSIGNED_CLUSTER_ID,
  ...rules.map((rule) => rule.id),
]);
export function normalizeAddress(value = "") {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
function contains(text, keyword) {
  return ` ${text} `.includes(` ${keyword} `);
}
function match(text, tier) {
  const matches = rules.flatMap((rule) =>
    rule[tier]
      .filter((keyword) => contains(text, keyword))
      .map((keyword) => ({ id: rule.id, keyword })),
  );
  // Prefer a longer, nested school name, e.g. Sư phạm Kỹ thuật over Sư phạm.
  const specific = matches.filter(
    (item) =>
      !matches.some((other) => other.keyword.startsWith(item.keyword + " ")),
  );
  const ids = [...new Set(specific.map((item) => item.id))];
  return ids.length === 1
    ? ids[0]
    : ids.length > 1
      ? UNASSIGNED_CLUSTER_ID
      : null;
}
export function autoAssignCluster(address = "", title = "", summary = "") {
  const location = normalizeAddress(address);
  // An explicit address is authoritative. Do not guess from advertising text if it is unknown.
  if (location) {
    for (const tier of ["local", "district", "street"]) {
      const result = match(location, tier);
      if (result) return result;
    }
    return UNASSIGNED_CLUSTER_ID;
  }
  const text = normalizeAddress(`${title ?? ""} ${summary ?? ""}`);
  // Only specific school names may provide a fallback when no address was supplied.
  return match(text, "school") ?? UNASSIGNED_CLUSTER_ID;
}
export function ensureClusterAssigned(listing) {
  if (
    validIds.has(listing.clusterId) &&
    listing.clusterId !== UNASSIGNED_CLUSTER_ID
  )
    return listing.clusterId;
  return autoAssignCluster(listing.address, listing.title, listing.summary);
}
