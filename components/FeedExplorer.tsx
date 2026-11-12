"use client";
import { useAccountStatus } from "./useAccountStatus";
import { useSubmissionKey } from "./useSubmissionKey";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Header from "./Header";
import ManagementPager from "./ManagementPager";
import Icon from "./Icons";
import PostCard from "./PostCard";
import { clusters, normalizeToRoomPost, type RoomPost } from "@/lib/data";

type Mode = "rooms" | "discussions";
export default function FeedExplorer({
  mode,
  initialQuery = "",
  initialCluster = "",
}: {
  mode: Mode;
  initialQuery?: string;
  initialCluster?: string;
}) {
  const rooms = mode === "rooms";
  const [query, setQuery] = useState(initialQuery);
  const [cluster, setCluster] = useState(initialCluster);
  const [kind, setKind] = useState("");
  const [sort, setSort] = useState("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [items, setItems] = useState<RoomPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const { authenticated, revision: accountRevision } = useAccountStatus();
  const [sending, setSending] = useState(false);
  const attempt = useSubmissionKey();
  const [message, setMessage] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const composerHeading = useRef<HTMLHeadingElement>(null);
  const composerTrigger = useRef<HTMLButtonElement>(null);
  function openComposer() {
    setComposerOpen(true);
    requestAnimationFrame(() => {
      composerHeading.current?.focus();
      composerHeading.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }
  function clearFilters() {
    setQuery("");
    setCluster("");
    setKind("");
    setSort("newest");
    setMinPrice("");
    setMaxPrice("");
  }
  const filterKey = JSON.stringify([
    accountRevision,
    query,
    cluster,
    kind,
    sort,
    minPrice,
    maxPrice,
  ]);
  const previousKey = useRef(filterKey);
  useEffect(() => {
    const changed = previousKey.current !== filterKey;
    previousKey.current = filterKey;
    if (changed && page !== 0) {
      setPage(0);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    if (rooms || page === 0) setItems([]);
    const timer = setTimeout(async () => {
      if (
        rooms &&
        minPrice &&
        maxPrice &&
        Number(minPrice) > Number(maxPrice)
      ) {
        setError("Giá từ phải nhỏ hơn hoặc bằng giá đến.");
        setLoading(false);
        setHasMore(false);
        return;
      }
      const params = new URLSearchParams({ limit: rooms ? "10" : "12", offset: String(page) });
      if (query.trim()) params.set("q", query.trim());
      if (cluster) params.set("cluster", cluster);
      if (rooms) {
        params.set("sort", sort);
        if (minPrice)
          params.set("minPrice", String(Number(minPrice) * 1000000));
        if (maxPrice)
          params.set("maxPrice", String(Number(maxPrice) * 1000000));
      } else if (kind) params.set("kind", kind);
      try {
        const r = await fetch(
          `${rooms ? "/api/listings" : "/api/community/posts"}?${params}`,
          {
            signal: controller.signal,
            cache: "no-store",
          },
        );
        const payload = await r.json();
        if (!r.ok) throw new Error(payload.error || "Không thể tải dữ liệu.");
        if (controller.signal.aborted) return;
        const data: RoomPost[] = rooms
          ? payload.data.map((item: Record<string, unknown>) =>
              normalizeToRoomPost(item),
            )
          : payload.data;
        setItems((current) =>
          rooms || page === 0
            ? data
            : [
                ...current,
                ...data.filter(
                  (item) =>
                    !current.some((existing) => existing.id === item.id),
                ),
              ],
        );
        if (rooms) {
          const count = Number(payload.meta?.count) || 0;
          setTotal(count);
          if (page > 0 && page >= count) {
            setPage(Math.max(0, Math.ceil(count / 10) - 1) * 10);
            return;
          }
        }
        setNext(payload.meta?.nextOffset ?? page + data.length);
        setHasMore(Boolean(payload.meta?.hasMore));
      } catch (e) {
        if (!controller.signal.aborted) {
          setError(
            e instanceof Error && e.name === "Error"
              ? e.message
              : "Mất kết nối.",
          );
          setHasMore(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [
    filterKey,
    accountRevision,
    page,
    refresh,
    rooms,
    query,
    cluster,
    kind,
    sort,
    minPrice,
    maxPrice,
  ]);
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSending(true);
    setMessage("");
    const data = Object.fromEntries(new FormData(form));
    try {
      const r = await fetch("/api/community/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.keyFor(data),
        },
        body: JSON.stringify(data),
      });
      const result = await r.json();
      if (r.status === 410) attempt.confirmed();
      if (!r.ok) throw new Error(result.error || "Không thể gửi bài.");
      attempt.confirmed();
      form.reset();
      setMessage(
        "Đã gửi bài. Nội dung sẽ xuất hiện sau khi quản trị viên duyệt.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error && e.name === "Error"
          ? e.message
          : "Mất kết nối. Vui lòng thử lại.",
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className={`content-shell explorer ${rooms ? "rooms-explorer" : "discussions-explorer"}`}
      >
        <nav className="breadcrumb" aria-label="Đường dẫn">
          <Link href="/">Trang chủ</Link>
          <span aria-hidden="true">/</span>
          <span>{rooms ? "Tìm phòng" : "Cộng đồng"}</span>
        </nav>
        <div className="explorer-heading">
          <div>
            <span className="section-eyebrow">
              {rooms ? "Tìm nơi ở phù hợp" : "Có cộng đồng cùng bạn"}
            </span>
            <h1>
              {rooms
                ? "Tìm phòng, theo cách của bạn."
                : "Mỗi câu hỏi, thêm một góc nhìn."}
            </h1>
            <p>
              {rooms
                ? "Lọc theo khu vực và ngân sách. Hỏi thêm trước khi quyết định."
                : "Cùng hỏi đáp, chia sẻ trải nghiệm và giúp nhau tìm chỗ ở."}
            </p>
          </div>
          {rooms ? (
            <Link className="secondary-btn" href="/dang-phong">
              Bạn có phòng cho thuê?
              <Icon name="arrow" />
            </Link>
          ) : (
            <button
              ref={composerTrigger}
              className="primary-btn"
              aria-expanded={composerOpen}
              aria-controls="viet-bai"
              onClick={openComposer}
            >
              <Icon name="message" />
              Viết thảo luận
            </button>
          )}
        </div>
        {!rooms && composerOpen && (
          <section className="composer-panel" id="viet-bai">
            <div className="section-title-row">
              <div>
                <span className="section-eyebrow">
                  Gửi một câu hỏi, chia sẻ một trải nghiệm
                </span>
                <h2 tabIndex={-1} ref={composerHeading}>
                  Viết thảo luận
                </h2>
              </div>
              <button
                className="quiet-icon"
                aria-label="Đóng biểu mẫu thảo luận"
                onClick={() => {
                  setComposerOpen(false);
                  composerTrigger.current?.focus();
                }}
              >
                <Icon name="close" />
              </button>
            </div>
            {authenticated ? (
              <form className="auth-form discussion-form" onSubmit={publish}>
                <label>
                  Tiêu đề
                  <input
                    name="title"
                    required
                    minLength={5}
                    maxLength={120}
                    placeholder="Ví dụ: Cần hỏi gì trước khi đặt cọc?"
                  />
                </label>
                <label>
                  Nội dung
                  <textarea
                    name="summary"
                    required
                    minLength={20}
                    maxLength={3000}
                    rows={4}
                    placeholder="Chia sẻ thêm tình huống để mọi người dễ hỗ trợ bạn..."
                  />
                </label>
                <div className="form-row">
                  <label>
                    Chủ đề bài viết
                    <select aria-label="Chủ đề bài viết" name="postKind">
                      <option value="question">Hỏi đáp</option>
                      <option value="experience">Trải nghiệm</option>
                      <option value="warning">Cảnh báo</option>
                    </select>
                  </label>
                  <label>
                    Khu vực bài viết
                    <select aria-label="Khu vực bài viết" name="clusterId">
                      {clusters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="composer-footer">
                  <p>Bài viết sẽ được duyệt trước khi xuất hiện công khai.</p>
                  <button className="primary-btn" disabled={sending}>
                    {sending ? "Đang gửi..." : "Gửi bài chờ duyệt"}
                    <Icon name="arrow" />
                  </button>
                </div>
                {message && (
                  <p role="status" className="feedback">
                    {message}
                  </p>
                )}
              </form>
            ) : (
              <div className="sign-in-callout">
                <div>
                  <strong>Một tài khoản, nhiều kết nối hơn</strong>
                  <p>
                    Đăng nhập để gửi câu hỏi, lưu phòng và tham gia trao đổi.
                  </p>
                </div>
                <Link
                  className="primary-btn"
                  href="/dang-nhap?next=%2Fthao-luan"
                >
                  Đăng nhập để viết bài
                </Link>
                <Link className="text-link" href="/dang-ky?next=%2Fthao-luan">
                  Tạo tài khoản
                </Link>
              </div>
            )}
          </section>
        )}
        <section className="explorer-filters" aria-label="Bộ lọc">
          <label>
            Tìm kiếm
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                rooms
                  ? "Tiêu đề, địa chỉ phòng..."
                  : "Tiêu đề, nội dung thảo luận..."
              }
            />
          </label>
          <label>
            Khu vực
            <select
              aria-label="Khu vực"
              value={cluster}
              onChange={(e) => setCluster(e.target.value)}
            >
              <option value="">Tất cả khu vực</option>
              {clusters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {rooms ? (
            <>
              <label>
                Giá từ (triệu/tháng)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </label>
              <label>
                Giá đến (triệu/tháng)
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </label>
              <label>
                Sắp xếp
                <select
                  aria-label="Sắp xếp"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="newest">Mới nhất</option>
                  <option value="price_asc">Giá thấp đến cao</option>
                  <option value="price_desc">Giá cao đến thấp</option>
                  <option value="area_desc">Diện tích lớn nhất</option>
                </select>
              </label>
            </>
          ) : (
            <label>
              Chủ đề
              <select
                aria-label="Chủ đề"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                <option value="">Tất cả chủ đề</option>
                <option value="question">Hỏi đáp</option>
                <option value="experience">Trải nghiệm</option>
                <option value="warning">Cảnh báo</option>
              </select>
            </label>
          )}
          <button className="secondary-btn" onClick={clearFilters}>
            Xóa bộ lọc
          </button>
        </section>
        <div className="explorer-layout">
          <section
            aria-label={rooms ? "Danh sách phòng" : "Danh sách thảo luận"}
            aria-busy={loading}
          >
            <h2 className="sr-only">
              {rooms ? "Danh sách phòng" : "Thảo luận mới"}
            </h2>
            {error && (
              <div className="management-card" role="alert">
                <p>{error}</p>
                <button
                  className="secondary-btn"
                  onClick={() => setRefresh((v) => v + 1)}
                >
                  Thử lại
                </button>
              </div>
            )}
            <p role="status">
              {loading
                ? "Đang tìm những nội dung phù hợp..."
                : `${items.length} ${rooms ? "phòng" : "thảo luận"} đang hiển thị`}
            </p>
            <div className={rooms ? "feed-room-grid" : "discussion-feed"}>
              {items.map((post) => (
                <PostCard
                  key={`${accountRevision}:${post.id}`}
                  post={post}
                  authenticated={authenticated}
                />
              ))}
            </div>
            {loading && !items.length && (
              <div className="feed-room-grid" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <div className="skeleton skeleton-card" key={i} />
                ))}
              </div>
            )}
            {!loading && !error && !items.length && (
              <div className="route-feedback">
                <Icon name="search" />
                <h2>Chưa tìm thấy kết quả phù hợp</h2>
                <p>Thử một từ khóa ngắn hơn hoặc mở rộng khu vực tìm kiếm.</p>
                <button className="secondary-btn" onClick={clearFilters}>
                  Xóa bộ lọc và xem lại
                </button>
              </div>
            )}
            {rooms && !error && (
              <ManagementPager meta={{ total, count: items.length, limit: 10, offset: page, hasMore, nextOffset: page + 10 }} disabled={loading} label="phòng trọ" position="cuối" onPage={setPage} />
            )}
            {!rooms && hasMore && (
              <button
                className="secondary-btn explorer-more"
                disabled={loading}
                onClick={() => setPage(next)}
              >
                {loading ? "Đang tải..." : "Xem thêm"}
              </button>
            )}
          </section>
          <aside className="explorer-guide">
            <section className="guide-card">
              <span className="guide-symbol">
                <Icon name={rooms ? "check" : "message"} />
              </span>
              <h2>
                {rooms
                  ? "Một chút lưu ý, thêm phần an tâm"
                  : "Một cộng đồng dễ chịu, bắt đầu từ chúng ta"}
              </h2>
              <p>
                {rooms
                  ? "Xem phòng trực tiếp, kiểm tra hợp đồng và xác minh người nhận tiền trước khi đặt cọc."
                  : "Chia sẻ thông tin có thể kiểm chứng. Không đăng số giấy tờ, địa chỉ riêng tư hoặc công kích cá nhân."}
              </p>
              <Link href={rooms ? "/thao-luan" : "/bang-tin"}>
                {rooms
                  ? "Hỏi kinh nghiệm trong cộng đồng →"
                  : "Xem bảng tin phòng trọ →"}
              </Link>
            </section>
            <section className="neighborhood-note">
              <span className="section-eyebrow">Lần đầu ghé RoomĐàNẵng?</span>
              <h3>Bắt đầu thật đơn giản</h3>
              <ol>
                <li>Tìm khu vực bạn muốn ở</li>
                <li>Đọc tin và hỏi điều còn băn khoăn</li>
                <li>Xem phòng trước khi đặt cọc</li>
              </ol>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
