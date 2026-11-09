'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { comments, posts, clusters, normalizeToRoomPost } from '@/lib/data';
import { isLoggedIn, getCurrentUser, logout } from '@/lib/auth';
import { addCommunityComment, getCommunityComments, getCommunityPosts } from '@/lib/community-storage';
import type { RoomPost } from '@/lib/data';

type DisplayComment = { id: string | number; user: string; text: string; time: string };

export default function PostDetailClient({ id }: { id: string }) {
  const [post, setPost] = useState<RoomPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [localComments, setLocalComments] = useState<DisplayComment[]>(comments);
  const [reports, setReports] = useState(0);
  const [message, setMessage] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ name: string } | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const [usefulCount, setUsefulCount] = useState(0);
  const [showSimilar, setShowSimilar] = useState(false);

  useEffect(() => {
    const loadPost = async () => {
      setLoading(true);
      setAuthenticated(isLoggedIn());
      setCurrentUser(getCurrentUser());
      setLocalComments(getCommunityComments(id).map((comment) => ({
        id: comment.id,
        user: comment.authorName,
        text: comment.text,
        time: new Date(comment.createdAt).toLocaleString('vi-VN')
      })));
      fetch(`/api/community/posts/${encodeURIComponent(id)}/comments`)
        .then(async (response) => response.ok ? response.json() as Promise<{ data?: Array<{ id: string; authorName: string; text: string; createdAt: string }>; storage?: 'database' | 'file_cache' }> : null)
        .then((payload) => {
          if (!payload?.data) return;
          if (payload.storage === 'database') {
            setLocalComments(payload.data.map((comment) => ({ id: comment.id, user: comment.authorName, text: comment.text, time: new Date(comment.createdAt).toLocaleString('vi-VN') })));
            return;
          }
          const local = getCommunityComments(id);
          const seenIds = new Set(payload.data.map((comment) => comment.id));
          const merged = [...payload.data, ...local.filter((comment) => !seenIds.has(comment.id))];
          setLocalComments(merged.map((comment) => ({
            id: comment.id,
            user: comment.authorName,
            text: comment.text,
            time: new Date(comment.createdAt).toLocaleString('vi-VN')
          })));
        })
        .catch(() => undefined);

      const communityResponse = await fetch('/api/community/posts?limit=50');
      if (communityResponse.ok) {
        const communityPayload = await communityResponse.json() as { data?: RoomPost[]; storage?: 'database' | 'file_cache' };
        const communityPost = communityPayload.data?.find((item) => item.id === id);
        if (communityPost) {
          setPost(communityPost);
          setLoading(false);
          return;
        }
      }

      const localCommunityPost = getCommunityPosts().find((item) => item.id === id);
      if (localCommunityPost) {
        setPost(localCommunityPost);
        setLoading(false);
        return;
      }
      
      // Try to load from database first
      try {
        const response = await fetch(`/api/listings/${id}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            setPost(normalizeToRoomPost(data.data));
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log('Database fetch failed, trying mock data');
      }
      
      // Fallback to mock data
      const mockPost = posts.find((item) => item.id === id);
      setPost(mockPost || null);
      setLoading(false);
    };
    
    loadPost();
    
  }, [id]);

  async function addComment() {
    const value = text.trim();
    if (!value) return;
    
    if (!authenticated) {
      setMessage('Bạn cần đăng nhập để bình luận.');
      return;
    }
    
    let comment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorName: currentUser?.name || 'Bạn',
      text: value,
      createdAt: new Date().toISOString()
    };
    let sharedWithServer = false;
    try {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(id)}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(comment)
      });
      if (response.ok) {
        const payload = await response.json() as { data?: typeof comment };
        if (payload.data) comment = payload.data;
        sharedWithServer = true;
      }
    } catch {
      sharedWithServer = false;
    }
    if (!sharedWithServer && !addCommunityComment(id, comment)) {
      setMessage('Không lưu được bình luận trên trình duyệt này.');
      return;
    }
    setLocalComments((items) => [...items, { ...comment, user: comment.authorName, time: 'vừa xong' }]);
    setText('');
    setMessage(sharedWithServer
      ? 'Bình luận đã được chia sẻ với cộng đồng.'
      : 'Đang ngoại tuyến: bình luận chỉ được lưu trên thiết bị này.');
  }

  function reportPost(reason: string) {
    if (!authenticated) {
      setMessage('Bạn cần đăng nhập để báo cáo bài viết.');
      return;
    }
    
    setReports((value) => value + 1);
    setMessage(`Đã ghi nhận báo cáo: ${reason}. Đây là bản mô phỏng quy tắc cộng đồng.`);
  }

  function handleRate(type: 'useful' | 'inaccurate') {
    if (!authenticated) {
      setMessage('Bạn cần đăng nhập để đánh giá bài viết.');
      return;
    }
    
    if (type === 'useful') {
      setUsefulCount(prev => prev + 1);
      setMessage('Đã đánh dấu bài hữu ích.');
    } else {
      setMessage('Đã ghi nhận thông tin cần kiểm chứng.');
    }
  }

  // Get similar posts from same cluster
  const similarPosts = post ? posts.filter(p => p.clusterId === post.clusterId && p.id !== post.id).slice(0, 3) : [];
  const cluster = post ? clusters.find(c => c.id === post.clusterId) : null;

  if (loading) {
    return <section className="detail-hero"><div className="container"><div className="empty-feed"><strong>Đang tải...</strong><span>Vui lòng chờ trong giây lát.</span></div></div></section>;
  }

  if (!post) {
    return <section className="detail-hero"><div className="container"><div className="empty-feed"><strong>Không tìm thấy bài đăng</strong><span>Bài này có thể đã bị xóa hoặc không tồn tại. <Link href="/admin" className="primary-btn">Mở quản trị</Link> để nhập dữ liệu mới.</span></div></div></section>;
  }

  return (
    <section className="detail-hero">
      <div className="container">
        <div className="breadcrumb"><Link href="/">Trang chủ</Link> / <Link href={`/cum/${post.clusterId}`}>{post.clusterName}</Link> / Chi tiết</div>
        <div className="detail-grid">
          <div className="detail-card">
            <div className="detail-media-column">
              <div className="detail-visual">
                {post.imageUrl ? <img src={post.imageUrl} alt={`Ảnh ${post.title}`} loading="eager" /> : <div className="detail-image-placeholder"><span>{post.price ? '🏠' : post.image}</span><small>Ảnh đang cập nhật</small></div>}
                <span className="detail-status">{post.status}</span>
              </div>
              <div className="detail-stats">
                <span>👁 {viewCount} lượt xem</span>
                <span>👍 {usefulCount} hữu ích</span>
                <span>💬 {localComments.length} bình luận</span>
              </div>
            </div>
            <div className="detail-info-column">
            <span className="eyebrow">{post.price ? 'THÔNG TIN PHÒNG CHO THUÊ' : 'BÀI ĐĂNG CỘNG ĐỒNG'}</span>
            <h1>{post.title}</h1>
            <p className="detail-lead">{post.summary}</p>
            {post.address && <p className="detail-address">📍 {post.address}</p>}
            <div className="fact-grid">
              <div className="fact"><span>Giá</span><b>{post.price}</b></div>
              <div className="fact"><span>Diện tích</span><b>{post.area}</b></div>
              <div className="fact"><span>Cách trường</span><b>{post.distance}</b></div>
            </div>
            
            {cluster && (
              <div className="cluster-info">
                <h3>📍 Vị trí</h3>
                <p>{cluster.name} - {cluster.description || 'Khu vực phòng trọ sinh viên'}</p>
                <div className="cluster-tags">
                  {cluster.tags && cluster.tags.length > 0 ? (
                    cluster.tags.map((tag, idx) => (
                      <span key={idx} className="cluster-tag">{tag}</span>
                    ))
                  ) : (
                    <span className="cluster-tag">Phòng trọ</span>
                  )}
                </div>
              </div>
            )}
            
            <div className="source-box">
              <b>Nguồn tổng hợp:</b> {post.source} · cập nhật {post.updated}.<br />
              <b>Điểm tin cậy:</b> {post.trust}/100 · <b>Trạng thái:</b> {post.status}
            </div>
            
            <div className="detail-actions">
              <button className="secondary-btn" onClick={() => handleRate('useful')}>👍 Hữu ích ({usefulCount})</button>
              <button className="secondary-btn" onClick={() => handleRate('inaccurate')}>⚠ Không chính xác</button>
              <button className="danger-btn" onClick={() => reportPost('Spam / nghi ngờ')}>🚨 Báo cáo ({reports})</button>
            </div>
            {message && <p className="source-box message-box">{message}</p>}
            </div>
          </div>

          <div className="comments-card">
            <h2 className="comments-title">💬 Thảo luận cộng đồng</h2>
            <p className="comments-intro">Người dùng có thể hỏi, chia sẻ trải nghiệm hoặc đánh dấu thông tin chưa chính xác.</p>
            <div className="comment-list">
              {localComments.map((comment) => (
                <div className="comment" key={comment.id}>
                  <div className="comment-head"><b>{comment.user}</b><span>{comment.time}</span></div>
                  <p>{comment.text}</p>
                </div>
              ))}
            </div>
            <div className="comment-input">
              {authenticated ? (
                <>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Viết bình luận..." onKeyDown={(e) => e.key === 'Enter' && addComment()} />
                  <button onClick={addComment}>Gửi</button>
                </>
              ) : (
                <div className="auth-notice">
                  <p>Bạn cần <Link href="/dang-nhap">đăng nhập</Link> để bình luận.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {similarPosts.length > 0 && (
          <div className="similar-posts">
            <div className="similar-header">
              <h3>🏠 Phòng tương tự trong {post.clusterName}</h3>
              <button onClick={() => setShowSimilar(!showSimilar)}>
                {showSimilar ? 'Ẩn' : 'Hiện'} ({similarPosts.length})
              </button>
            </div>
            {showSimilar && (
              <div className="similar-grid">
                {similarPosts.map(similarPost => (
                  <Link key={similarPost.id} href={`/bai/${similarPost.id}`} className="similar-card">
                    <div className="similar-visual">{similarPost.image}</div>
                    <div className="similar-info">
                      <h4>{similarPost.title}</h4>
                      <p>{similarPost.price} · {similarPost.area}</p>
                      <span className="similar-status">{similarPost.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
        
        {similarPosts.length === 0 && post.clusterId && (
          <div className="similar-posts">
            <div className="similar-header">
              <h3>🏠 Khám phá thêm trong {post.clusterName}</h3>
            </div>
            <p className="empty-state">Chưa có bài tương tự trong khu vực này.</p>
          </div>
        )}
      </div>
    </section>
  );
}
