'use client';

import { useEffect, useMemo, useState, useCallback, memo, type FormEvent } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import ClusterCard from '@/components/ClusterCard';
import PostCard from '@/components/PostCard';
import { clusters, type RoomPost, UNASSIGNED_CLUSTER_ID, normalizeToRoomPost } from '@/lib/data';
import { isLoggedIn, getCurrentUser, updateUserStats, type User } from '@/lib/auth';
import { getCommunityPosts, saveCommunityPost, saveCommunityPosts } from '@/lib/community-storage';

// Custom hook for debounced value
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

type FeedTab = 'all' | 'rooms' | 'discussion' | 'saved';
type PostKind = NonNullable<RoomPost['postKind']>;

const CommunitySidebar = memo(function CommunitySidebar({ posts: feedPosts }: { posts: RoomPost[] }) {
  const recentDiscussions = useMemo(() => feedPosts.filter((post) => !post.price).slice(0, 3), [feedPosts]);

  return (
    <aside className="social-sidebar">
      <div className="side-card community-widget">
        <h3>📍 Cộng đồng của bạn</h3>
        <p>Tham gia một cụm để thấy bài viết gần trường hơn.</p>
        {clusters.slice(0, 3).map((cluster) => (
          <Link key={cluster.id} href={`/cum/${cluster.id}`} className="mini-community">
            <span className={`mini-dot ${cluster.accent}`}>⌾</span>
            <span><strong>{cluster.name}</strong><small>Thành viên: chưa có dữ liệu</small></span>
            <b>→</b>
          </Link>
        ))}
      </div>
      <div className="side-card">
        <h3>Thảo luận mới</h3>
        {recentDiscussions.length > 0 ? recentDiscussions.map((post) => (
          <Link key={post.id} href={`/bai/${post.id}`} className="discussion-item">
            <strong>{post.title}</strong>
            <span>{post.clusterName} · {post.comments} bình luận</span>
          </Link>
        )) : <p>Chưa có thảo luận mới. Hãy mở một câu hỏi cho cộng đồng.</p>}
      </div>
    </aside>
  );
});

function SocialHome() {
  const [tab, setTab] = useState<FeedTab>('all');
  const [text, setText] = useState('');
  const [postTitle, setPostTitle] = useState('');
  const [postKind, setPostKind] = useState<PostKind>('question');
  const [postClusterId, setPostClusterId] = useState(UNASSIGNED_CLUSTER_ID);
  const [composerMessage, setComposerMessage] = useState('');
  const [postsFromUser, setPostsFromUser] = useState<RoomPost[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minArea, setMinArea] = useState('');
  const [maxArea, setMaxArea] = useState('');
  const [sort, setSort] = useState('newest');
  const deferredQuery = useDebounce(query, 300);
  const [clusterFilter, setClusterFilter] = useState('all');
  const [remotePosts, setRemotePosts] = useState<RoomPost[]>([]);
  const [sourceOffset, setSourceOffset] = useState(0);
  const [hasMoreSourcePosts, setHasMoreSourcePosts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pendingReviewCount, setPendingReviewCount] = useState(0);
  const [syncMessage, setSyncMessage] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userStats, setUserStats] = useState({ postsCreated: 0, commentsMade: 0, helpfulVotes: 0, reportsSubmitted: 0 });

  useEffect(() => {
    const localLoggedIn = isLoggedIn();
    const localUser = getCurrentUser();
    setAuthenticated(localLoggedIn);
    setCurrentUser(localUser);
    setPostsFromUser(getCommunityPosts());

    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => response.ok ? response.json() as Promise<{ data?: User }> : null)
      .then((payload) => {
        if (payload?.data) {
          setAuthenticated(true);
          setCurrentUser(payload.data);
        }
      })
      .catch(() => undefined);

    // Load saved posts from localStorage
    const saved = localStorage.getItem('room-danang-saved');
    if (saved) setSaved(JSON.parse(saved));

    // Listen for save events from PostCard
    const handlePostSaved = (event: Event) => {
      const customEvent = event as CustomEvent<{ postId: string; saved: boolean }>;
      const { postId, saved: isSaved } = customEvent.detail;
      setSaved(prev => {
        if (isSaved) {
          return prev.includes(postId) ? prev : [...prev, postId];
        } else {
          return prev.filter(id => id !== postId);
        }
      });
    };

    window.addEventListener('post-saved', handlePostSaved);
    return () => {
      window.removeEventListener('post-saved', handlePostSaved);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/community/posts?limit=50')
      .then(async (response) => {
        if (!response.ok) throw new Error('Không tải được thảo luận cộng đồng.');
        return response.json() as Promise<{ data?: RoomPost[]; storage?: 'database' | 'file_cache' }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const serverPosts = payload.data ?? [];
        if (payload.storage === 'database') {
          setPostsFromUser(serverPosts);
          return;
        }
        const localPosts = getCommunityPosts();
        const serverIds = new Set(serverPosts.map((post) => post.id));
        const merged = [...localPosts.filter((post) => !serverIds.has(post.id)), ...serverPosts];
        saveCommunityPosts(merged);
        setPostsFromUser(merged);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
        setSyncMessage('Khoảng giá không hợp lệ: giá từ phải nhỏ hơn giá đến.');
        return;
      }
      if (minArea && maxArea && Number(minArea) > Number(maxArea)) {
        setSyncMessage('Diện tích không hợp lệ: diện tích từ phải nhỏ hơn diện tích đến.');
        return;
      }
      try {
        setSyncMessage('Đang tải bảng tin...');
        const params = new URLSearchParams({ limit: '20', offset: '0' });
        if (deferredQuery.trim()) params.set('q', deferredQuery.trim());
        if (clusterFilter !== 'all') params.set('cluster', clusterFilter);
        if (minPrice) params.set('minPrice', String(Number(minPrice) * 1000000));
        if (maxPrice) params.set('maxPrice', String(Number(maxPrice) * 1000000));
        if (minArea) params.set('minArea', minArea);
        if (maxArea) params.set('maxArea', maxArea);
        if (sort !== 'newest') params.set('sort', sort);
        const response = await fetch(`/api/listings?${params.toString()}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Không thể tải bảng tin.');
        const payload = await response.json() as {
          data?: Array<Record<string, unknown>>;
          meta?: { pendingCount?: number; nextOffset?: number; hasMore?: boolean };
        };
        if (cancelled) return;
        const pendingCount = Number(payload.meta?.pendingCount ?? 0);
        setPendingReviewCount(pendingCount);
        const mapped = (payload.data ?? []).map(mapListing);
        setRemotePosts(mapped);
        setSourceOffset(Number(payload.meta?.nextOffset ?? mapped.length));
        setHasMoreSourcePosts(Boolean(payload.meta?.hasMore));
        if (mapped.length > 0) {
          setSyncMessage(`Đang xem ${mapped.length} tin${payload.meta?.hasMore ? ' đầu tiên' : ''}.`);
        } else if (pendingCount > 0) {
          setSyncMessage(`${pendingCount} tin đang chờ quản trị viên duyệt.`);
        } else {
          setSyncMessage('Chưa có tin đã duyệt. Quản trị viên có thể kiểm tra nguồn dữ liệu.');
        }
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to load listings:', error);
        setSyncMessage('Không thể tải bảng tin. Vui lòng thử lại sau.');
      }
    }, 180);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [deferredQuery, clusterFilter, minPrice, maxPrice, minArea, maxArea, sort]);

  const loadMoreListings = useCallback(async () => {
    if (loadingMore || !hasMoreSourcePosts) return;
    setLoadingMore(true);
    setSyncMessage('Đang tải thêm tin...');
    try {
      const params = new URLSearchParams({ limit: '20', offset: String(sourceOffset) });
      if (deferredQuery.trim()) params.set('q', deferredQuery.trim());
      if (clusterFilter !== 'all') params.set('cluster', clusterFilter);
      if (minPrice) params.set('minPrice', String(Number(minPrice) * 1000000));
      if (maxPrice) params.set('maxPrice', String(Number(maxPrice) * 1000000));
      if (minArea) params.set('minArea', minArea);
      if (maxArea) params.set('maxArea', maxArea);
      if (sort !== 'newest') params.set('sort', sort);
      const response = await fetch(`/api/listings?${params.toString()}`);
      if (!response.ok) throw new Error('Không thể tải thêm tin.');
      const payload = await response.json() as {
        data?: Array<Record<string, unknown>>;
        meta?: { nextOffset?: number; hasMore?: boolean };
      };
      const mapped = (payload.data ?? []).map(mapListing);
      setRemotePosts((current) => {
        const existingIds = new Set(current.map((post) => post.id));
        return [...current, ...mapped.filter((post) => !existingIds.has(post.id))];
      });
      setSourceOffset(Number(payload.meta?.nextOffset ?? sourceOffset + mapped.length));
      setHasMoreSourcePosts(Boolean(payload.meta?.hasMore));
      setSyncMessage(`Đã tải thêm ${mapped.length} tin.`);
    } catch {
      setSyncMessage('Không thể tải thêm tin. Vui lòng thử lại sau.');
    } finally {
      setLoadingMore(false);
    }
  }, [sourceOffset, deferredQuery, clusterFilter, minPrice, maxPrice, minArea, maxArea, sort, loadingMore, hasMoreSourcePosts]);

  const feed = useMemo(() => {
    // Only use database posts, no fallback to sample data
    const allPosts = [...postsFromUser, ...remotePosts];
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return allPosts.filter((post) => {
      // Early return for tab filters
      if (tab === 'rooms' && !post.price) return false;
      if (tab === 'discussion' && post.price) return false;
      if (tab === 'saved' && !saved.includes(post.id)) return false;
      if (clusterFilter !== 'all' && post.clusterId !== clusterFilter) return false;

      // Search filter
      if (!normalizedQuery) return true;
      const searchable = [post.title, post.summary, post.clusterName, ...post.tags].join(' ').toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [postsFromUser, remotePosts, deferredQuery, tab, clusterFilter, saved]);

  const featuredPosts = useMemo(() => {
    const listings = feed.filter((post) => Boolean(post.price));
    return (listings.length ? listings : feed).slice(0, 3);
  }, [feed]);

  const featuredIds = useMemo(() => new Set(featuredPosts.map((post) => post.id)), [featuredPosts]);
  const recentPosts = useMemo(() => feed.filter((post) => !featuredIds.has(post.id)), [feed, featuredIds]);

  const publish = useCallback(async (event: FormEvent) => {
    event.preventDefault();
    if (!postTitle.trim() || !text.trim()) {
      setComposerMessage('Hãy nhập tiêu đề và nội dung trước khi đăng.');
      return;
    }

    if (!authenticated) {
      alert('Bạn cần đăng nhập để đăng bài.');
      return;
    }

    const cluster = clusters.find((item) => item.id === postClusterId) ?? clusters[0];
    const post: RoomPost = {
      id: `community-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: postTitle.trim(),
      price: '',
      area: '',
      distance: '',
      clusterId: cluster.id,
      clusterName: cluster.name,
      source: 'Website',
      trust: 20,
      comments: 0,
      updated: 'vừa xong',
      status: 'Cần kiểm chứng',
      tags: [postKind === 'question' ? 'Hỏi đáp' : postKind === 'experience' ? 'Trải nghiệm' : 'Cảnh báo'],
      image: '💬',
      summary: text.trim(),
      authorName: currentUser?.name || 'Thành viên',
      postKind
    };
    let sharedWithServer = false;
    try {
      const response = await fetch('/api/community/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post)
      });
      if (response.ok) {
        const payload = await response.json() as { data?: RoomPost; storage?: 'database' | 'file_cache' };
        if (payload.data) Object.assign(post, payload.data);
        sharedWithServer = true;
        if (payload.storage === 'database') {
          setPostsFromUser((items) => items.filter((item) => item.id !== post.id));
        }
      }
    } catch {
      sharedWithServer = false;
    }

    if (!sharedWithServer && !saveCommunityPost(post)) {
      setComposerMessage('Không lưu được bài viết trên trình duyệt này.');
      return;
    }
    setPostsFromUser((items) => [post, ...items]);
    setPostTitle('');
    setText('');

    // Update user stats
    if (currentUser) {
      updateUserStats(currentUser.id, { postsCreated: userStats.postsCreated + 1 });
      setUserStats(prev => ({ ...prev, postsCreated: prev.postsCreated + 1 }));
    }

    setComposerMessage(sharedWithServer
      ? 'Bài viết đã được chia sẻ với cộng đồng.'
      : 'Đang ngoại tuyến: bài viết chỉ được lưu trên thiết bị này.');
  }, [postTitle, text, authenticated, currentUser, postClusterId, postKind, userStats.postsCreated]);

  function toggle(id: string, setter: (update: (items: string[]) => string[]) => void, storageKey: string) {
    setter((items) => {
      const newItems = items.includes(id) ? items.filter((item) => item !== id) : [...items, id];
      // Save to localStorage
      localStorage.setItem(storageKey, JSON.stringify(newItems));
      return newItems;
    });
  }

  return <>
    <Header />
    <main className="page-main">
      <div className="page-layout">
        <div className="page-feed">
          <div className="page-header">
            <h1>🏠 RoomĐàNẵng</h1>
            <p>Cộng đồng phòng trọ Đà Nẵng - Tìm phòng dễ hơn, sống gần nhau hơn</p>
          </div>

          {authenticated ? (
            <form className="home-composer" onSubmit={publish}>
              <div className="avatar">{currentUser?.name?.slice(0, 2).toUpperCase() || 'DN'}</div>
              <div className="composer-content">
                <textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={3000}
                  placeholder="Bạn đang nghĩ gì? Đăng bài tìm phòng hoặc chia sẻ kinh nghiệm..."
                  rows={3}
                  aria-label="Nội dung bài viết"
                />
                <div className="composer-footer">
                  <span>{composerMessage || `${text.length}/3000`}</span>
                  <button className="primary-btn" type="submit">Đăng</button>
                </div>
              </div>
            </form>
          ) : (
            <div className="home-composer composer-locked">
              <div className="avatar">?</div>
              <div className="composer-content">
                <p>Đăng nhập để đăng bài</p>
                <Link href="/dang-nhap" className="primary-btn">Đăng nhập</Link>
              </div>
            </div>
          )}

          <div className="feed-tabs">
            <button className={tab === 'all' ? 'active' : ''} onClick={() => setTab('all')}>Tất cả</button>
            <button className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>Phòng trọ</button>
            <button className={tab === 'discussion' ? 'active' : ''} onClick={() => setTab('discussion')}>Thảo luận</button>
            {authenticated && (
              <button className={tab === 'saved' ? 'active' : ''} onClick={() => setTab('saved')}>Đã lưu</button>
            )}
          </div>

          <div className="feed-list">
            {recentPosts.length ? (
              recentPosts.map((post) => (
                <PostCard key={post.id} post={post} authenticated={authenticated} />
              ))
            ) : (
              <div className="empty-state">
                <p>
                  {tab === 'rooms' ? 'Chưa có phòng trọ nào' :
                   tab === 'discussion' ? 'Chưa có thảo luận nào' :
                   tab === 'saved' ? 'Bạn chưa lưu bài nào' :
                   'Chưa có bài nào'}
                </p>
              </div>
            )}
          </div>

          {hasMoreSourcePosts && tab !== 'discussion' && (
            <button className="load-more" onClick={loadMoreListings} disabled={loadingMore}>
              {loadingMore ? 'Đang tải…' : 'Tải thêm'}
            </button>
          )}
        </div>

        <aside className="page-sidebar">
          <div className="sidebar-card">
            <h3>🔗 Nhanh truy cập</h3>
            <div className="topic-list">
              <Link href="/bang-tin" className="topic-item">🏠 Bản tin phòng trọ</Link>
              <Link href="/thao-luan" className="topic-item">💬 Thảo luận cộng đồng</Link>
              <Link href="/cum" className="topic-item">📍 Khám phá khu vực</Link>
            </div>
          </div>

          <div className="sidebar-card">
            <h3>Khu vực</h3>
            <div className="cluster-list">
              {clusters.slice(0, 5).map((cluster) => (
                <Link key={cluster.id} href={`/cum/${cluster.id}`} className="cluster-item">
                  {cluster.name}
                </Link>
              ))}
            </div>
          </div>

          <div className="sidebar-card">
            <h3>Tìm kiếm</h3>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm phòng..."
              className="search-input"
            />
            <div className="filter-row">
              <input
                type="number"
                value={minPrice}
                onChange={(event) => setMinPrice(event.target.value)}
                placeholder="Giá từ"
                className="filter-input"
              />
              <input
                type="number"
                value={maxPrice}
                onChange={(event) => setMaxPrice(event.target.value)}
                placeholder="Giá đến"
                className="filter-input"
              />
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
  </>;
}

function mapListing(item: Record<string, unknown>): RoomPost {
  return normalizeToRoomPost({
    externalId: item.externalId,
    id: item.id,
    title: item.title,
    price: item.price,
    area: item.area,
    clusterId: item.clusterId,
    trustScore: item.trustScore,
    verificationStatus: item.verificationStatus,
    imageUrl: item.imageUrl,
    address: item.address,
    sourceUrl: item.sourceUrl,
    summary: item.summary,
    phone: item.phone,
    commentCount: item.commentCount
  });
}

export default memo(SocialHome);
