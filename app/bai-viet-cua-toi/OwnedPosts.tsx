"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { clusters } from "@/lib/data";
type Post = {
  id: string;
  title: string;
  summary: string;
  clusterId: string;
  postKind: string;
  status: string;
  version: number;
};
const labels: Record<string, string> = {
  verified: "Đã duyệt",
  needs_review: "Chờ duyệt",
  rejected: "Bị từ chối",
};
export default function OwnedPosts() {
  const [items, setItems] = useState<Post[]>([]),
    [editing, setEditing] = useState<Post | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [guest, setGuest] = useState(false),
    [offset, setOffset] = useState(0),
    [hasMore, setHasMore] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    setLoading(true);
    setError("");
    fetch("/api/me/posts?offset=" + offset, {
      cache: "no-store",
      signal: c.signal,
    })
      .then(async (r) => {
        const p = await r.json();
        if (c.signal.aborted) return;
        if (r.status === 401) setGuest(true);
        if (!r.ok) throw new Error(p.error);
        setGuest(false);
        setItems(p.data.items);
        setHasMore(p.data.hasMore);
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setError(e instanceof Error ? e.message : "Chưa tải được bài viết.");
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [offset, revision]);
  async function mutate(post: Post, remove: boolean) {
    if (busy) return;
    if (
      remove &&
      !window.confirm(
        "Xóa bài thảo luận này? Bài và các bình luận trong bài sẽ không còn công khai.",
      )
    )
      return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(
        "/api/community/posts/" + encodeURIComponent(post.id),
        {
          method: remove ? "DELETE" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(post),
        },
      );
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setEditing(null);
      setOffset(0);
      setRevision((v) => v + 1);
      setNotice(
        remove
          ? "Đã xóa bài viết."
          : "Đã lưu. Bài viết đang chờ Admin duyệt lại.",
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Chưa thể lưu. Nội dung vẫn được giữ lại.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (guest)
    return (
      <Link className="primary-btn" href="/dang-nhap?next=%2Fbai-viet-cua-toi">
        Đăng nhập để quản lý bài viết
      </Link>
    );
  return (
    <>
      <Link className="primary-btn" href="/thao-luan">
        Viết thảo luận
      </Link>
      {error && (
        <div role="alert" className="feedback feedback-error">
          <p>{error}</p>
          <button
            className="secondary-btn"
            disabled={busy}
            onClick={() => {
              setEditing(null);
              setRevision((v) => v + 1);
            }}
          >
            Tải lại danh sách
          </button>
        </div>
      )}
      {notice && (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p role="status">Đang tải bài viết...</p>
      ) : !items.length && !error ? (
        <p>Bạn chưa có bài thảo luận nào.</p>
      ) : (
        <div className="management-grid">
          {items.map((post) => (
            <article className="management-card" key={post.id}>
              <span className="category-pill">
                {labels[post.status] || post.status}
              </span>
              {editing?.id === post.id ? (
                <form
                  className="listing-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void mutate(editing, false);
                  }}
                >
                  <label htmlFor="owned-title">Tiêu đề</label>
                  <input
                    id="owned-title"
                    value={editing.title}
                    onChange={(e) =>
                      setEditing({ ...editing, title: e.target.value })
                    }
                    minLength={5}
                    maxLength={120}
                    required
                  />
                  <label htmlFor="owned-summary">Nội dung</label>
                  <textarea
                    id="owned-summary"
                    value={editing.summary}
                    onChange={(e) =>
                      setEditing({ ...editing, summary: e.target.value })
                    }
                    minLength={20}
                    maxLength={3000}
                    required
                    rows={6}
                  />
                  <label htmlFor="owned-cluster">Khu vực</label>
                  <select
                    id="owned-cluster"
                    value={editing.clusterId}
                    onChange={(e) =>
                      setEditing({ ...editing, clusterId: e.target.value })
                    }
                  >
                    {clusters.map((area) => (
                      <option key={area.id} value={area.id}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="owned-kind">Loại thảo luận</label>
                  <select
                    id="owned-kind"
                    value={editing.postKind}
                    onChange={(e) =>
                      setEditing({ ...editing, postKind: e.target.value })
                    }
                  >
                    <option value="question">Hỏi đáp</option>
                    <option value="experience">Trải nghiệm</option>
                    <option value="warning">Cảnh báo</option>
                  </select>
                  <div className="management-actions">
                    <button className="primary-btn" disabled={busy}>
                      Lưu và gửi duyệt lại
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      Hủy chỉnh sửa
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <h2>{post.title}</h2>
                  <p>{post.summary}</p>
                  <div className="management-actions">
                    <button
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() => setEditing({ ...post })}
                    >
                      Sửa bài viết
                    </button>
                    <button
                      className="secondary-btn"
                      disabled={busy}
                      onClick={() => void mutate(post, true)}
                    >
                      Xóa bài viết
                    </button>
                    {post.status === "verified" && (
                      <Link className="text-link" href={"/bai/" + post.id}>
                        Xem công khai
                      </Link>
                    )}
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
      <div className="management-actions">
        <button
          className="secondary-btn"
          disabled={busy || loading || offset === 0}
          onClick={() => {
            setEditing(null);
            setOffset((v) => Math.max(0, v - 20));
          }}
        >
          Trang trước
        </button>
        <button
          className="secondary-btn"
          disabled={busy || loading || !hasMore}
          onClick={() => {
            setEditing(null);
            setOffset((v) => v + 20);
          }}
        >
          Trang sau
        </button>
      </div>
    </>
  );
}
