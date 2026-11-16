"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { notifySessionChanged } from "@/lib/client/client-session";
import { useToast } from "./Toast";

type AuthMode = "login" | "register";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: AuthMode;
  returnPath?: string;
}

export default function LoginModal({
  isOpen,
  onClose,
  defaultMode = "login",
  returnPath = "/",
}: LoginModalProps) {
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [accountCreated, setAccountCreated] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

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
    if (passwordStrength === 0) return "";
    if (passwordStrength <= 2) return "Yếu";
    if (passwordStrength <= 3) return "Trung bình";
    if (passwordStrength <= 4) return "Mạnh";
    return "Rất mạnh";
  }

  function getPasswordStrengthColor() {
    if (passwordStrength <= 2) return "#ef4444";
    if (passwordStrength <= 3) return "#f59e0b";
    if (passwordStrength <= 4) return "#10b981";
    return "#059669";
  }

  function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setRequestId("");
    setCanRetry(false);
    setAccountCreated(false);

    if (!validateEmail(email)) {
      setError("Vui lòng nhập email hợp lệ (ví dụ: user@email.com).");
      return;
    }
    if (password.length < 6) {
      setError("Mật khẩu cần có ít nhất 6 ký tự.");
      return;
    }
    if (mode === "register" && (name.trim().length < 2 || name.trim().length > 80)) {
      setError("Vui lòng nhập họ tên của bạn (2–80 ký tự).");
      return;
    }
    if (mode === "register" && passwordStrength < 2) {
      setError("Mật khẩu quá yếu. Vui lòng dùng mật khẩu mạnh hơn.");
      return;
    }

    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (mode === "login") {
        const adminResponse = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (adminResponse.ok) {
          setSubmitted(true);
          setLoading(false);
          showToast("Đăng nhập thành công!", "success");
          setTimeout(() => {
            onClose();
            router.push("/admin");
          }, 800);
          return;
        }

        const userResponse = await fetch("/api/auth/user-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (userResponse.ok) {
          notifySessionChanged();
        } else if (userResponse.status !== 503) {
          const payload = await userResponse.json().catch(() => ({}));
          setLoading(false);
          setError(payload.error || "Email hoặc mật khẩu không đúng.");
          return;
        } else {
          setLoading(false);
          setError("Chưa kết nối cơ sở dữ liệu. Vui lòng thử lại sau.");
          return;
        }
      } else {
        const registerResponse = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), email, password, role }),
        });
        const payload = (await registerResponse.json().catch(() => ({}))) as { error?: string; code?: string; requestId?: string };
        if (payload.code === "ACCOUNT_CREATED_LOGIN_REQUIRED") {
          setLoading(false);
          setPassword("");
          setError("Tài khoản đã được tạo. Đăng nhập bằng email này để tiếp tục.");
          setRequestId(payload.requestId ?? registerResponse.headers.get("X-Request-Id") ?? "");
          setAccountCreated(true);
          setMode("login");
          return;
        }
        if (registerResponse.ok) {
          notifySessionChanged();
        } else {
          setLoading(false);
          setPassword("");
          const messages: Record<string, string> = {
            EMAIL_TAKEN: "Email này đã được đăng ký.",
            DATABASE_UNAVAILABLE: "Hệ thống đang bận. Vui lòng thử lại sau ít phút.",
            SERVER_MISCONFIGURED: "Hệ thống chưa sẵn sàng. Vui lòng báo bộ phận hỗ trợ.",
            REGISTER_SCHEMA_ERROR: "Hệ thống đang được cập nhật. Vui lòng thử lại sau.",
            REGISTER_WRITE_FORBIDDEN: "Hệ thống tạm thời không thể tạo tài khoản.",
            REGISTER_FAILED: "Không thể tạo tài khoản lúc này.",
            ACCOUNT_CREATED_LOGIN_REQUIRED: "Tài khoản đã được tạo. Hãy đăng nhập để tiếp tục.",
          };
          setError(messages[payload.code ?? ""] ?? payload.error ?? "Không thể tạo tài khoản.");
          setRequestId(payload.requestId ?? registerResponse.headers.get("X-Request-Id") ?? "");
          setCanRetry(payload.code === "DATABASE_UNAVAILABLE");
          return;
        }
      }
      setLoading(false);
      setSubmitted(true);
      showToast(mode === "login" ? "Đăng nhập thành công!" : "Tài khoản đã được tạo!", "success");
      setTimeout(() => {
        onClose();
        router.push(returnPath);
      }, 500);
    } catch {
      setLoading(false);
      setError("Đã có lỗi xảy ra. Vui lòng thử lại.");
      if (mode === "register") {
        setPassword("");
        setCanRetry(true);
      }
    }
  }

  function handleClose() {
    if (!loading) {
      onClose();
      // Reset form
      setName("");
      setEmail("");
      setPassword("");
      setError("");
      setRequestId("");
      setCanRetry(false);
      setAccountCreated(false);
      setSubmitted(false);
    }
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError("");
    setName("");
    setEmail("");
    setPassword("");
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={handleClose} aria-label="Đóng">
          ✕
        </button>

        {submitted ? (
          <div className="modal-success">
            <span className="success-icon">✓</span>
            <h3>
              {mode === "login" ? "Đăng nhập thành công!" : "Tài khoản đã được tạo!"}
            </h3>
            <p>Đang chuyển bạn đến trang tiếp theo...</p>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <h2>{mode === "login" ? "Đăng nhập" : "Đăng ký"}</h2>
              <p>
                {mode === "login"
                  ? "Tiếp tục hành trình tìm nơi ở phù hợp."
                  : "Mất khoảng một phút để bắt đầu."}
              </p>
            </div>

            <div className="modal-tabs">
              <button
                className={`modal-tab ${mode === "login" ? "active" : ""}`}
                onClick={() => switchMode("login")}
              >
                Đăng nhập
              </button>
              <button
                className={`modal-tab ${mode === "register" ? "active" : ""}`}
                onClick={() => switchMode("register")}
              >
                Đăng ký
              </button>
            </div>

            <form className="modal-form" onSubmit={handleSubmit}>
              {mode === "register" && (
                <label>
                  Họ và tên
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                    autoComplete="name"
                    disabled={loading}
                  />
                </label>
              )}
              <label>
                Email
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ban@email.com"
                  type="email"
                  autoComplete="email"
                  disabled={loading}
                />
              </label>
              <label className="password-label">
                Mật khẩu
                <div className="password-input-wrapper">
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder={mode === "login" ? "Nhập mật khẩu" : "Ít nhất 6 ký tự"}
                    type={showPassword ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
                {mode === "register" && password && (
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div
                        className="strength-fill"
                        style={{
                          width: `${(passwordStrength / 5) * 100}%`,
                          backgroundColor: getPasswordStrengthColor(),
                        }}
                      />
                    </div>
                    <span className="strength-text">
                      {getPasswordStrengthLabel()}
                    </span>
                  </div>
                )}
              </label>
              {mode === "register" && (
                <fieldset>
                  <legend>Bạn tham gia với vai trò</legend>
                  <div className="role-options">
                    <label
                      className={role === "student" ? "role-option is-selected" : "role-option"}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="student"
                        checked={role === "student"}
                        onChange={(event) => setRole(event.target.value)}
                        disabled={loading}
                      />{" "}
                      <span>
                        🎓<strong>Sinh viên</strong>
                        <small>Tìm phòng và tham gia cộng đồng</small>
                      </span>
                    </label>
                    <label
                      className={role === "landlord" ? "role-option is-selected" : "role-option"}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="landlord"
                        checked={role === "landlord"}
                        onChange={(event) => setRole(event.target.value)}
                        disabled={loading}
                      />{" "}
                      <span>
                        🏠<strong>Chủ trọ</strong>
                        <small>Đăng và quản lý phòng</small>
                      </span>
                    </label>
                  </div>
                </fieldset>
              )}
              {error && (
                <p className="modal-error" role="alert">
                  {error}
                  {requestId && <small> Mã hỗ trợ: {requestId}</small>}
                </p>
              )}
              {accountCreated && <p role="status">Mật khẩu đã được xóa. Hãy nhập lại mật khẩu để đăng nhập.</p>}
              {canRetry && <button type="submit" className="secondary-btn" disabled={loading}>Thử lại</button>}
              <button
                className="btn btn-primary btn-full"
                type="submit"
                disabled={loading}
              >
                {loading
                  ? "Đang xử lý..."
                  : mode === "login"
                    ? "Đăng nhập"
                    : "Tạo tài khoản"}
              </button>
              <p className="modal-legal">
                Bằng việc tiếp tục, bạn đồng ý với quy định cộng đồng của RoomĐàNẵng.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
