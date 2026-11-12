"use client";
import { useAccountStatus } from "@/components/useAccountStatus";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { RoomPost } from "@/lib/data";
import StartChat from "@/components/StartChat";
import CommentThread from "@/components/CommentThread";
import Icon from "@/components/Icons";
import RoomPhotoGallery from "@/components/RoomPhotoGallery";
export default function PostDetailClient({ id }: { id: string }) {
  const [post, setPost] = useState<RoomPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const [retry, setRetry] = useState(0);
  const { authenticated, revision: accountRevision } = useAccountStatus();
  const [commentCount, setCommentCount] = useState(0);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setMissing(false);
    setPost(null);
    fetch(`/api/community/posts/${encodeURIComponent(id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) {
          if (r.status === 404) setMissing(true);
          throw new Error(p.error);
        }
        if (!controller.signal.aborted) {
          setPost(p.data);
          setCommentCount(p.data.comments);
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error && e.name === "Error"
              ? e.message
              : "Chưa thể kết nối. Bạn hãy thử tải lại nhé.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id, retry, accountRevision]);
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setNotice("Đã sao chép liên kết.");
    } catch {
      setNotice("Bạn có thể sao chép địa chỉ từ thanh trình duyệt.");
    }
  }
  if (loading)
    return (
      <div className="content-shell detail-loading" role="status">
        <div className="skeleton skeleton-title" />
        <div className="skeleton skeleton-block" />
        <p>Đang mở nội dung cho bạn...</p>
      </div>
    );
  if (!post)
    return (
      <section className="content-shell route-empty">
        <Icon name={missing ? "search" : "message"} />
        <span className="section-eyebrow">
          {missing ? "Nội dung chưa khả dụng" : "Kết nối gián đoạn"}
        </span>
        <h1>{missing ? "Chưa tìm thấy bài đăng này" : "Mình thử lại nhé?"}</h1>
        <p>
          {missing
            ? "Bài đăng có thể chưa được duyệt, đã được ẩn hoặc liên kết không còn đúng."
            : error}
        </p>
        <div className="inline-actions">
          {!missing && (
            <button
              className="primary-btn"
              onClick={() => setRetry((v) => v + 1)}
            >
              Thử tải lại
            </button>
          )}
          <Link className="secondary-btn" href="/bang-tin">
            Tìm phòng khác
          </Link>
          <Link className="text-link" href="/thao-luan">
            Về cộng đồng
          </Link>
        </div>
      </section>
    );
  const room = Boolean(post.price);
  return (
    <div className="content-shell post-detail-page">
      <nav className="breadcrumb" aria-label="Đường dẫn">
        <Link href="/">Trang chủ</Link>
        <span aria-hidden="true">/</span>
        <Link href={room ? "/bang-tin" : "/thao-luan"}>
          {room ? "Tìm phòng" : "Thảo luận"}
        </Link>
        <span aria-hidden="true">/</span>
        <span>Chi tiết</span>
      </nav>
      <div className="post-detail-layout">
        <div>
          <article
            className={`detail-article ${room ? "is-room" : "is-discussion"}`}
          >
            {room && (
              <RoomPhotoGallery
                key={post.id}
                title={post.title}
                cover={post.imageUrl}
                images={post.imageUrls}
              />
            )}
            <div className="detail-article-body">
              <div className="card-context">
                <span className="category-pill">
                  {room
                    ? "Phòng cho thuê"
                    : post.postKind === "experience"
                      ? "Trải nghiệm"
                      : post.postKind === "warning"
                        ? "Cảnh báo"
                        : "Hỏi đáp"}
                </span>
                <span>{post.updated}</span>
              </div>
              <h1>{post.title}</h1>
              {!room && (
                <div className="detail-author">
                  <span className="person-avatar">
                    {(post.authorName ?? "C").slice(0, 1)}
                  </span>
                  <div>
                    <strong>{post.authorName || "Thành viên cộng đồng"}</strong>
                    <span>{post.clusterName}</span>
                  </div>
                </div>
              )}
              {room && (
                <>
                  <div className="detail-room-price">
                    <strong>{post.price}</strong>
                    {post.area && <span>{post.area}</span>}
                  </div>
                  <p className="room-location">
                    <Icon name="pin" />
                    {post.address || post.clusterName}
                  </p>
                  <hr />
                  <h2>Không gian & thông tin phòng</h2>
                </>
              )}
              <p className="full-description">{post.summary}</p>
              <div className="detail-bottom-line">
                <span>
                  <Icon name="message" />
                  {commentCount} bình luận
                </span>
                <button className="text-button" onClick={share}>
                  <Icon name="share" />
                  Chia sẻ
                </button>
              </div>
              {notice && <p role="status">{notice}</p>}
            </div>
          </article>
          <CommentThread
            id={id}
            authenticated={authenticated}
            onCount={setCommentCount}
          />
        </div>
        <aside className="detail-sidebar">
          {room ? (
            <section className="contact-card">
              <span className="section-eyebrow">Bạn quan tâm phòng này?</span>
              <h2>Hỏi thêm trước khi quyết định</h2>
              <StartChat listingId={id} />
              <p>Trao đổi về phí điện nước, tiền cọc và thời gian xem phòng.</p>
              {post.phone && (
                <a
                  className="primary-btn"
                  href={`tel:${post.phone.replace(/[^+\d]/g, "")}`}
                >
                  Gọi {post.phone}
                </a>
              )}
              <Link
                className={post.phone ? "secondary-btn" : "primary-btn"}
                href="#binh-luan"
              >
                <Icon name="message" />
                Đặt câu hỏi về phòng
              </Link>
              <p className="contact-note">
                <Icon name="check" />
                Nội dung đã được duyệt. Bạn vẫn nên xem phòng và kiểm tra hợp
                đồng trước khi đặt cọc.
              </p>
            </section>
          ) : (
            <section className="contact-card">
              <span className="section-eyebrow">
                Một câu hỏi, nhiều góc nhìn
              </span>
              <h2>Chia sẻ điều bạn biết</h2>
              <p>
                Một trải nghiệm thực tế có thể giúp người khác tìm được chỗ ở
                phù hợp hơn.
              </p>
              <Link className="primary-btn" href="#binh-luan">
                <Icon name="message" />
                Tham gia thảo luận
              </Link>
            </section>
          )}
          <section className="neighborhood-note">
            <Icon name="pin" />
            <h3>{post.clusterName}</h3>
            <p>Khám phá thêm những lựa chọn và câu chuyện quanh khu vực.</p>
            <Link className="text-link" href={`/cum/${post.clusterId}`}>
              Xem khu vực
              <Icon name="arrow" />
            </Link>
          </section>
          <Link className="back-link" href={room ? "/bang-tin" : "/thao-luan"}>
            ← {room ? "Về danh sách phòng" : "Về các thảo luận"}
          </Link>
        </aside>
      </div>
    </div>
  );
}
