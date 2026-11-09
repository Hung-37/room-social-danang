'use client';

import Link from 'next/link';
import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, type User } from '@/lib/auth';

type AuthMode = 'login' | 'register';

export default function AuthForm({ mode }: { mode: AuthMode }) {
  const isLogin = mode === 'login';
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Password strength calculation
  useEffect(() => {
    if (!password) {
      setPasswordStrength(0);
      return;
    }
    let strength = 0;
    if (password.length >= 8) strength += 1;
    if (password.length >= 12) strength += 1;
    if (/[A-Z]/.test(password)) strength += 1;
    if (/[0-9]/.test(password)) strength += 1;
    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    setPasswordStrength(strength);
  }, [password]);

  function getPasswordStrengthLabel() {
    if (passwordStrength === 0) return '';
    if (passwordStrength <= 2) return 'Yếu';
    if (passwordStrength <= 3) return 'Trung bình';
    if (passwordStrength <= 4) return 'Mạnh';
    return 'Rất mạnh';
  }

  function getPasswordStrengthColor() {
    if (passwordStrength <= 2) return '#ef4444';
    if (passwordStrength <= 3) return '#f59e0b';
    if (passwordStrength <= 4) return '#10b981';
    return '#059669';
  }

  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Vui lòng nhập email hợp lệ (ví dụ: user@email.com).');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }
    if (!isLogin && name.trim().length < 2) {
      setError('Vui lòng nhập họ tên của bạn (tối thiểu 2 ký tự).');
      return;
    }
    if (!isLogin && passwordStrength < 2) {
      setError('Mật khẩu quá yếu. Vui lòng dùng mật khẩu mạnh hơn.');
      return;
    }

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (isLogin) {
        const adminResponse = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (adminResponse.ok) {
          setSubmitted(true);
          setLoading(false);
          setTimeout(() => router.push('/admin'), 800);
          return;
        }

        const userResponse = await fetch('/api/auth/user-login', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
        });
        if (userResponse.ok) {
          const payload = await userResponse.json() as { data: User };
          login(payload.data);
        } else if (userResponse.status !== 503) {
          setLoading(false);
          setError('Email hoặc mật khẩu không đúng.');
          return;
        } else {
          login({ id: `user-${Date.now()}`, name: name || email.split('@')[0], email, role: role as 'student' | 'landlord' });
        }
      } else {
        const registerResponse = await fetch('/api/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email, password, role })
        });
        if (registerResponse.ok) {
          const payload = await registerResponse.json() as { data: User };
          login(payload.data);
        } else if (registerResponse.status === 503) {
          register({ name: name.trim(), email, role: role as 'student' | 'landlord' });
        } else {
          const payload = await registerResponse.json() as { error?: string };
          setLoading(false);
          setError(payload.error || 'Không thể tạo tài khoản.');
          return;
        }
      }
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => router.push('/'), 800);
    } catch {
      setLoading(false);
      setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-intro">
          <Link href="/" className="brand auth-brand">
            <span className="brand-mark">R</span>
            <span>Room<span>ĐàNẵng</span></span>
          </Link>
          <div className="auth-intro-copy">
            <span className="eyebrow">Cộng đồng phòng trọ Đà Nẵng</span>
            <h1>{isLogin ? 'Chào mừng bạn trở lại.' : 'Tìm phòng cùng cộng đồng.'}</h1>
            <p>{isLogin ? 'Đăng nhập để lưu phòng, tham gia thảo luận và kiểm chứng thông tin cùng sinh viên Đà Nẵng.' : 'Tạo tài khoản để lưu phòng yêu thích, hỏi người thật và chia sẻ trải nghiệm của bạn.'}</p>
          </div>
          <div className="auth-proof"><span>✓</span><p><strong>Thông tin có nguồn</strong><br />Mỗi bài đăng đều có lịch sử và mức độ tin cậy.</p></div>
          <div className="auth-proof"><span>◎</span><p><strong>Cộng đồng theo cụm</strong><br />Kết nối đúng khu vực trường bạn đang học.</p></div>
        </section>

        <section className="auth-panel">
          <div className="auth-tabs">
            <Link className={isLogin ? 'auth-tab is-active' : 'auth-tab'} href="/dang-nhap">Đăng nhập</Link>
            <Link className={!isLogin ? 'auth-tab is-active' : 'auth-tab'} href="/dang-ky">Đăng ký</Link>
          </div>
          <div className="auth-panel-heading">
            <h2>{isLogin ? 'Đăng nhập tài khoản' : 'Tạo tài khoản mới'}</h2>
            <p>{isLogin ? 'Tiếp tục hành trình tìm nơi ở phù hợp.' : 'Mất khoảng một phút để bắt đầu.'}</p>
          </div>

          {submitted ? (
            <div className="auth-success"><span>✓</span><h3>{isLogin ? 'Đăng nhập thành công!' : 'Tài khoản đã được tạo!'}</h3><p>Đang chuyển hướng đến trang chủ...</p><Link className="primary-btn auth-home-btn" href="/">Về trang chủ</Link></div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {!isLogin && <label>Họ và tên<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ví dụ: Nguyễn Minh Anh" autoComplete="name" disabled={loading} /></label>}
              <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="ban@email.com" type="email" autoComplete="email" disabled={loading} /></label>
              <label className="password-label">
                Mật khẩu
                <div className="password-input-wrapper">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={isLogin ? 'Nhập mật khẩu' : 'Ít nhất 6 ký tự'}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isLogin ? 'current-password' : 'new-password'}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? '🙈' : '👁'}
                  </button>
                </div>
                {!isLogin && password && (
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div
                        className="strength-fill"
                        style={{
                          width: `${(passwordStrength / 5) * 100}%`,
                          backgroundColor: getPasswordStrengthColor()
                        }}
                      />
                    </div>
                    <span className="strength-text">{getPasswordStrengthLabel()}</span>
                  </div>
                )}
              </label>
              {!isLogin && <fieldset><legend>Bạn tham gia với vai trò</legend><div className="role-options"><label className={role === 'student' ? 'role-option is-selected' : 'role-option'}><input type="radio" name="role" value="student" checked={role === 'student'} onChange={(event) => setRole(event.target.value)} disabled={loading} /> <span>🎓<strong>Sinh viên</strong><small>Tìm phòng và tham gia cộng đồng</small></span></label><label className={role === 'landlord' ? 'role-option is-selected' : 'role-option'}><input type="radio" name="role" value="landlord" checked={role === 'landlord'} onChange={(event) => setRole(event.target.value)} disabled={loading} /> <span>🏠<strong>Chủ trọ</strong><small>Đăng và quản lý phòng</small></span></label></div></fieldset>}
              {isLogin && <div className="auth-options"><label><input type="checkbox" disabled={loading} /> Ghi nhớ đăng nhập</label><a href="#quen-mat-khau">Quên mật khẩu?</a></div>}
              {isLogin && process.env.NODE_ENV !== 'production' && <div className="admin-hint"><small>Admin demo chỉ có trong môi trường phát triển.</small></div>}
              {error && <p className="auth-error" role="alert">{error}</p>}
              <button className="primary-btn auth-submit" type="submit" disabled={loading}>
                {loading ? 'Đang xử lý...' : (isLogin ? 'Đăng nhập' : 'Tạo tài khoản')} <span>→</span>
              </button>
              <p className="auth-legal">Bằng việc tiếp tục, bạn đồng ý với quy định cộng đồng của RoomĐàNẵng.</p>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
