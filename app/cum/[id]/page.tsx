import { getUserSession } from "@/lib/user-auth";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import PostCard from "@/components/PostCard";
import { clusters, type RoomPost, normalizeToRoomPost } from "@/lib/data";
import { getListings, hasDatabaseConfig } from "@/lib/db";
import { listCommunityPosts as listDatabaseDiscussions } from "@/lib/community-db";
import { listCommunityPosts as listFileDiscussions } from "@/lib/server-community-storage";
import { getClusterOverview } from "@/lib/cluster-overview";
import { readScrapedListings } from "@/lib/file-storage";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ClusterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cluster = clusters.find((item) => item.id === id);
  if (!cluster) notFound();
  const viewer = await getUserSession().catch(() => null);
  let rooms: RoomPost[] = [],
    discussions: RoomPost[] = [];
  let roomCount = 0,
    discussionCount = 0,
    unavailable = false;
  try {
    const [listings, posts, overview] = await Promise.all([
      hasDatabaseConfig()
        ? getListings(12, 0, false, "", cluster.id)
        : Promise.resolve(readScrapedListings({ includeStale: false })),
      hasDatabaseConfig()
        ? listDatabaseDiscussions(
            12,
            0,
            false,
            { cluster: cluster.id },
            viewer?.id,
          )
        : Promise.resolve(
            listFileDiscussions().filter(
              (post) => !post.price && post.clusterId === cluster.id,
            ),
          ),
      getClusterOverview(),
    ]);
    rooms = listings
      .filter(
        (value): value is Record<string, unknown> =>
          !!value && typeof value === "object",
      )
      .filter(
        (listing) =>
          listing.clusterId === cluster.id &&
          listing.verificationStatus === "verified",
      )
      .map((listing) => normalizeToRoomPost(listing));
    discussions = posts;
    const counts = overview.find((area) => area.id === cluster.id);
    roomCount = counts?.roomCount || 0;
    discussionCount = counts?.discussionCount || 0;
  } catch {
    unavailable = true;
  }
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <section className="detail-hero">
          <div className="container">
            <div className="breadcrumb">
              <Link href="/">Trang chủ</Link> / <Link href="/cum">Khu vực</Link>{" "}
              / {cluster.name}
            </div>
            <div className="detail-card">
              <span className="eyebrow">Cộng đồng khu vực</span>
              <h1>{cluster.name}</h1>
              <p className="detail-lead">{cluster.description}</p>
              {unavailable ? (
                <p role="alert">
                  Chưa thể tải dữ liệu khu vực. Vui lòng tải lại trang sau.
                </p>
              ) : (
                <div className="fact-grid">
                  <div className="fact">
                    <span>Phòng công khai</span>
                    <b>{roomCount}</b>
                  </div>
                  <div className="fact">
                    <span>Thảo luận</span>
                    <b>{discussionCount}</b>
                  </div>
                </div>
              )}
              {!!cluster.schools.length && (
                <div className="school-list">
                  {cluster.schools.map((school) => (
                    <span key={school}>{school}</span>
                  ))}
                </div>
              )}
              <Link
                className="text-link"
                href={`/bang-tin?cluster=${cluster.id}`}
              >
                Tìm và lọc phòng tại đây →
              </Link>
            </div>
          </div>
        </section>
        {!unavailable && (
          <section className="section">
            <div className="container">
              <div className="section-head">
                <div>
                  <h2>Phòng tại {cluster.name}</h2>
                  <p>Chỉ hiển thị tin đã duyệt còn trong thời hạn cập nhật.</p>
                </div>
              </div>
              <div className="post-list">
                {rooms.length ? (
                  rooms.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      authenticated={Boolean(viewer)}
                    />
                  ))
                ) : (
                  <div className="empty-feed">
                    <strong>Chưa có phòng công khai trong khu vực này</strong>
                    <span>
                      Tin chờ duyệt sẽ xuất hiện sau khi Admin kiểm tra và phê
                      duyệt.
                    </span>
                  </div>
                )}
              </div>
              {roomCount > rooms.length && (
                <Link
                  className="text-link"
                  href={`/bang-tin?cluster=${cluster.id}`}
                >
                  Xem tất cả {roomCount} phòng →
                </Link>
              )}
              <div className="section-head">
                <div>
                  <h2>Thảo luận tại {cluster.name}</h2>
                </div>
              </div>
              <div className="post-list">
                {discussions.length ? (
                  discussions.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      authenticated={Boolean(viewer)}
                    />
                  ))
                ) : (
                  <div className="empty-feed">
                    <strong>Chưa có thảo luận công khai</strong>
                    <span>
                      Bạn có thể đặt câu hỏi và chia sẻ kinh nghiệm tại trang
                      thảo luận.
                    </span>
                  </div>
                )}
              </div>
              <Link
                className="text-link"
                href={`/thao-luan?cluster=${cluster.id}`}
              >
                Đến trang thảo luận →
              </Link>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
