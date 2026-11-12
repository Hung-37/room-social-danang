import { withListingWriteLock } from "./listing-write-lock";
import { deletedListingIds } from "./listing-deletions";
import { listingRejectionReason } from "@/lib/policies/listing-policy.js";
import { createHash } from "node:crypto";
import type { NormalizedListing } from "@/lib/collector/parser.js";
import { deduplicateListings } from "@/lib/collector/parser.js";
import { saveListings } from "./db";
import { hasDatabaseConfig } from "./mysql-pool";
import { getSiteSettings } from "./site-settings";
import { analyzeWithOllama, AI_PROMPT_VERSION } from "./ollama";
import { recordCollectorRun } from "./collector-run-storage";
import { recordCollectorRunDb } from "./collector-db";
export async function processListings(
  input: NormalizedListing[],
  options: {
    useAi?: boolean;
    configured?: number;
    sourceErrors?: number;
    duplicates?: number;
  } = {},
) {
  const { settings } = await getSiteSettings();
  const rejected: { id: string; reason: string }[] = [];
  const policySelected = input.filter((l) => {
    const reason = listingRejectionReason(l, settings.daNangOnly);
    if (reason) rejected.push({ id: l.externalId, reason });
    return !reason;
  });
  const removed = hasDatabaseConfig()
    ? await deletedListingIds(
        policySelected.map((listing) => listing.externalId),
      )
    : new Set<string>();
  const selected = policySelected.filter((listing) => {
    if (!removed.has(listing.externalId)) return true;
    rejected.push({
      id: listing.externalId,
      reason: "Tin này đã được Admin xóa, không tự nhập lại.",
    });
    return false;
  });
  let listings = deduplicateListings(selected).map((l) => ({
    ...l,
    title: l.title.slice(0, 255),
    summary: l.summary.slice(0, 10000),
  }));
  const duplicateCount =
    (options.duplicates || 0) + selected.length - listings.length;
  const enabled = settings.aiEnabled && options.useAi !== false;
  const model = process.env.OLLAMA_MODEL || "llama3.2:3b";
  const errors: string[] = [];
  const analyses = new Map<
    string,
    {
      status: "success" | "error" | "skipped";
      payload: unknown;
      error: string | null;
      hash: string;
    }
  >();
  for (const [index, l] of listings.entries()) {
    const hash = createHash("sha256")
      .update(l.title + "\n" + l.summary)
      .digest("hex");
    if (!enabled || index >= settings.aiMaxListings || errors.length) {
      analyses.set(l.externalId, {
        status: "skipped",
        payload: null,
        error: enabled
          ? "Ngoài giới hạn phân tích của lượt chạy."
          : "AI đang tắt.",
        hash,
      });
      continue;
    }
    try {
      const value = await analyzeWithOllama(
        (l.title + "\n" + l.summary).slice(0, 12000),
        settings,
      );
      l.aiAnalysis = value;
      analyses.set(l.externalId, {
        status: "success",
        payload: value,
        error: null,
        hash,
      });
    } catch (e) {
      const error = e instanceof Error ? e.message : "AI không phản hồi.";
      errors.push(error);
      analyses.set(l.externalId, {
        status: "error",
        payload: null,
        error,
        hash,
      });
    }
  }
  let saved = 0,
    aiSaved = 0;
  const persistenceErrors: string[] = [];
  if (listings.length) {
    if (!hasDatabaseConfig())
      persistenceErrors.push("Cần cấu hình MySQL để lưu dữ liệu.");
    else {
      await withListingWriteLock(async (connection) => {
        const removedDuringAnalysis = await deletedListingIds(
          listings.map((listing) => listing.externalId),
          connection,
        );
        listings = listings.filter((listing) => {
          if (!removedDuringAnalysis.has(listing.externalId)) return true;
          rejected.push({
            id: listing.externalId,
            reason: "Tin này vừa được Admin xóa, không nhập lại.",
          });
          return false;
        });
        saved = await saveListings(listings, connection);
        if (saved !== listings.length)
          persistenceErrors.push("Không lưu đủ tin vào MySQL.");
        if (saved === listings.length)
          for (const l of listings) {
            const a = analyses.get(l.externalId)!;
            try {
              await connection.execute(
                `INSERT INTO listing_ai_analysis(listing_id,status,model,prompt_version,content_hash,payload,error,analyzed_at) VALUES (?,?,?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE status=VALUES(status),model=VALUES(model),prompt_version=VALUES(prompt_version),content_hash=VALUES(content_hash),payload=VALUES(payload),error=VALUES(error),analyzed_at=UTC_TIMESTAMP()`,
                [
                  l.externalId,
                  a.status,
                  model,
                  AI_PROMPT_VERSION,
                  a.hash,
                  a.payload ? JSON.stringify(a.payload) : null,
                  a.error?.slice(0, 500) || null,
                ],
              );
              aiSaved++;
            } catch {
              persistenceErrors.push("Không lưu được kết quả phân tích AI.");
              break;
            }
          }
      });
    }
  }
  const retained = listings.map((listing) => analyses.get(listing.externalId)!);
  const analyzed = retained.filter(
    (analysis) => analysis.status === "success",
  ).length;
  const finalAiErrors = retained
    .filter((analysis) => analysis.status === "error")
    .map((analysis) => analysis.error || "AI không phản hồi.");
  const errorCount =
    (options.sourceErrors || 0) +
    finalAiErrors.length +
    persistenceErrors.length;
  const record = {
    ranAt: new Date().toISOString(),
    status: errorCount ? "partial" : "completed",
    configured: options.configured || 0,
    collected: listings.length,
    duplicates: duplicateCount,
    errors: errorCount,
    ai: { enabled, analyzed, errors: finalAiErrors },
    rejected: rejected.length,
  };
  let logSaved = false;
  try {
    await recordCollectorRunDb(record);
    logSaved = true;
  } catch {
    persistenceErrors.push("Không lưu được nhật ký lượt chạy vào MySQL.");
    record.status = "partial";
    record.errors++;
  }
  try {
    recordCollectorRun(record);
  } catch {
    /* Database is authoritative; file history is optional. */
  }
  const status = record.status;
  return {
    listings,
    rejected,
    status,
    duplicates: record.duplicates,
    record,
    persistence: {
      status:
        saved === listings.length && !persistenceErrors.length
          ? "saved"
          : saved
            ? "partial"
            : "error",
      saved,
      databaseSaved: saved,
      aiSaved,
      logSaved,
      errors: persistenceErrors,
      storage: "mysql",
    },
    ai: {
      enabled,
      analyzed,
      skipped: Math.max(0, listings.length - analyzed - finalAiErrors.length),
      errors: finalAiErrors,
      model,
    },
  };
}
