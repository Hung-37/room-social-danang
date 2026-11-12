"use client";
import { useAccountStatus } from "./useAccountStatus";
import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "./Header";
import PostCard from "./PostCard";
import Icon from "./Icons";
import { clusters, normalizeToRoomPost, type RoomPost } from "@/lib/data";
function useHomeFeed(kind: "rooms" | "discussions", accountRevision: number) {
  const [items, setItems] = useState<RoomPost[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError(false);
    fetch(
      kind === "rooms"
        ? "/api/listings?limit=3"
        : "/api/community/posts?limit=2",
      { cache: "no-store", signal: c.signal },
    )
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw new Error();
        if (!c.signal.aborted)
          setItems(
            kind === "rooms"
              ? p.data.map((item: Record<string, unknown>) =>
                  normalizeToRoomPost(item),
                )
              : p.data,
          );
      })
      .catch(() => {
        if (!c.signal.aborted) setError(true);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [kind, retry, accountRevision]);
  return { items, loading, error, retry: () => setRetry((v) => v + 1) };
}
export default function SocialHome() {
  const { authenticated, revision: accountRevision } = useAccountStatus();
  const {
    items: rooms,
    loading: loadingRooms,
    error: roomError,
    retry: retryRooms,
  } = useHomeFeed("rooms", accountRevision);
  const {
    items: discussions,
    loading: loadingDiscussions,
    error: discussionError,
    retry: retryDiscussions,
  } = useHomeFeed("discussions", accountRevision);
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="public-home">
        <section className="home-hero content-shell">
          <div className="hero-copy">
            <span className="hero-kicker">
              <span />
              Tìm phòng, có cộng đồng bên cạnh
            </span>
            <h1>
              Một căn phòng vừa ý.
              <br />
              <em>Một khởi đầu an tâm.</em>
            </h1>
            <p>
              Tìm chỗ ở tại Đà Nẵng, hỏi kinh nghiệm người đi trước và chọn nơi
              phù hợp với bạn.
            </p>
            <form className="hero-search" action="/bang-tin">
              <label className="hero-search-query">
                <span>Bạn muốn ở đâu?</span>
                <div>
                  <Icon name="search" />
                  <input
                    name="q"
                    aria-label="Tìm phòng"
                    placeholder="Tên đường, trường học, khu vực..."
                  />
                </div>
              </label>
              <label className="hero-search-area">
                <span>Khu vực</span>
                <select name="cluster" aria-label="Khu vực tìm phòng">
                  <option value="">Tất cả khu vực</option>
                  {clusters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="primary-btn">
                Tìm phòng
                <Icon name="arrow" />
              </button>
            </form>
            <div className="hero-assurance">
              <span>
                <Icon name="check" />
                Tin được duyệt trước khi đăng
              </span>
              <span>
                <Icon name="message" />
                Hỏi đáp cùng cộng đồng
              </span>
            </div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-art-sun" />
            <div className="hero-art-building back-building">
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="hero-art-building front-building">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <span />
            </div>
            <div className="hero-art-plant" />
            <div className="hero-art-card">
              <span>R</span>
              <div>
                Một nơi để trở về.<small>Đà Nẵng, thành phố của bạn</small>
              </div>
            </div>
            <span className="art-dot one" />
            <span className="art-dot two" />
          </div>
        </section>
        <section
          className="content-shell quick-paths"
          aria-label="Bạn muốn làm gì?"
        >
          <Link href="/bang-tin">
            <span className="quick-icon">
              <Icon name="home" />
            </span>
            <div>
              <strong>Mình đang tìm phòng</strong>
              <span>Xem phòng theo khu vực và ngân sách</span>
            </div>
            <Icon name="arrow" />
          </Link>
          <Link href="/thao-luan">
            <span className="quick-icon peach">
              <Icon name="message" />
            </span>
            <div>
              <strong>Mình muốn hỏi kinh nghiệm</strong>
              <span>Ghé cộng đồng, cùng nhau giải đáp</span>
            </div>
            <Icon name="arrow" />
          </Link>
        </section>
        <section className="content-shell home-section" id="cum-sinh-vien">
          <div className="section-title-row">
            <div>
              <span className="section-eyebrow">Gần nơi học, tiện nơi làm</span>
              <h2>Bắt đầu từ khu vực của bạn</h2>
            </div>
            <Link className="text-link" href="/khu-vuc">
              Tất cả khu vực
              <Icon name="arrow" />
            </Link>
          </div>
          <div className="area-shortcuts">
            {clusters
              .filter((c) => c.id !== "chua-phan-cum")
              .map((c, i) => (
                <Link href={`/bang-tin?cluster=${c.id}`} key={c.id}>
                  <span className={`area-icon area-${i}`}>
                    <Icon name="pin" />
                  </span>
                  <strong>{c.name}</strong>
                  <span>{c.schools.slice(0, 2).join(" · ") || c.short}</span>
                </Link>
              ))}
          </div>
        </section>
        <section className="content-shell home-section" id="bang-tin">
          <div className="section-title-row">
            <div>
              <span className="section-eyebrow">
                Thêm lựa chọn cho hành trình mới
              </span>
              <h2>Phòng mới trên bảng tin</h2>
            </div>
            <Link className="text-link" href="/bang-tin">
              Xem tất cả phòng
              <Icon name="arrow" />
            </Link>
          </div>
          {loadingRooms ? (
            <div
              className="home-room-grid"
              role="status"
              aria-label="Đang tải phòng"
            >
              {[1, 2, 3].map((i) => (
                <div className="skeleton skeleton-card" key={i} />
              ))}
            </div>
          ) : roomError ? (
            <div className="route-feedback" role="alert">
              <p>Chưa thể tải bảng tin lúc này.</p>
              <button className="secondary-btn" onClick={retryRooms}>
                Thử tải lại phòng
              </button>
              <Link className="secondary-btn" href="/bang-tin">
                Mở bảng tin để thử lại
              </Link>
            </div>
          ) : rooms.length ? (
            <div className="home-room-grid">
              {rooms.map((post) => (
                <PostCard
                  key={`${accountRevision}:${post.id}`}
                  post={post}
                  authenticated={authenticated}
                />
              ))}
            </div>
          ) : (
            <div className="route-feedback">
              <h3>Những căn phòng mới đang được chuẩn bị</h3>
              <p>
                Tin sẽ xuất hiện sau khi được duyệt. Bạn có thể ghé cộng đồng để
                hỏi trước về khu vực.
              </p>
              <Link className="text-link" href="/thao-luan">
                Ghé thảo luận
                <Icon name="arrow" />
              </Link>
            </div>
          )}
        </section>
        <section className="community-home-band">
          <div className="content-shell home-discussions">
            <div className="community-intro">
              <span className="section-eyebrow">
                Chọn phòng, có thêm góc nhìn
              </span>
              <h2>
                Không cần tìm
                <br />
                chỗ ở một mình.
              </h2>
              <p>
                Từ chuyện tiền cọc, giờ giấc đến kinh nghiệm sống gần trường —
                cùng hỏi và chia sẻ.
              </p>
              <Link className="primary-btn" href="/thao-luan">
                Tham gia cộng đồng
                <Icon name="arrow" />
              </Link>
            </div>
            <div>
              {loadingDiscussions ? (
                <div className="skeleton skeleton-block" />
              ) : discussionError ? (
                <div className="route-feedback" role="alert">
                  <p>Chưa thể tải thảo luận lúc này.</p>
                  <button className="secondary-btn" onClick={retryDiscussions}>
                    Thử tải lại thảo luận
                  </button>
                </div>
              ) : discussions.length ? (
                discussions.map((post) => (
                  <PostCard
                    key={`${accountRevision}:${post.id}`}
                    post={post}
                    authenticated={authenticated}
                  />
                ))
              ) : (
                <div className="community-invitation">
                  <Icon name="message" />
                  <h3>Câu hỏi đầu tiên có thể đến từ bạn</h3>
                  <p>Gửi thắc mắc và cùng xây dựng một cộng đồng hữu ích.</p>
                  <Link className="text-link" href="/thao-luan">
                    Viết thảo luận
                    <Icon name="arrow" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
        <section className="content-shell landlord-invitation">
          <div>
            <span className="section-eyebrow">Dành cho chủ trọ</span>
            <h2>Bạn có một căn phòng đang chờ người ở?</h2>
            <p>
              Xác minh tài khoản, gửi thông tin và theo dõi tin đăng ở một nơi.
            </p>
          </div>
          <Link className="secondary-btn" href="/quan-ly-phong">
            Đến khu vực chủ trọ
            <Icon name="arrow" />
          </Link>
        </section>
      </main>
      <footer className="public-footer content-shell">
        <Link className="footer-brand" href="/">
          Room<span>ĐàNẵng</span>
        </Link>
        <p>Một nơi ở phù hợp. Một cộng đồng gần gũi.</p>
        <span>© {new Date().getFullYear()} RoomĐàNẵng</span>
      </footer>
    </>
  );
}
