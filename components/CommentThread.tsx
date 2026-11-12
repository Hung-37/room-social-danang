"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import Icon from "./Icons";
type Comment = {
  id: string;
  version?: number;
  isMine?: boolean;
  authorName: string;
  text: string;
  createdAt: string;
  parentId?: string;
  parentAuthor?: string;
  parentText?: string;
  isOwner?: number;
  verifiedLandlord?: number;
};
export default function CommentThread({
  id,
  authenticated,
  onCount,
}: {
  id: string;
  authenticated: boolean;
  onCount: (count: number) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [next, setNext] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<Comment | null>(null);
  const [editText, setEditText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const endpoint = `/api/community/posts/${encodeURIComponent(id)}/comments`;
  const load = useCallback(
    async (offset = 0, signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const r = await fetch(`${endpoint}?limit=20&offset=${offset}`, {
          cache: "no-store",
          signal,
        });
        const p = await r.json();
        if (!r.ok) throw new Error(p.error);
        if (signal?.aborted) return;
        setComments((current) =>
          offset === 0
            ? p.data
            : [
                ...current,
                ...p.data.filter(
                  (c: Comment) => !current.some((item) => item.id === c.id),
                ),
              ],
        );
        setTotal(p.meta.total);
        onCount(p.meta.total);
        setNext(p.meta.nextOffset);
        setHasMore(p.meta.hasMore);
      } catch (e) {
        if (!signal?.aborted)
          setError(
            e instanceof Error && e.name === "Error"
              ? e.message
              : "Chưa thể tải bình luận.",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint, onCount],
  );
  useEffect(() => {
    const controller = new AbortController();
    setComments([]);
    void load(0, controller.signal);
    return () => controller.abort();
  }, [load]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const value = text.trim();
    if (value.length < 2) {
      setError("Vui lòng nhập ít nhất 2 ký tự.");
      return;
    }
    setSending(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: value, parentId: replyTo?.id }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setComments((current) => [
        p.data,
        ...current.filter((c) => c.id !== p.data.id),
      ]);
      setTotal(p.count);
      onCount(p.count);
      setNext((v) => v + 1);
      setText("");
      setReplyTo(null);
      setNotice("Đã gửi bình luận. Cảm ơn bạn đã chia sẻ!");
    } catch (e) {
      setError(
        e instanceof Error && e.name === "Error"
          ? e.message
          : "Không thể gửi bình luận. Nội dung bạn nhập được giữ lại để thử lại.",
      );
    } finally {
      setSending(false);
    }
  }
  async function mutate(comment: Comment, remove: boolean) {
    if (sending) return;
    if (
      remove &&
      !window.confirm(
        "Xóa bình luận của bạn? Các phản hồi của người khác vẫn được giữ.",
      )
    )
      return;
    setSending(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch(`${endpoint}/${encodeURIComponent(comment.id)}`, {
        method: remove ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: comment.version, text: editText }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setEditing(null);
      if (replyTo?.id === comment.id) setReplyTo(null);
      await load(0);
      setNotice(remove ? "Đã xóa bình luận." : "Đã lưu bình luận.");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Chưa thể lưu thay đổi. Nội dung vẫn được giữ lại.",
      );
    } finally {
      setSending(false);
    }
  }
  return (
    <section
      id="binh-luan"
      className="comment-panel"
      aria-labelledby="comment-heading"
    >
      <div className="section-title-row">
        <div>
          <span className="section-eyebrow">Cùng trao đổi</span>
          <h2 id="comment-heading">
            Bình luận <span className="count-pill">{total}</span>
          </h2>
        </div>
        <span className="subtle-text">Mới nhất trước</span>
      </div>
      {authenticated ? (
        <form className="comment-form" onSubmit={submit}>
          <label htmlFor="comment-text">
            Bạn muốn hỏi hoặc chia sẻ điều gì?
          </label>
          {replyTo && (
            <div className="reply-quote">
              <strong>Trả lời {replyTo.authorName}</strong>
              <p>{replyTo.text.slice(0, 180)}</p>
              <button
                type="button"
                className="text-button"
                onClick={() => setReplyTo(null)}
              >
                Hủy trả lời
              </button>
            </div>
          )}
          <textarea
            id="comment-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
            minLength={2}
            maxLength={2000}
            rows={3}
            placeholder="Ví dụ: Phòng có chỗ để xe và giờ giấc như thế nào?"
            aria-describedby="comment-hint"
          />
          <div className="comment-form-footer">
            <small id="comment-hint">
              Trao đổi lịch sự, không chia sẻ thông tin nhạy cảm. {text.length}
              /2000
            </small>
            <button
              className="primary-btn"
              disabled={sending || loading}
              type="submit"
            >
              {sending ? "Đang gửi..." : "Gửi bình luận"}
              <Icon name="arrow" />
            </button>
          </div>
        </form>
      ) : (
        <div className="sign-in-callout">
          <span className="callout-icon">
            <Icon name="message" />
          </span>
          <div>
            <strong>Cùng tham gia cuộc trò chuyện</strong>
            <p>Bạn có thể đọc tự do. Đăng nhập để đặt câu hỏi hoặc chia sẻ.</p>
          </div>
          <Link
            className="primary-btn"
            href={`/dang-nhap?next=${encodeURIComponent(`/bai/${id}#binh-luan`)}`}
          >
            Đăng nhập
          </Link>
        </div>
      )}
      {error && (
        <div className="feedback feedback-error" role="alert">
          <p>{error}</p>
          {!sending && (
            <button className="text-button" onClick={() => void load(0)}>
              Tải lại bình luận
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="feedback feedback-success" role="status">
          {notice}
        </p>
      )}
      {loading && !comments.length ? (
        <p role="status" className="loading-line">
          Đang tải bình luận...
        </p>
      ) : !comments.length && !error ? (
        <div className="empty-conversation">
          <Icon name="message" />
          <h3>Hãy bắt đầu cuộc trò chuyện</h3>
          <p>Câu hỏi của bạn cũng có thể giúp một người đang tìm phòng.</p>
        </div>
      ) : (
        <div className="comments-stream">
          {comments.map((c) => (
            <article key={c.id} className="comment-item">
              <span className="person-avatar" aria-hidden="true">
                {c.authorName.slice(0, 1)}
              </span>
              <div>
                <div className="comment-meta">
                  <strong>{c.authorName}</strong>
                  {Boolean(c.isOwner) && (
                    <span className="category-pill">Chủ phòng</span>
                  )}
                  {Boolean(c.verifiedLandlord) && (
                    <span className="category-pill">Chủ trọ đã xác minh</span>
                  )}
                  <time dateTime={c.createdAt}>
                    {new Date(c.createdAt).toLocaleString("vi-VN", {
                      dateStyle: "short",
                      timeStyle: "short",
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}
                  </time>
                </div>
                <div id={`comment-${c.id}`} />
                {c.parentId && (
                  <blockquote className="reply-quote">
                    <strong>Trả lời {c.parentAuthor}</strong>
                    <p>{c.parentText}</p>
                  </blockquote>
                )}
                {editing?.id === c.id ? (
                  <form
                    className="comment-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void mutate(c, false);
                    }}
                  >
                    <label htmlFor={`edit-${c.id}`}>Nội dung bình luận</label>
                    <textarea
                      id={`edit-${c.id}`}
                      value={editText}
                      onChange={(event) => setEditText(event.target.value)}
                      minLength={2}
                      maxLength={2000}
                      required
                      rows={3}
                    />
                    <div className="management-actions">
                      <button className="primary-btn" disabled={sending}>
                        Lưu bình luận
                      </button>
                      <button
                        className="secondary-btn"
                        type="button"
                        disabled={sending}
                        onClick={() => setEditing(null)}
                      >
                        Hủy chỉnh sửa
                      </button>
                    </div>
                  </form>
                ) : (
                  <p>{c.text}</p>
                )}
                {c.isMine && authenticated && (
                  <div className="management-actions">
                    <button
                      className="text-button"
                      disabled={sending}
                      onClick={() => {
                        setEditing(c);
                        setEditText(c.text);
                      }}
                    >
                      Sửa bình luận
                    </button>
                    <button
                      className="text-button"
                      disabled={sending}
                      onClick={() => void mutate(c, true)}
                    >
                      Xóa bình luận
                    </button>
                  </div>
                )}
                {authenticated && (
                  <button
                    className="text-button"
                    onClick={() => {
                      setReplyTo(c);
                      document.getElementById("comment-text")?.focus();
                      document
                        .getElementById("comment-text")
                        ?.scrollIntoView({ block: "center" });
                    }}
                  >
                    Trả lời
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {hasMore && (
        <button
          className="secondary-btn comments-more"
          disabled={loading || sending}
          onClick={() => void load(next)}
        >
          {loading
            ? "Đang tải..."
            : `Xem bình luận cũ hơn (${Math.max(total - comments.length, 0)})`}
        </button>
      )}
    </section>
  );
}
