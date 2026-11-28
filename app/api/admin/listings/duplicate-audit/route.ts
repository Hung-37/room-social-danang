import { scanSimilarListings, type SimilarityInput } from "@/lib/server/collector/similarity.js";
import { createHash } from "node:crypto";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { getAdminSessionFromRequest } from "@/lib/server/admin-auth";
import { apiData, apiError } from "@/lib/server/api-response";
import { canonicalListingUrl } from "@/lib/server/collector/parser.js";
import { getDatabasePool } from "@/lib/server/mysql-pool";
import { withListingWriteLock } from "@/lib/server/listing-write-lock";

type ListingRow = RowDataPacket & {
  id: string;
  url: string;
  status: string;
  owner: string | null;
};

type Dependencies = RowDataPacket & {
  id: string;
  saves: number;
  conversations: number;
  messages: number;
  appointments: number;
};

async function audit(db: PoolConnection | ReturnType<typeof getDatabasePool>, lock = false) {
  const [rows] = await db.query<ListingRow[]>(
    `SELECT external_id AS id, source_url AS url, verification_status AS status, owner_external_id AS owner
       FROM listings WHERE source_url IS NOT NULL ORDER BY listings.id ${lock ? "FOR UPDATE" : ""}`,
  );
  const byUrl = new Map<string, ListingRow[]>();
  for (const row of rows) {
    const url = canonicalListingUrl(row.url);
    if (!url) continue;
    const group = byUrl.get(url);
    if (group) group.push(row);
    else byUrl.set(url, [row]);
  }

  const duplicates = [...byUrl.values()].filter((group) => group.length > 1);
  const ids = duplicates.flatMap((group) => group.map((row) => row.id));
  const dependencies = new Map<string, Dependencies>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const [counts] = await db.query<Dependencies[]>(
      `SELECT l.external_id AS id,
          (SELECT COUNT(*) FROM saved_posts s WHERE s.post_id = l.external_id) AS saves,
          (SELECT COUNT(*) FROM conversations c WHERE c.listing_id = l.external_id) AS conversations,
          (SELECT COUNT(*) FROM conversations c JOIN private_messages m ON m.conversation_id = c.id
             WHERE c.listing_id = l.external_id) AS messages,
          (SELECT COUNT(*) FROM conversations c JOIN viewing_appointments a ON a.conversation_id = c.id
             WHERE c.listing_id = l.external_id) AS appointments
         FROM listings l WHERE l.external_id IN (?)`,
      [ids.slice(offset, offset + 100)],
    );
    for (const row of counts) dependencies.set(row.id, row);
  }

  return duplicates.map((group) => group.map(({ id, status, owner }) => {
    const counts = dependencies.get(id);
    return {
      id,
      status,
      owner,
      dependencies: counts ? {
        saves: Number(counts.saves),
        conversations: Number(counts.conversations),
        messages: Number(counts.messages),
        appointments: Number(counts.appointments),
      } : null,
    };
  }));
}

function plan(groups: Awaited<ReturnType<typeof audit>>) {
  const actions: Array<{ keep: string; hide: Array<{ id: string; previousStatus: string }> }> = [];
  let blocked = 0;
  for (const group of groups) {
    const active = group.filter(({ status }) => status === "verified" || status === "needs_review");
    if (active.length < 2) continue;
    const linked = group.filter(({ dependencies }) => dependencies && Object.values(dependencies).some(Boolean));
    const preferred = linked[0] ?? active.find(({ status }) => status === "verified") ?? active[0];
    if (
      group.some(({ dependencies, owner }) => !dependencies || owner !== preferred.owner) ||
      linked.length > 1 ||
      !active.includes(preferred) ||
      (active.some(({ status }) => status === "verified") && preferred.status !== "verified")
    ) {
      blocked++;
      continue;
    }
    actions.push({
      keep: preferred.id,
      hide: active.filter((row) => row !== preferred)
        .map(({ id, status }) => ({ id, previousStatus: status })),
    });
  }
  const revision = createHash("sha256").update(JSON.stringify({ groups, actions })).digest("hex");
  return { actions, blocked, revision };
}

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request))
    return apiError("Yêu cầu quyền quản trị viên.", 401);
  try {
    if (new URL(request.url).searchParams.get("mode") === "similar") {
      const [rows] = await getDatabasePool().query<(RowDataPacket & SimilarityInput)[]>(
        `SELECT external_id AS id, title, address, LEFT(summary, 400) AS summary, cluster_id AS clusterId, image_url AS imageUrl, source_url AS url
         FROM listings WHERE verification_status IN ('verified','needs_review') AND source_url IS NOT NULL
         ORDER BY updated_at DESC, id DESC LIMIT 200`,
      );
      return apiData(await scanSimilarListings(rows), { meta: { scanned: rows.length } },
        { headers: { "Cache-Control": "private, no-store" } });
    }
    const groups = await audit(getDatabasePool());
    return apiData(
      groups.map((group) => group.map(({ id, status, dependencies }) => ({ id, status, dependencies }))),
      { meta: { groups: groups.length, listings: groups.flat().length, plan: plan(groups) } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return apiError("Chưa thể rà soát tin trùng.", 503);
  }
}

export async function POST(request: Request) {
  const admin = getAdminSessionFromRequest(request);
  if (!admin) return apiError("Yêu cầu quyền quản trị viên.", 401);
  if (request.headers.get("sec-fetch-site") !== "same-origin")
    return apiError("Yêu cầu phải đến từ trang quản trị.", 403);
  const body = await request.json().catch(() => null);
  if (typeof body?.revision !== "string") return apiError("Thiếu mã rà soát.", 400);

  try {
    return await withListingWriteLock(async (connection) => {
      await connection.beginTransaction();
      try {
        const current = plan(await audit(connection, true));
        if (current.revision !== body.revision || current.blocked) {
          await connection.rollback();
          return apiError("Dữ liệu đã thay đổi hoặc có nhóm cần xử lý riêng. Hãy rà soát lại.", 409);
        }
        let hidden = 0;
        for (const { keep, hide } of current.actions) {
          for (const { id, previousStatus } of hide) {
            await connection.execute(
              "UPDATE listings SET verification_status='rejected', updated_at=updated_at WHERE external_id=?",
              [id],
            );
            await connection.execute(
              `INSERT INTO moderation_logs(entity_type,entity_id,action,actor_email,details)
               VALUES('listing',?,'duplicate_archived',?,?)`,
              [id, admin.email, JSON.stringify({ keep, previousStatus })],
            );
            hidden++;
          }
        }
        await connection.commit();
        return apiData({ groups: current.actions.length, hidden });
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    });
  } catch {
    return apiError("Chưa thể ẩn tin trùng.", 503);
  }
}
