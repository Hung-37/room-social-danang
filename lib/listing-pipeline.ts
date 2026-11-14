import { withListingWriteLock } from "./listing-write-lock";
import { deletedListingIds } from "./listing-deletions";
import { listingRejectionReason } from "@/lib/policies/listing-policy.js";
import type { NormalizedListing } from "@/lib/collector/parser.js";
import { deduplicateListings } from "@/lib/collector/parser.js";
import { saveListings } from "./db";
import { hasDatabaseConfig } from "./mysql-pool";
import { getSiteSettings } from "./site-settings";
import { recordCollectorRun } from "./collector-run-storage";
import { recordCollectorRunDb } from "./collector-db";
export async function processListings(
  input: NormalizedListing[],
  options: {
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
  let saved = 0;
  const persistenceErrors: string[] = [];
  if (listings.length) {
    if (!hasDatabaseConfig())
      persistenceErrors.push("Cần cấu hình MySQL để lưu dữ liệu.");
    else {
      await withListingWriteLock(async (connection) => {
        const removedBeforeSave = await deletedListingIds(
          listings.map((listing) => listing.externalId),
          connection,
        );
        listings = listings.filter((listing) => {
          if (!removedBeforeSave.has(listing.externalId)) return true;
          rejected.push({
            id: listing.externalId,
            reason: "Tin này vừa được Admin xóa, không nhập lại.",
          });
          return false;
        });
        saved = await saveListings(listings, connection);
        if (saved !== listings.length)
          persistenceErrors.push("Không lưu đủ tin vào MySQL.");
      });
    }
  }
  const errorCount = (options.sourceErrors || 0) + persistenceErrors.length;
  const record = {
    ranAt: new Date().toISOString(),
    status: errorCount ? "partial" : "completed",
    configured: options.configured || 0,
    collected: listings.length,
    duplicates: duplicateCount,
    errors: errorCount,
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
      logSaved,
      errors: persistenceErrors,
      storage: "mysql",
    },
  };
}
