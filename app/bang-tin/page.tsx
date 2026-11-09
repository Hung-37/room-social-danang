import Header from '@/components/Header';
import { clusters } from '@/lib/data';

export default function BangTinPage() {
  return (
    <>
      <Header />
      <main className="page-main">
        <div className="container page-layout">
          <div className="page-feed">
            <div className="page-header">
              <h1>🏠 Bản tin phòng trọ</h1>
              <p>Cập nhật tin phòng trọ mới nhất từ các nguồn uy tín</p>
            </div>
            <div className="filter-bar">
              <input type="text" placeholder="Tìm kiếm..." className="search-box" />
              <select className="filter-select">
                <option value="">Tất cả khu vực</option>
                {clusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
                ))}
              </select>
              <select className="filter-select">
                <option value="newest">Mới nhất</option>
                <option value="price_asc">Giá thấp đến cao</option>
                <option value="price_desc">Giá cao đến thấp</option>
              </select>
            </div>
            <div className="post-list">
              <p className="empty-state">Đang tải tin...</p>
            </div>
          </div>
          <aside className="page-sidebar">
            <div className="sidebar-card">
              <h3>Khu vực</h3>
              <div className="cluster-list">
                {clusters.map((cluster) => (
                  <a key={cluster.id} href={`/cum/${cluster.id}`} className="cluster-item">
                    {cluster.name}
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <footer className="footer">
        <div className="container">
          <p>© 2024 RoomĐàNẵng - Cộng đồng phòng trọ Đà Nẵng</p>
        </div>
      </footer>
    </>
  );
}
