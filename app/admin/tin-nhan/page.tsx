import { getAdminSession } from "@/lib/admin-auth";
import { redirect } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import Reports from "./Reports";
export default async function Page() {
  if (!(await getAdminSession())) redirect("/dang-nhap");
  return (
    <>
      <AdminHeader />
      <main id="main-content" tabIndex={-1} className="content-shell explorer">
        <h1>Báo cáo hội thoại riêng</h1>
        <p>
          Chỉ hiển thị lý do do người tham gia gửi. Không tự mở nội dung tin
          nhắn riêng.
        </p>
        <Reports />
      </main>
    </>
  );
}
