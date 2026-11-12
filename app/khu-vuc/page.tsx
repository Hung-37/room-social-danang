import Header from "@/components/Header";
import Link from "next/link";
import { getClusterOverview } from "@/lib/cluster-overview";

export const dynamic = "force-dynamic";

export default async function Areas() {
  let areas: Awaited<ReturnType<typeof getClusterOverview>> = [];
  let unavailable = false;
  try {
    areas = await getClusterOverview();
  } catch {
    unavailable = true;
  }
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="container section">
        <h1>Tìm phòng theo khu vực</h1>
        <p>
          Chọn khu vực để xem phòng và thảo luận đã được duyệt. Tin chờ duyệt
          chưa xuất hiện trong số liệu công khai.
        </p>
        {unavailable ? (
          <p role="alert">
            Chưa thể tải dữ liệu khu vực. Vui lòng tải lại trang sau.
          </p>
        ) : (
          <div className="management-grid">
            {areas.map((area) => (
              <Link
                className="management-card"
                href={`/cum/${area.id}`}
                key={area.id}
              >
                <h2>{area.name}</h2>
                <p>{area.description}</p>
                <p>
                  <strong>{area.roomCount}</strong> phòng công khai ·{" "}
                  <strong>{area.discussionCount}</strong> thảo luận
                </p>
                <span>Xem khu vực →</span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
