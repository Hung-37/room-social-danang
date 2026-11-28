import { redirect } from "next/navigation";
import AdminHeader from "@/components/AdminHeader";
import { getAdminSession } from "@/lib/server/admin-auth";
import PageProtectionReview from "./PageProtectionReview";
import DuplicateReview from "./DuplicateReview";

export default async function Page() {
  if (!(await getAdminSession())) redirect("/dang-nhap");
  return (
    <>
      <AdminHeader />
      <main id="main-content" className="container section">
        <h1>Tin trùng URL</h1>
        <DuplicateReview />
        <PageProtectionReview />
      </main>
    </>
  );
}
