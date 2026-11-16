"use client";
import { useAccountStatus } from "./useAccountStatus";
import { useLoginModal } from "./LoginModalProvider";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "./Header";
import PostCard from "./PostCard";
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
        ? "/api/listings?limit=6"
        : "/api/community/posts?limit=3",
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

function HomeAuthQueryTrigger({ authenticated }: { authenticated: boolean }) {
  const { openLoginModal } = useLoginModal();
  const searchParams = useSearchParams();

  useEffect(() => {
    const openLogin = searchParams.get("openLogin");
    const openRegister = searchParams.get("openRegister");
    if (openLogin === "true" && !authenticated) {
      openLoginModal("login", "/");
    } else if (openRegister === "true" && !authenticated) {
      openLoginModal("register", "/");
    }
  }, [searchParams, authenticated, openLoginModal]);

  return null;
}

export default function SocialHome() {
  const { authenticated, revision: accountRevision } = useAccountStatus();
  const { openLoginModal } = useLoginModal();
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
      <Suspense fallback={null}>
        <HomeAuthQueryTrigger authenticated={authenticated} />
      </Suspense>
      <Header />
      <main className="public-home">
        {/* Hero Section */}
        <section className="hero-section">
          <div className="container">
            <div className="hero-content">
              <div className="hero-badge">🏠 RoomĐàNẵng</div>
              <h1 className="hero-title">Tìm phòng trọ uy tín tại Đà Nẵng</h1>
              <p className="hero-subtitle">
                Xem tin phòng theo khu vực và tham gia thảo luận cùng cộng đồng.
              </p>
              <div className="hero-stats">
                <div className="stat-item">
                  <span className="stat-number">{clusters.length}</span>
                  <span className="stat-label">Khu vực</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">Miễn phí</span>
                  <span className="stat-label">Không phí dịch vụ</span>
                </div>
              </div>
              <div className="hero-actions">
                <Link href="/bang-tin" className="btn btn-primary btn-lg">
                  🏠 Xem tin phòng
                </Link>
                <Link href="/thao-luan" className="btn btn-secondary btn-lg">
                  💬 Thảo luận
                </Link>
              </div>
              {!authenticated && (
                <div className="hero-auth">
                  <p>Đăng nhập để đăng tin và tham gia cộng đồng</p>
                  <button className="btn btn-outline" onClick={() => openLoginModal("login", "/")}>
                    Đăng nhập ngay
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Quick Links */}
        <section className="quick-links-section">
          <div className="container">
            <div className="quick-links">
              <Link href="/bang-tin" className="quick-link-card">
                <div className="quick-link-icon">🏠</div>
                <h3>Tìm phòng trọ</h3>
                <p>Xem tin đăng theo khu vực và ngân sách</p>
              </Link>
              <Link href="/thao-luan" className="quick-link-card">
                <div className="quick-link-icon">💬</div>
                <h3>Hỏi kinh nghiệm</h3>
                <p>Tham gia thảo luận với cộng đồng</p>
              </Link>
              <Link href="/cum" className="quick-link-card">
                <div className="quick-link-icon">📍</div>
                <h3>Khám phá khu vực</h3>
                <p>Tìm hiểu về các khu vực ở Đà Nẵng</p>
              </Link>
            </div>
          </div>
        </section>

        {/* Featured Rooms */}
        <section className="featured-section">
          <div className="container">
            <div className="section-header">
              <h2>Tin đăng mới nhất</h2>
              <Link href="/bang-tin" className="view-all-link">
                Xem tất cả →
              </Link>
            </div>
            {loadingRooms ? (
              <div className="loading-grid">
                {[1, 2, 3].map((i) => (
                  <div className="skeleton-card" key={i} />
                ))}
              </div>
            ) : roomError ? (
              <div className="error-state">
                <p>Không thể tải tin đăng lúc này.</p>
                <button className="btn btn-secondary" onClick={retryRooms}>
                  Thử lại
                </button>
              </div>
            ) : rooms.length ? (
              <>
                <div className="rooms-grid">
                  {rooms.map((post) => (
                    <PostCard
                      key={`${accountRevision}:${post.id}`}
                      post={post}
                      authenticated={authenticated}
                    />
                  ))}
                </div>
                <div className="featured-footer-action">
                  <Link href="/bang-tin" className="btn btn-secondary btn-lg">
                    Xem tất cả tin đăng
                  </Link>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">📭</div>
                <h3>Chưa có tin đăng nào</h3>
                <p>Tin sẽ xuất hiện sau khi được hệ thống thu thập và kiểm duyệt.</p>
              </div>
            )}
          </div>
        </section>

        {/* Areas Section */}
        <section className="areas-section">
          <div className="container">
            <div className="section-header">
              <h2>Khu vực phổ biến</h2>
              <Link href="/cum" className="view-all-link">
                Xem tất cả →
              </Link>
            </div>
            <div className="areas-grid">
              {clusters
                .filter((c) => c.id !== "chua-phan-cum")
                .slice(0, 6)
                .map((cluster) => (
                  <Link
                    key={cluster.id}
                    href={`/cum/${cluster.id}`}
                    className="area-card"
                  >
                    <div className="area-icon">{cluster.id === "bach-khoa-su-pham" ? "🎓" : cluster.id === "hoa-cuong" ? "🏢" : cluster.id === "hai-chau" ? "🏙️" : cluster.id === "ngu-hanh-son" ? "🏖️" : cluster.id === "nam-da-nang" ? "🏫" : "📍"}</div>
                    <h3>{cluster.name}</h3>
                    <p>{cluster.short}</p>
                    {cluster.schools.length > 0 && (
                      <div className="area-schools">
                        {cluster.schools.join(" · ")}
                      </div>
                    )}
                  </Link>
                ))}
            </div>
          </div>
        </section>

        {/* Community Section */}
        <section className="community-section">
          <div className="container">
            <div className="community-content">
              <div className="community-text">
                <h2>Tham gia cộng đồng sinh viên</h2>
                <p>
                  Chia sẻ kinh nghiệm, hỏi đáp về phòng trọ, cùng nhau xây dựng
                  một cộng đồng hữu ích cho sinh viên Đà Nẵng.
                </p>
                <Link href="/thao-luan" className="btn btn-primary">
                  Tham gia ngay →
                </Link>
              </div>
              <div className="community-discussions">
                {loadingDiscussions ? (
                  <div className="skeleton-block" />
                ) : discussionError ? (
                  <div className="error-state">
                    <p>Không thể tải thảo luận.</p>
                    <button
                      className="btn btn-secondary"
                      onClick={retryDiscussions}
                    >
                      Thử lại
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
                  <div className="empty-state">
                    <p>Chưa có thảo luận nào. Hãy là người đầu tiên!</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <div className="container">
            <div className="cta-content">
              <h2>Bạn có phòng trọ cho thuê?</h2>
              <p>
                Đăng tin miễn phí, tiếp cận hàng ngàn sinh viên đang tìm phòng
                tại Đà Nẵng.
              </p>
              <Link href="/dang-phong" className="btn btn-primary btn-lg">
                Đăng tin ngay
              </Link>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
