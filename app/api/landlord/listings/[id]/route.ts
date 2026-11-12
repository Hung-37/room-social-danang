import { MutationError } from "@/lib/mutation-errors";
import { resolveRequestUser } from "@/lib/user-auth";
import { apiData, apiError } from "@/lib/api-response";
import {
  ownListing,
  mutateListing,
  ListingError,
} from "@/lib/managed-listings";
type Context = { params: Promise<{ id: string }> };
function failure(e: unknown) {
  return apiError(
    e instanceof ListingError || e instanceof MutationError
      ? e.message
      : "Chưa thể truy cập phòng. Vui lòng thử lại.",
    e instanceof ListingError || e instanceof MutationError ? e.status : 503,
  );
}
export async function GET(r: Request, ctx: Context) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError("Vui lòng đăng nhập.", 401);
  if (user.role !== "landlord") return apiError("Chỉ dành cho chủ trọ.", 403);
  try {
    return apiData(
      await ownListing((await ctx.params).id, user.id),
      {},
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(r: Request, ctx: Context) {
  const sessionResult = await resolveRequestUser(r);
  if (sessionResult.error) return sessionResult.error;
  const user = sessionResult.user;
  if (!user) return apiError("Vui lòng đăng nhập.", 401);
  if (user.role !== "landlord") return apiError("Chỉ dành cho chủ trọ.", 403);
  const b = await r.json().catch(() => null);
  if (!b || typeof b !== "object")
    return apiError("Thông tin không hợp lệ.", 400);
  try {
    return apiData(await mutateListing((await ctx.params).id, user.id, b));
  } catch (e) {
    return failure(e);
  }
}
