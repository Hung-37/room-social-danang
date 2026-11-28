import type { RowDataPacket } from "mysql2/promise";
import { getAdminSessionFromRequest } from "@/lib/server/admin-auth";
import { apiData, apiError } from "@/lib/server/api-response";
import { canonicalListingUrl } from "@/lib/server/collector/parser.js";
import { getDatabasePool } from "@/lib/server/mysql-pool";

type ListingRow = RowDataPacket & {
  id: string;
  url: string;
  status: string;
};

type Dependencies = RowDataPacket & {
  id: string;
  saves: number;
  conversations: number;
  messages: number;
  appointments: number;
};

export async function GET(request: Request) {
  if (!getAdminSessionFromRequest(request))
    return apiError("Yêu cầu quyền quản trị viên.", 401);

  try {
    const db = getDatabasePool();
    const [rows] = await db.query<ListingRow[]>(
      `SELECT external_id AS id, source_url AS url, verification_status AS status
         FROM listings WHERE source_url IS NOT NULL ORDER BY id`,
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

    return apiData(
      duplicates.map((group) => group.map(({ id, status }) => {
        const counts = dependencies.get(id);
        return {
          id,
          status,
          dependencies: counts ? {
            saves: Number(counts.saves),
            conversations: Number(counts.conversations),
            messages: Number(counts.messages),
            appointments: Number(counts.appointments),
          } : null,
        };
      })),
      { meta: { groups: duplicates.length, listings: ids.length } },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return apiError("Chưa thể rà soát tin trùng.", 503);
  }
}
