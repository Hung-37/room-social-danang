'use client';

import Link from 'next/link';
import { useState, memo, useCallback, useEffect } from 'react';
import type { RoomPost } from '@/lib/data';

const reactionIcons: Record<string, string> = { like: '👍', love: '❤️', funny: '😂', wow: '😮', sad: '😢', fire: '🔥' };

function PostCard({ post, authenticated = false }: { post: RoomPost; authenticated?: boolean }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [reactionTotal, setReactionTotal] = useState(0);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [reportMessage, setReportMessage] = useState('');

  const reactions = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  useEffect(() => {
    const savedPosts = JSON.parse(localStorage.getItem('room-danang-saved') || '[]') as unknown;
    setSaved(Array.isArray(savedPosts) && savedPosts.includes(post.id));
    fetch(`/api/community/posts/${encodeURIComponent(post.id)}/interactions`)
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        const data = payload?.data;
        if (!data) return;
        setReactionTotal(Number(data.total ?? 0));
        setSelectedReaction(typeof data.viewerReaction === 'string' ? data.viewerReaction : null);
        setLiked(Boolean(data.viewerReaction));
      })
      .catch(() => undefined);
  }, [post.id]);

  const handleLike = useCallback(() => {
    setLiked(!liked);
    if (!liked) setSelectedReaction('👍');
    else setSelectedReaction(null);
  }, [liked]);

  const handleSave = useCallback(() => {
    const newSavedState = !saved;
    setSaved(newSavedState);

    // Save to localStorage
    const savedPosts = JSON.parse(localStorage.getItem('room-danang-saved') || '[]');
    if (newSavedState) {
      if (!savedPosts.includes(post.id)) {
        savedPosts.push(post.id);
      }
    } else {
      const index = savedPosts.indexOf(post.id);
      if (index > -1) {
        savedPosts.splice(index, 1);
      }
    }
    localStorage.setItem('room-danang-saved', JSON.stringify(savedPosts));

    // Dispatch custom event to notify parent component
    window.dispatchEvent(new CustomEvent('post-saved', { detail: { postId: post.id, saved: newSavedState } }));
  }, [saved, post.id]);

  const handleReaction = useCallback((reaction: string) => {
    const reactionKey = Object.entries(reactionIcons).find(([, icon]) => icon === reaction)?.[0] ?? 'like';
    const nextReaction = selectedReaction === reactionKey ? null : reactionKey;
    const previousReaction = selectedReaction;
    setSelectedReaction(nextReaction);
    setLiked(Boolean(nextReaction));
    setShowReactions(false);
    setReactionTotal((value) => Math.max(0, value + (nextReaction ? (previousReaction ? 0 : 1) : -1)));
    fetch(`/api/community/posts/${encodeURIComponent(post.id)}/interactions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction: nextReaction })
    }).then(async (response) => {
      if (!response.ok) throw new Error('Reaction failed');
      const payload = await response.json();
      setReactionTotal(Number(payload.data?.total ?? 0));
    }).catch(() => {
      setSelectedReaction(previousReaction);
      setLiked(Boolean(previousReaction));
      setReactionTotal((value) => Math.max(0, value + (nextReaction ? (previousReaction ? 0 : -1) : 1)));
    });
  }, [post.id, selectedReaction]);

  const handleShare = useCallback(() => {
    if (navigator.share) {
      navigator.share({
        title: post.title,
        text: post.summary,
        url: window.location.origin + `/bai/${post.id}`
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.origin + `/bai/${post.id}`);
      alert('Đã sao chép link!');
    }
  }, [post.title, post.summary, post.id]);

  async function submitReport() {
    const response = await fetch(`/api/community/posts/${encodeURIComponent(post.id)}/report`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reportReason })
    });
    const payload = await response.json();
    setReportMessage(response.ok ? 'Đã gửi báo cáo.' : (payload.error || 'Không thể gửi báo cáo.'));
    if (response.ok) setShowReport(false);
  }

  return (
    <article className={`post-card ${post.price ? 'listing-card' : 'community-card'}`}>
      <div className="post-visual">
        {post.imageUrl ? (
          <img
            src={post.imageUrl}
            alt="Ảnh phòng trọ"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="image-placeholder">
            <span>{post.price ? '🏠' : post.image}</span>
            {post.price && <small>Ảnh đang cập nhật</small>}
          </div>
        )}
        {post.price && <span className={`listing-status ${post.status === 'Còn phòng' ? 'is-available' : 'is-review'}`}>{post.status}</span>}
      </div>
      <div className="post-body">
        <div className="post-meta">
          {post.authorName && (
            <div className="post-author-info">
              <span className="author-avatar">{post.authorName.charAt(0).toUpperCase()}</span>
              <span className="post-author">{post.authorName}</span>
            </div>
          )}
          {post.price ? <span className="listing-label">Phòng trọ</span> : post.postKind && <span className="post-kind">{post.postKind === 'question' ? 'Hỏi đáp' : post.postKind === 'experience' ? 'Trải nghiệm' : 'Cảnh báo'}</span>}
          <span>·</span>
          <span>{post.clusterName}</span>
          <span>·</span>
          <span>{post.updated}</span>
        </div>
        <Link href={`/bai/${post.id}`} className="post-title">{post.title}</Link>
        <p className="post-summary">{post.summary}</p>
        {post.price && <div className="listing-details">
          {post.address && <span className="listing-address">📍 {post.address}</span>}
          <span>{post.clusterName}</span>
          <span>✓ {post.status}</span>
        </div>}
        <div className="tag-row">
          {post.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
        </div>
        <div className="post-bottom">
          {post.price
            ? <div className="post-price">{post.price}<span>{post.area ? ` · ${post.area}` : ''}</span></div>
            : <div className="discussion-label">💬 Bài thảo luận cộng đồng</div>}
          <div className={`trust trust-${post.trust >= 85 ? 'good' : post.trust >= 70 ? 'mid' : 'low'}`}>★ {post.trust}/100</div>
        </div>
        <div className="post-footer">
          <span>💬 {post.comments} bình luận</span>
          <span>Nguồn: {post.source}</span>
          {post.sourceUrl && (authenticated
            ? <a href={post.sourceUrl} target="_blank" rel="noreferrer">Xem tin gốc ↗</a>
            : <Link href="/dang-nhap" className="source-login-link">🔒 Đăng nhập để xem tin gốc</Link>)}
          <span className={post.status === 'Đã có báo cáo' ? 'report-status' : ''}>{post.status}</span>
        </div>
      </div>

      <div className="post-social-actions">
        {authenticated ? (
          <>
            <div className="reaction-wrapper">
              <button
                className={`social-action-btn ${liked ? 'liked' : ''}`}
                onClick={() => setShowReactions(!showReactions)}
                onMouseEnter={() => setShowReactions(true)}
              >
                {selectedReaction ? reactionIcons[selectedReaction] : '👍'} Thích{reactionTotal > 0 ? ` · ${reactionTotal}` : ''}
              </button>
              {showReactions && (
                <div className="reactions-popup">
                  {reactions.map((reaction) => (
                    <button
                      key={reaction}
                      className="reaction-btn"
                      onClick={() => handleReaction(reaction)}
                    >
                      {reaction}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link href={`/bai/${post.id}`} className="social-action-btn">
              💬 Bình luận
            </Link>
            <button className={`social-action-btn ${saved ? 'saved' : ''}`} onClick={handleSave}>
              {saved ? '🔖 Đã lưu' : '🔖 Lưu'}
            </button>
            <button className="social-action-btn" onClick={handleShare}>
              ↗ Chia sẻ
            </button>
            <button className="social-action-btn" onClick={() => setShowReport((value) => !value)}>
              ⚑ Báo cáo
            </button>
            {showReport && <div className="report-popover">
              <strong>Báo cáo bài viết</strong>
              <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} aria-label="Lý do báo cáo">
                <option value="spam">Spam/quảng cáo</option>
                <option value="scam">Nghi ngờ lừa đảo</option>
                <option value="harassment">Quấy rối/xúc phạm</option>
                <option value="wrong_information">Thông tin sai</option>
                <option value="other">Lý do khác</option>
              </select>
              <button className="primary-btn" onClick={submitReport}>Gửi báo cáo</button>
              {reportMessage && <small>{reportMessage}</small>}
            </div>}
          </>
        ) : (
          <>
            <Link href="/dang-nhap" className="social-action-btn">
              👍 Thích{reactionTotal > 0 ? ` · ${reactionTotal}` : ''}
            </Link>
            <Link href={`/bai/${post.id}`} className="social-action-btn">
              💬 Xem bình luận ({post.comments})
            </Link>
            <Link href="/dang-nhap" className="social-action-btn">
              🔖 Lưu
            </Link>
            <button className="social-action-btn" onClick={handleShare}>
              ↗ Chia sẻ
            </button>
          </>
        )}
      </div>
    </article>
  );
}

export default memo(PostCard);
