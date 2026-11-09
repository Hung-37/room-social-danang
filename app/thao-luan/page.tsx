import Header from '@/components/Header';
import { clusters } from '@/lib/data';

export default function ThaoLuanPage() {
  return (
    <>
      <Header />
      <main className="page-main">
        <div className="container page-layout">
          <div className="page-feed">
            <div className="page-header">
              <h1>💬 Thảo luận cộng đồng</h1>
              <p>Chia sẻ kinh nghiệm, hỏi đáp và đánh giá khu vực</p>
            </div>
            <div className="filter-bar">
              <input type="text" placeholder="Tìm thảo luận..." className="search-box" />
              <select className="filter-select">
                <option value="">Tất cả chủ đề</option>
                <option value="question">Hỏi đáp</option>
                <option value="experience">Trải nghiệm</option>
                <option value="warning">Cảnh báo</option>
              </select>
              <select className="filter-select">
                <option value="">Tất cả khu vực</option>
                {clusters.map((cluster) => (
                  <option key={cluster.id} value={cluster.id}>{cluster.name}</option>
                ))}
              </select>
            </div>
            <div className="post-list">
              <p className="empty-state">Đang tải thảo luận...</p>
            </div>
          </div>
          <aside className="page-sidebar">
            <div className="sidebar-card">
              <h3>Chủ đề hot</h3>
              <div className="topic-list">
                <a href="#" className="topic-item">Hỏi về giá thuê</a>
                <a href="#" className="topic-item">Đánh giá chủ nhà</a>
                <a href="#" className="topic-item">Khu vực an toàn</a>
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
