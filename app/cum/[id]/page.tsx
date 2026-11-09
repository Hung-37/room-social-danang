import Header from '@/components/Header';
import PostCard from '@/components/PostCard';
import { clusters, type RoomPost, normalizeToRoomPost } from '@/lib/data';
import { getListings, hasDatabaseConfig } from '@/lib/db';
import { readScrapedListings } from '@/lib/file-storage';
import Link from 'next/link';

export default async function ClusterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cluster = clusters.find((item) => item.id === id) ?? clusters[0];
  const listings = hasDatabaseConfig()
    ? await getListings().catch(() => [])
    : readScrapedListings({ includeStale: false }) as Array<{
      externalId: string; title: string; price: number | null; area: number | null;
      clusterId: string | null; trustScore: number; verificationStatus: string;
      imageUrl?: string | null; sourceUrl?: string | null; address?: string | null; summary: string;
    }>;
  const clusterPosts: RoomPost[] = listings
    .filter((listing) => listing.clusterId === cluster.id)
    .map((listing) => normalizeToRoomPost(listing));

  return (
    <>
      <Header />
      <main>
        <section className="detail-hero">
          <div className="container">
            <div className="breadcrumb"><Link href="/">Trang chủ</Link> / Cụm sinh viên</div>
            <div className="detail-card">
              <span className="eyebrow">Cộng đồng khu vực</span>
              <h1>📍 {cluster.name}</h1>
              <p className="detail-lead">{cluster.short}. Cộng đồng tập trung vào tìm phòng, chia sẻ kinh nghiệm và kiểm chứng thông tin cho sinh viên.</p>
              <div className="fact-grid">
                <div className="fact"><span>Trường</span><b>{cluster.schools.length}</b></div>
                <div className="fact"><span>Phòng đã tải</span><b>{clusterPosts.length || 'Chưa có dữ liệu'}</b></div>
                <div className="fact"><span>Thảo luận</span><b>Chưa có dữ liệu</b></div>
              </div>
              <div className="school-list">
                {cluster.schools.map((school) => <span key={school}>🎓 {school}</span>)}
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-head">
              <div>
                <h2>🏠 Phòng & bài tổng hợp</h2>
                <p>Những nội dung đang được cộng đồng quan tâm trong cụm này.</p>
              </div>
            </div>
            <div className="post-list">
              {clusterPosts.length ? clusterPosts.map((post) => <PostCard key={post.id} post={post} />) : <div className="empty-feed"><strong>Chưa có tin thật trong cụm này</strong><span>Dữ liệu sẽ xuất hiện sau khi nguồn được cấp phép đồng bộ hoặc người dùng nhập tin.</span></div>}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
