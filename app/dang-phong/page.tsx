import type { User } from "@/lib/types";
import Header from "@/components/Header";
import Link from "next/link";
import { getUserSession } from "@/lib/user-auth";
import { landlordStatus } from "@/lib/landlord-db";
import LandlordListingForm from "./LandlordListingForm";
export default async function LandlordListingPage() {
  let user: User | null = null;
  let unavailable = false;
  try {
    user = await getUserSession();
  } catch {
    unavailable = true;
  }
  let allowed = user?.role === "admin";
  let message =
    "Vui lòng đăng nhập tài khoản chủ trọ đã được xác minh để đăng phòng.";
  if (unavailable)
    message = "Chưa kết nối được dữ liệu tài khoản. Vui lòng thử lại sau.";
  if (user?.role === "landlord") {
    try {
      allowed = (await landlordStatus(user.id)) === "verified";
      message =
        "Tài khoản chủ trọ chưa được xác minh. Vui lòng chờ quản trị viên duyệt tài khoản.";
    } catch {
      message = "Không thể kiểm tra xác minh. Vui lòng thử lại sau.";
    }
  }
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        {allowed ? (
          <LandlordListingForm />
        ) : (
          <section className="container section">
            <h1>Đăng phòng</h1>
            <p>{message}</p>
            <Link
              className="primary-btn"
              href={
                unavailable
                  ? "/dang-phong"
                  : user
                    ? "/quan-ly-phong"
                    : "/dang-nhap"
              }
            >
              {unavailable ? "Thử lại" : user ? "Quản lý phòng" : "Đăng nhập"}
            </Link>
          </section>
        )}
      </main>
    </>
  );
}
