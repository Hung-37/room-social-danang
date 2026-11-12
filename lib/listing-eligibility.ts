import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { MutationError } from "./mutation-errors";
/** Lock order: owner -> verification/controls -> listing. Shared by publish/edit/revoke. */
export async function lockListingOwner(
  c: PoolConnection,
  owner: string,
  requireVerified = true,
) {
  const [users] = await c.query<RowDataPacket[]>(
    "SELECT role FROM users WHERE external_id=? FOR UPDATE",
    [owner],
  );
  const [controls] = await c.query<RowDataPacket[]>(
    "SELECT blocked FROM user_controls WHERE user_id=? FOR UPDATE",
    [owner],
  );
  if (
    !users[0] ||
    controls[0]?.blocked ||
    !["landlord", "admin"].includes(users[0].role)
  )
    throw new MutationError(
      "Tài khoản chủ trọ không còn đủ quyền đăng phòng.",
      403,
    );
  const [verification] = await c.query<RowDataPacket[]>(
    "SELECT status FROM landlord_verifications WHERE user_external_id=? FOR UPDATE",
    [owner],
  );
  if (
    requireVerified &&
    users[0].role !== "admin" &&
    verification[0]?.status !== "verified"
  )
    throw new MutationError(
      "Chủ trọ cần được xác minh để gửi hoặc công khai tin.",
      403,
    );
}
// The same SQL expression is used for the list snapshot and locked mutation row.
// Includes all reviewed content, state and attached image order, not just second-resolution timestamps.
export const reviewRevisionSql = `SHA2(JSON_ARRAY(title,summary,price,area_m2,address,phone,image_url,cluster_id,source_name,source_url,permission,verification_status,trust_score,owner_external_id,updated_at,(SELECT GROUP_CONCAT(CONCAT(li.id,':',li.position) ORDER BY li.position,li.id SEPARATOR ',') FROM listing_images li WHERE li.listing_id=listings.external_id)),256)`;
