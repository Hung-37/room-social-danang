import { createOnce, submissionKey } from "@/lib/idempotency";
import { MutationError } from "@/lib/mutation-errors";
import {
  listingInput,
  createManagedListing,
  ListingError,
} from "@/lib/managed-listings";
import { landlordStatus } from "@/lib/landlord-db";
import { resolveRequestUser } from "@/lib/user-auth";
import { can } from "@/lib/roles";
import { hasDatabaseConfig } from "@/lib/mysql-pool";
import { apiError, apiData } from "@/lib/api-response";
export async function POST(request: Request) {
  const sessionResult = await resolveRequestUser(request);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user || !can(user, "listing:create"))
    return apiError("Chỉ chủ trọ mới có thể đăng tin phòng.", 403, "FORBIDDEN");
  if (!hasDatabaseConfig())
    return apiError(
      "Database chưa được cấu hình.",
      503,
      "DATABASE_UNAVAILABLE",
    );
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body))
    return apiError("Thông tin phòng không hợp lệ.", 400);
  try {
    if (
      user.role === "landlord" &&
      (await landlordStatus(user.id)) !== "verified"
    )
      return apiError(
        "Tài khoản chủ trọ chưa được quản trị viên xác minh.",
        403,
        "LANDLORD_NOT_VERIFIED",
      );
    const result = await createOnce(
      user.id,
      "listing_create",
      submissionKey(request),
      {
        ...listingInput(body),
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
      },
      (connection) =>
        createManagedListing(user.id, user.name, body, connection),
    );
    const listing = result.value;
    return apiData(
      listing,
      {
        databaseSaved: 1,
        status: "needs_review",
        storage: "database",
        replayed: result.replayed,
      },
      { status: 201 },
    );
  } catch (e) {
    return e instanceof ListingError || e instanceof MutationError
      ? apiError(
          e.message,
          e.status,
          e instanceof MutationError ? e.code : undefined,
        )
      : apiError(
          "Không thể lưu tin vào database. Thông tin chưa được gửi.",
          503,
          "DATABASE_UNAVAILABLE",
        );
  }
}
