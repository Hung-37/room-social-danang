"use client";
import { useFavorites } from "./FavoritesProvider";
import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import type { RoomPost } from "@/lib/data";
import Icon from "./Icons";
import RoomPhoto from "./RoomPhoto";
import { roomPhotos } from "@/lib/policies/room-photos.js";

function PostCard({
  post,
  authenticated = false,
}: {
  post: RoomPost;
  authenticated?: boolean;
}) {
  const room = Boolean(post.price);
  const favorites = useFavorites();
  const saved = favorites.ids.has(post.id);
  const [saving, setSaving] = useState(false);
  const [liked, setLiked] = useState(
    Boolean(post.interactionSummary?.viewerReaction),
  );
  const [votes, setVotes] = useState(post.interactionSummary?.total ?? 0);
  const [busy, setBusy] = useState(false);
  const [interactionLoading, setInteractionLoading] = useState(
    !room && post.interactionSummary === undefined,
  );
  const [interactionError, setInteractionError] = useState(
    post.interactionSummary === null,
  );
  const [retryInteraction, setRetryInteraction] = useState(0);
  const mutation = useRef(0);
  const [notice, setNotice] = useState("");
  const href = `/bai/${encodeURIComponent(post.id)}`;
  const login = `/dang-nhap?next=${encodeURIComponent(href)}`;
  useEffect(() => {
    if (room) return;
    if (post.interactionSummary !== undefined && retryInteraction === 0) {
      if (mutation.current === 0) {
        setLiked(Boolean(post.interactionSummary?.viewerReaction));
        setVotes(post.interactionSummary?.total ?? 0);
        setInteractionError(post.interactionSummary === null);
      }
      setInteractionLoading(false);
      return;
    }
    const controller = new AbortController(),
      version = mutation.current;
    setInteractionLoading(true);
    fetch(`/api/community/posts/${encodeURIComponent(post.id)}/interactions`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const p = await r.json();
        if (!r.ok) throw new Error();
        if (!controller.signal.aborted && version === mutation.current) {
          setLiked(Boolean(p.data.viewerReaction));
          setVotes(Number(p.data.total) || 0);
          setInteractionError(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted && version === mutation.current)
          setInteractionError(true);
      })
      .finally(() => {
        if (!controller.signal.aborted && version === mutation.current)
          setInteractionLoading(false);
      });
    return () => controller.abort();
  }, [post.id, room, post.interactionSummary, retryInteraction]);
  async function save() {
    setSaving(true);
    try {
      await favorites.toggle(post.id, !saved);
      setNotice(saved ? "Đã bỏ lưu." : "Đã lưu vào tài khoản.");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Chưa thể lưu.");
    } finally {
      setSaving(false);
    }
  }
  async function like() {
    if (busy || interactionLoading || interactionError) return;
    mutation.current++;
    setBusy(true);
    try {
      const r = await fetch(
        `/api/community/posts/${encodeURIComponent(post.id)}/interactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reaction: liked ? null : "like" }),
        },
      );
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setLiked(Boolean(p.data.viewerReaction));
      setVotes(p.data.total);
    } catch (e) {
      setInteractionError(true);
      setNotice(
        e instanceof Error && e.name === "Error"
          ? e.message
          : "Không thể gửi tương tác.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: post.title,
          url: location.origin + href,
        });
      else {
        await navigator.clipboard.writeText(location.origin + href);
        setNotice("Đã sao chép liên kết.");
      }
    } catch {
      setNotice("Bạn có thể sao chép địa chỉ từ trang chi tiết.");
    }
  }
  return (
    <article className={room ? "room-card" : "conversation-card"}>
      {room && (
        <Link href={href} className="room-cover">
          <span className="sr-only">Xem phòng: {post.title}</span>
          <RoomPhoto src={roomPhotos(post.imageUrl, post.imageUrls)[0]} />
          <span className="cover-badge">
            <Icon name="check" /> Tin đã duyệt
          </span>
        </Link>
      )}
      <div className="card-content">
        <div className="card-context">
          {room ? (
            <span className="category-pill">Phòng cho thuê</span>
          ) : (
            <>
              <span className="person-avatar" aria-hidden="true">
                {(post.authorName ?? "C").slice(0, 1)}
              </span>
              <span className="card-author">
                {post.authorName || "Thành viên cộng đồng"}
              </span>
              <span
                className={`category-pill ${post.postKind === "warning" ? "is-warning" : ""}`}
              >
                {post.postKind === "experience"
                  ? "Trải nghiệm"
                  : post.postKind === "warning"
                    ? "Cảnh báo"
                    : "Hỏi đáp"}
              </span>
            </>
          )}
          <span className="card-time">{post.updated}</span>
        </div>
        <h3>
          <Link href={href}>{post.title}</Link>
        </h3>
        <p className="card-description">{post.summary}</p>
        {room ? (
          <>
            <p className="room-location">
              <Icon name="pin" />
              {post.address || post.clusterName}
            </p>
            <div className="room-facts">
              <strong>{post.price}</strong>
              {post.area && <span>{post.area}</span>}
            </div>
          </>
        ) : (
          <p className="discussion-location">
            <Icon name="pin" />
            {post.clusterName}
          </p>
        )}
        <div className="card-toolbar">
          <Link href={href} className="card-read">
            {room ? "Xem chi tiết" : "Đọc thảo luận"}
            <Icon name="arrow" />
          </Link>
          <Link
            className="comment-count"
            href={`${href}#binh-luan`}
            aria-label={`${post.comments} bình luận về ${post.title}`}
          >
            <Icon name="message" />
            {post.comments}
          </Link>
          {authenticated ? (
            <button
              className={`quiet-icon ${saved ? "is-selected" : ""}`}
              disabled={saving || favorites.loading}
              aria-pressed={saved}
              aria-label={`${saved ? "Bỏ lưu" : "Lưu"}: ${post.title}`}
              onClick={save}
            >
              <Icon name="bookmark" />
            </button>
          ) : (
            <Link
              className="quiet-icon"
              href={login}
              aria-label={`Đăng nhập để lưu: ${post.title}`}
            >
              <Icon name="bookmark" />
            </Link>
          )}
          {!room &&
            (authenticated ? (
              <button
                className={`quiet-icon ${liked ? "is-selected" : ""}`}
                disabled={busy || interactionLoading || interactionError}
                aria-pressed={liked}
                aria-label={`Thích: ${post.title}${votes > 0 ? `, ${votes} lượt tương tác` : ""}`}
                onClick={like}
              >
                <Icon name="heart" />
                {votes > 0 && votes}
              </button>
            ) : (
              <Link
                className="quiet-icon"
                href={login}
                aria-label={`Đăng nhập để thích: ${post.title}`}
              >
                <Icon name="heart" />
              </Link>
            ))}
          <button
            className="quiet-icon"
            aria-label={`Chia sẻ: ${post.title}`}
            onClick={share}
          >
            <Icon name="share" />
          </button>
        </div>
        {!room && interactionError && authenticated && (
          <p className="card-notice" role="status">
            Chưa tải được tương tác.{" "}
            <button
              className="text-button"
              onClick={() => setRetryInteraction((v) => v + 1)}
              disabled={interactionLoading}
            >
              Thử lại tương tác
            </button>
          </p>
        )}
        {notice && (
          <p className="card-notice" role="status">
            {notice}
          </p>
        )}
      </div>
    </article>
  );
}
export default memo(PostCard);
