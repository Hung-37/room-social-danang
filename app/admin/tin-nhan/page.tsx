import { getAdminSession } from "@/lib/server/admin-auth";
import { redirect } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import Reports from "./Reports";
export default async function Page() {
  if (!(await getAdminSession())) redirect("/dang-nhap");
  return (
    <>
      <AdminHeader />
      <main id="main-content" tabIndex={-1} className="admin-main">
        <section className="admin-page">
          <div className="container">
            <div className="admin-heading">
              <div>
                <span className="eyebrow">An toàn cộng đồng</span>
                <h1>Báo cáo hội thoại</h1>
              </div>
            </div>
            <Reports />
          </div>
        </section>
      </main>
    </>
  );
}
