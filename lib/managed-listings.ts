import { createHash, randomUUID } from "node:crypto";
import type { RowDataPacket, PoolConnection } from "mysql2/promise";
import { getDatabasePool as db } from "./mysql-pool";
import { lockListingOwner } from "./listing-eligibility";
import { validateListingInput } from "@/lib/policies/domain-policies.js";
import { ensureClusterAssigned } from "./auto-cluster";
export class ListingError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function listingInput(b: Record<string, unknown>) {
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const summary = typeof b.summary === "string" ? b.summary.trim() : "";
  const address = typeof b.address === "string" ? b.address.trim() : "";
  if (
    title.length < 5 ||
    title.length > 120 ||
    summary.length < 20 ||
    summary.length > 3000 ||
    address.length > 500 ||
    !validateListingInput({
      title,
      summary,
      address,
      price: b.price,
      area: b.area,
    }) ||
    Number(b.price) < 1 ||
    Number(b.price) > 1000000000 ||
    Number(b.area) < 0.01 ||
    Number(b.area) > 100000
  )
    throw new ListingError(
      "Kiểm tra tiêu đề (5–120 ký tự), mô tả (20–3000), địa chỉ, giá và diện tích.",
      400,
    );
  const images = b.imageIds ?? [];
  if (
    !Array.isArray(images) ||
    images.length > 4 ||
    images.some((i) => typeof i !== "string" || i.length > 191) ||
    new Set(images).size !== images.length
  )
    throw new ListingError("Mỗi phòng có tối đa 4 ảnh khác nhau.", 400);
  return {
    title,
    summary,
    address,
    price: Math.round(Number(b.price)),
    area: Number(b.area),
    phone: typeof b.phone === "string" ? b.phone.trim().slice(0, 40) : null,
    clusterId: ensureClusterAssigned({
      title,
      summary,
      address,
      clusterId: typeof b.clusterId === "string" ? b.clusterId : null,
    }),
    imageIds: images as string[],
  };
}
async function row(c: PoolConnection, id: string, owner: string, lock = false) {
  const [rows] = await c.query<(RowDataPacket & { imageUrl: string | null })[]>(
    `SELECT external_id AS externalId,title,summary,address,price,area_m2 AS area,phone,cluster_id AS clusterId,image_url AS imageUrl,verification_status AS verificationStatus,updated_at AS updatedAt FROM listings WHERE external_id=? AND owner_external_id=?${lock ? " FOR UPDATE" : ""}`,
    [id, owner],
  );
  if (!rows[0])
    throw new ListingError(
      "Không tìm thấy phòng thuộc tài khoản của bạn.",
      404,
    );
  const [images] = await c.query<RowDataPacket[]>(
    "SELECT id FROM listing_images WHERE listing_id=? ORDER BY position,id",
    [id],
  );
  const value = { ...rows[0], imageIds: images.map((i) => String(i.id)) };
  return {
    ...value,
    revision: createHash("sha256").update(JSON.stringify(value)).digest("hex"),
  };
}
export async function ownListing(id: string, owner: string) {
  const c = await db().getConnection();
  try {
    return await row(c, id, owner);
  } finally {
    c.release();
  }
}
async function attach(
  c: PoolConnection,
  id: string,
  owner: string,
  ids: string[],
) {
  if (ids.length) {
    const [images] = await c.query<RowDataPacket[]>(
      `SELECT id FROM listing_images WHERE id IN (${ids.map(() => "?").join(",")}) AND owner_id=? AND (listing_id IS NULL OR listing_id=?) FOR UPDATE`,
      [...ids, owner, id],
    );
    if (images.length !== ids.length)
      throw new ListingError(
        "Ảnh không thuộc tài khoản hoặc đã dùng ở phòng khác.",
        400,
      );
  }
  if (ids.length)
    await c.execute(
      `DELETE FROM listing_images WHERE listing_id=? AND id NOT IN (${ids.map(() => "?").join(",")})`,
      [id, ...ids],
    );
  else await c.execute("DELETE FROM listing_images WHERE listing_id=?", [id]);
  for (const [position, image] of ids.entries())
    await c.execute(
      "UPDATE listing_images SET listing_id=?,position=? WHERE id=? AND owner_id=?",
      [id, position, image, owner],
    );
}
export async function createManagedListing(
  owner: string,
  name: string,
  b: Record<string, unknown>,
  connection?: PoolConnection,
) {
  const v = listingInput(b);
  const id = "landlord-" + randomUUID();
  const c = connection ?? (await db().getConnection());
  try {
    if (!connection) await c.beginTransaction();
    await lockListingOwner(c, owner);
    await c.execute(
      `INSERT INTO listings(external_id,owner_external_id,title,summary,address,price,area_m2,phone,cluster_id,image_url,source_name,permission,verification_status,trust_score) VALUES (?,?,?,?,?,?,?,?,?,?,?,'landlord_submission','needs_review',30)`,
      [
        id,
        owner,
        v.title,
        v.summary,
        v.address,
        v.price,
        v.area,
        v.phone,
        v.clusterId,
        v.imageIds[0]
          ? "/api/images/" + v.imageIds[0]
          : typeof b.imageUrl === "string" && b.imageUrl.startsWith("https://")
            ? b.imageUrl
            : null,
        "Chủ trọ: " + name,
      ],
    );
    await attach(c, id, owner, v.imageIds);
    if (!connection) await c.commit();
    return {
      externalId: id,
      ownerExternalId: owner,
      ...v,
      verificationStatus: "needs_review",
    };
  } catch (e) {
    if (!connection) await c.rollback();
    throw e;
  } finally {
    if (!connection) c.release();
  }
}
export async function mutateListing(
  id: string,
  owner: string,
  b: Record<string, unknown>,
) {
  const action = b.action;
  if (!["edit", "hide", "rented", "resubmit"].includes(String(action)))
    throw new ListingError("Thao tác không hợp lệ.", 400);
  const v = action === "edit" ? listingInput(b) : null;
  const c = await db().getConnection();
  try {
    await c.beginTransaction();
    await lockListingOwner(
      c,
      owner,
      action === "edit" || action === "resubmit",
    );
    const current = await row(c, id, owner, true);
    if (typeof b.revision !== "string" || b.revision !== current.revision)
      throw new ListingError(
        "Tin đã thay đổi ở nơi khác. Tải lại thông tin trước khi lưu.",
        409,
      );
    if (v) {
      const remote =
        typeof current.imageUrl === "string" &&
        current.imageUrl.startsWith("https://") &&
        !b.removeExternalImage
          ? current.imageUrl
          : null;
      await attach(c, id, owner, v.imageIds);
      await c.execute(
        "UPDATE listings SET title=?,summary=?,address=?,price=?,area_m2=?,phone=?,cluster_id=?,image_url=?,verification_status='needs_review',updated_at=CURRENT_TIMESTAMP WHERE external_id=?",
        [
          v.title,
          v.summary,
          v.address,
          v.price,
          v.area,
          v.phone,
          v.clusterId,
          v.imageIds[0] ? "/api/images/" + v.imageIds[0] : remote,
          id,
        ],
      );
    } else
      await c.execute(
        "UPDATE listings SET verification_status=?,updated_at=CURRENT_TIMESTAMP WHERE external_id=?",
        [
          action === "hide"
            ? "hidden"
            : action === "rented"
              ? "rented"
              : "needs_review",
          id,
        ],
      );
    await c.commit();
    return {
      verificationStatus:
        action === "hide"
          ? "hidden"
          : action === "rented"
            ? "rented"
            : "needs_review",
    };
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}
