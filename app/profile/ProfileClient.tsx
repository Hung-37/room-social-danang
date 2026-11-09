'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isLoggedIn, getCurrentUser, logout, type User } from '@/lib/auth';
import { useRouter } from 'next/navigation';

type ProfileTab = 'overview' | 'activity' | 'settings';

export default function ProfileClient() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [savedPosts, setSavedPosts] = useState<string[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [joinDate, setJoinDate] = useState<string>('');

  useEffect(() => {
    setAuthenticated(isLoggedIn());
    const user = getCurrentUser();
    setCurrentUser(user);
    if (user) {
      setEditName(user.name);
      // Simulate join date (in real app, this would come from user data)
      const storedJoinDate = localStorage.getItem('room-danang-join-date');
      if (storedJoinDate) {
        setJoinDate(storedJoinDate);
      } else {
        const now = new Date().toISOString();
        localStorage.setItem('room-danang-join-date', now);
        setJoinDate(now);
      }
    }

    // Load saved and liked posts from localStorage
    const saved = localStorage.getItem('room-danang-saved');
    const liked = localStorage.getItem('room-danang-liked');
    if (saved) setSavedPosts(JSON.parse(saved));
    if (liked) setLikedPosts(JSON.parse(liked));
  }, []);

  function handleLogout() {
    logout();
    router.push('/');
  }

  function handleSaveProfile() {
    if (!currentUser) return;

    if (editName.trim().length < 2) {
      alert('Tên phải có ít nhất 2 ký tự');
      return;
    }

    const updatedUser: User = {
      ...currentUser,
      name: editName.trim()
    };

    localStorage.setItem('room-danang-user', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    setIsEditing(false);
    alert('Đã cập nhật hồ sơ!');
  }

  function handleCancelEdit() {
    setEditName(currentUser?.name || '');
    setIsEditing(false);
  }

  if (!authenticated) {
    return (
      <section className="auth-page">
        <div className="container">
          <div className="empty-feed">
            <strong>Bạn chưa đăng nhập</strong>
            <span>Vui lòng <Link href="/dang-nhap" className="primary-btn">đăng nhập</Link> để xem hồ sơ của bạn.</span>
          </div>
        </div>
      </section>
    );
  }

  const formattedJoinDate = joinDate ? new Date(joinDate).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : 'Gần đây';

  return (
    <section className="profile-page">
      <div className="container">
        <div className="profile-header">
          <div className="profile-avatar">
            <span>{currentUser?.name?.charAt(0).toUpperCase() || 'U'}</span>
          </div>
          <div className="profile-info">
            {isEditing ? (
              <div className="profile-edit-form">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Tên hiển thị"
                  className="profile-name-input"
                />
                <div className="profile-edit-actions">
                  <button className="secondary-btn" onClick={handleCancelEdit}>Hủy</button>
                  <button className="primary-btn" onClick={handleSaveProfile}>Lưu</button>
                </div>
              </div>
            ) : (
              <>
                <h1>{currentUser?.name || 'Người dùng'}</h1>
                <p>{currentUser?.email || ''}</p>
                <span className="profile-role">
                  {currentUser?.role === 'landlord' ? '🏠 Chủ trọ' : '🎓 Sinh viên'}
                </span>
                {currentUser?.role === 'landlord' && (
                  <Link href="/dang-phong" className="primary-btn">Đăng tin phòng →</Link>
                )}
                <span className="profile-join-date">Tham gia: {formattedJoinDate}</span>
              </>
            )}
          </div>
          <div className="profile-actions">
            {!isEditing && (
              <button className="secondary-btn" onClick={() => setIsEditing(true)}>
                ✏️ Chỉnh sửa
              </button>
            )}
            <button className="secondary-btn" onClick={handleLogout}>
              Đăng xuất
            </button>
          </div>
        </div>

        <div className="profile-tabs">
          <button
            className={`profile-tab ${activeTab === 'overview' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Tổng quan
          </button>
          <button
            className={`profile-tab ${activeTab === 'activity' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Hoạt động
          </button>
          <button
            className={`profile-tab ${activeTab === 'settings' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Cài đặt
          </button>
        </div>

        <div className="profile-content">
          {activeTab === 'overview' && (
            <>
              <div className="profile-stats">
                <div className="stat-card">
                  <b>{savedPosts.length}</b>
                  <span>Bài đã lưu</span>
                </div>
                <div className="stat-card">
                  <b>{likedPosts.length}</b>
                  <span>Bài đã thích</span>
                </div>
                <div className="stat-card">
                  <b>0</b>
                  <span>Bình luận</span>
                </div>
              </div>

              <div className="profile-sections">
                <div className="profile-section">
                  <h2>Bài đã lưu</h2>
                  {savedPosts.length === 0 ? (
                    <p className="empty-state">Chưa có bài nào được lưu.</p>
                  ) : (
                    <div className="saved-posts-list">
                      {savedPosts.map((postId) => (
                        <Link key={postId} href={`/bai/${postId}`} className="saved-post-item">
                          <span>Bài #{postId}</span>
                          <span>→</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {currentUser?.role === 'landlord' && (
                  <div className="profile-section">
                    <h2>Khu vực chủ trọ</h2>
                    <p>Đăng phòng, chờ kiểm duyệt và theo dõi trạng thái tin đăng.</p>
                    <Link href="/dang-phong" className="primary-btn">Đăng tin phòng mới</Link>
                  </div>
                )}

                <div className="profile-section">
                  <h2>Bài đã thích</h2>
                  {likedPosts.length === 0 ? (
                    <p className="empty-state">Chưa có bài nào được thích.</p>
                  ) : (
                    <div className="liked-posts-list">
                      {likedPosts.map((postId) => (
                        <Link key={postId} href={`/bai/${postId}`} className="liked-post-item">
                          <span>Bài #{postId}</span>
                          <span>→</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'activity' && (
            <div className="profile-section">
              <h2>Lịch sử hoạt động</h2>
              <div className="activity-list">
                <div className="activity-item">
                  <span className="activity-icon">💬</span>
                  <div className="activity-content">
                    <strong>Đã đăng bài thảo luận</strong>
                    <span className="activity-time">Hôm nay</span>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">🔖</span>
                  <div className="activity-content">
                    <strong>Đã lưu bài đăng</strong>
                    <span className="activity-time">Hôm qua</span>
                  </div>
                </div>
                <div className="activity-item">
                  <span className="activity-icon">👍</span>
                  <div className="activity-content">
                    <strong>Đã thích bài đăng</strong>
                    <span className="activity-time">2 ngày trước</span>
                  </div>
                </div>
                {savedPosts.length === 0 && likedPosts.length === 0 && (
                  <p className="empty-state">Chưa có hoạt động nào được ghi nhận.</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="profile-section">
              <h2>Cài đặt tài khoản</h2>
              <div className="settings-list">
                <div className="setting-item">
                  <span>📧 Email</span>
                  <span className="setting-value">{currentUser?.email}</span>
                </div>
                <div className="setting-item">
                  <span>👤 Vai trò</span>
                  <span className="setting-value">
                    {currentUser?.role === 'landlord' ? 'Chủ trọ' : 'Sinh viên'}
                  </span>
                </div>
                <div className="setting-item">
                  <span>📅 Ngày tham gia</span>
                  <span className="setting-value">{formattedJoinDate}</span>
                </div>
                {currentUser?.role === 'admin' && (
                  <Link href="/admin" className="setting-item">
                    <span>⚙️ Quản trị hệ thống</span>
                    <span>→</span>
                  </Link>
                )}
                <button className="setting-item danger" onClick={handleLogout}>
                  <span>🚪 Đăng xuất</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
