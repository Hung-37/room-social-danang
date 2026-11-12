import { NextResponse } from "next/server";
import { updateListingStatus, hasDatabaseConfig } from "@/lib/db";
import { updateScrapedListingStatus } from "@/lib/file-storage";
import { getAdminSessionFromRequest } from "@/lib/admin-auth";
import { recordModerationLog } from "@/lib/community-db";
import { MutationError } from "@/lib/mutation-errors";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminSessionFromRequest(request);
  if (!admin)
    return NextResponse.json(
      { error: "Vui lòng đăng nhập quản trị viên." },
      { status: 401 },
    );
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const status = body?.status;

  if (!status || !["needs_review", "verified", "rejected"].includes(status)) {
    return NextResponse.json(
      {
        error: "Trạng thái kiểm duyệt không hợp lệ.",
      },
      { status: 400 },
    );
  }

  if (hasDatabaseConfig()) {
    try {
      if (
        !(await updateListingStatus(
          id,
          status,
          admin.email,
          body.reviewRevision,
        ))
      )
        return NextResponse.json(
          { error: "Không tìm thấy tin đăng." },
          { status: 404 },
        );
      try {
        updateScrapedListingStatus(id, status);
      } catch (cacheError) {
        console.warn("Database status updated; cache sync failed.", cacheError);
      }
      return NextResponse.json({
        success: true,
        storage: "database",
        databaseSynced: true,
      });
    } catch (error) {
      if (error instanceof MutationError)
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      console.warn("Không thể lưu kiểm duyệt vào MySQL.", error);
      return NextResponse.json(
        { error: "Không thể lưu kiểm duyệt. Vui lòng thử lại." },
        { status: 503 },
      );
    }
  }

  if (updateScrapedListingStatus(id, status)) {
    await recordModerationLog({
      entityType: "listing",
      entityId: id,
      action: `listing_${status}`,
      actorEmail: admin.email,
      details: { status, storage: "file_cache" },
    }).catch(() => undefined);
    return NextResponse.json({
      success: true,
      storage: "file_cache",
      databaseSynced: false,
      message: "Đã cập nhật trạng thái trong bộ nhớ đệm cục bộ.",
    });
  }

  return NextResponse.json(
    { error: "Không tìm thấy tin hoặc không thể truy cập dữ liệu." },
    { status: 404 },
  );
}
