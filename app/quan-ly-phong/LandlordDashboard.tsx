"use client";
import { useEffect, useRef, useState } from "react";
import { usePagedResource } from "@/components/usePagedResource";
import ManagementPager from "@/components/ManagementPager";
import Link from "next/link";
type Listing = {
  externalId: string;
  title: string;
  price: number;
  area: number;
  address: string;
  verificationStatus: string;
  imageUrl: string | null;
};
const labels: Record<string, string> = {
  pending: "Chờ xác minh",
  needs_review: "Chờ duyệt",
  verified: "Đang công khai",
  rejected: "Đã từ chối",
  hidden: "Đã ẩn",
  rented: "Đã hết phòng",
};
export default function LandlordDashboard() {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [offset, setOffset] = useState(0),
    [actionError, setActionError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(""),
    [confirm, setConfirm] = useState<{
      id: string;
      action: string;
      title: string;
    } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const confirmation = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (confirm) {
      confirmation.current?.focus({ preventScroll: true });
      confirmation.current?.scrollIntoView({ block: "center" });
    }
  }, [confirm]);
  function askConfirm(target: { id: string; action: string; title: string }) {
    trigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setConfirm(target);
  }
  function closeConfirm() {
    setConfirm(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  const params = new URLSearchParams({
    limit: "10",
    offset: String(offset),
    q: query,
    status,
  });
  const {
    data,
    meta,
    loading,
    error: loadError,
    statusCode,
    reload,
  } = usePagedResource<{ status: string; listings: Listing[] }>(
    "/api/landlord?" + params,
  );
  const error = actionError || loadError;
  useEffect(() => {
    if (new URLSearchParams(location.search).has("da-gui"))
      setNotice(
        "Đã lưu tin. Tin đang chờ Admin kiểm duyệt trước khi công khai.",
      );
  }, []);
  useEffect(() => {
    if (meta && offset > 0 && offset >= meta.total)
      setOffset(Math.max(0, Math.floor((meta.total - 1) / 10) * 10));
  }, [meta, offset]);
  function page(next: number) {
    setOffset(next);
    setConfirm(null);
    heading.current?.focus();
    heading.current?.scrollIntoView({ block: "start" });
  }
  async function action() {
    if (!confirm || busy || loading) return;
    const target = confirm;
    setBusy(target.id);
    setActionError("");
    setNotice("");
    try {
      const url = "/api/landlord/listings/" + encodeURIComponent(target.id);
      const get = await fetch(url, { cache: "no-store" });
      const item = await get.json();
      if (!get.ok) throw new Error(item.error);
      const r = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: target.action,
          revision: item.data.revision,
        }),
      });
      const p = await r.json();
      if (!r.ok) throw new Error(p.error);
      setConfirm(null);
      reload();
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "center" });
      setNotice(
        target.action === "hide"
          ? "Đã ẩn tin khỏi danh sách công khai."
          : target.action === "rented"
            ? "Đã đánh dấu hết phòng. Người thuê sẽ không còn thấy tin công khai."
            : "Đã gửi tin chờ Admin duyệt lại.",
      );
    } catch (e) {
      setActionError(
        e instanceof Error ? e.message : "Chưa cập nhật được trạng thái.",
      );
    } finally {
      setBusy("");
    }
  }
  return (
    <div className="management-v8">
      <span className="section-eyebrow">Dành cho chủ trọ</span>
      <div className="section-heading">
        <h1>Quản lý phòng của tôi</h1>
        {data?.status === "verified" && (
          <Link className="primary-btn" href="/dang-phong">
            + Đăng phòng mới
          </Link>
        )}
      </div>
      <p>
        Chủ trọ được xác minh → Gửi tin → Admin duyệt → Phòng xuất hiện công
        khai.
      </p>
      {error && (
        <p className="feedback feedback-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="feedback" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <div className="route-feedback">
          {statusCode === 401 || statusCode === 403 ? (
            <Link href="/dang-nhap?next=%2Fquan-ly-phong">
              Đăng nhập chủ trọ
            </Link>
          ) : error ? (
            <button
              className="secondary-btn"
              disabled={loading}
              onClick={reload}
            >
              Thử tải lại phòng
            </button>
          ) : (
            <p role="status">Đang tải...</p>
          )}
        </div>
      ) : (
        <>
          <div className="verification-banner">
            <h2>
              Xác minh chủ trọ:{" "}
              {data.status === "verified"
                ? "Đã xác minh"
                : data.status === "rejected"
                  ? "Chưa được chấp thuận"
                  : "Đang chờ xác minh"}
            </h2>
            <p>
              {data.status === "verified"
                ? "Bạn có thể đăng và chỉnh sửa tin. Mỗi lần sửa nội dung, tin cần được duyệt lại."
                : "Bạn cần được Admin xác minh để đăng hoặc gửi duyệt tin. Bạn vẫn có thể ẩn hoặc đánh dấu hết phòng."}
            </p>
          </div>
          {confirm && (
            <div
              className="management-confirm"
              ref={confirmation}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === "Escape" && !busy) {
                  e.preventDefault();
                  closeConfirm();
                }
              }}
              role="region"
              aria-label="Xác nhận đổi trạng thái"
            >
              <h2>
                {confirm.action === "hide"
                  ? "Ẩn tin này?"
                  : confirm.action === "rented"
                    ? "Phòng đã được thuê?"
                    : "Gửi tin để duyệt lại?"}
              </h2>
              <p>{confirm.title}</p>
              <p>
                {confirm.action === "resubmit"
                  ? "Tin sẽ chỉ công khai sau khi Admin chấp thuận."
                  : "Tin sẽ ngừng công khai. Nội dung và lịch sử nhắn tin vẫn được giữ."}
              </p>
              <div className="inline-actions">
                <button
                  className="secondary-btn"
                  disabled={!!busy || loading}
                  onClick={closeConfirm}
                >
                  Hủy
                </button>
                <button
                  className="primary-btn"
                  disabled={!!busy || loading}
                  onClick={action}
                >
                  {busy ? "Đang cập nhật..." : "Xác nhận"}
                </button>
              </div>
            </div>
          )}
          <div className="management-filters">
            <label>
              Tìm phòng của tôi
              <input
                type="search"
                maxLength={100}
                value={query}
                disabled={!!busy}
                placeholder="Tiêu đề hoặc địa chỉ phòng..."
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOffset(0);
                  setConfirm(null);
                }}
              />
            </label>
            <label>
              Trạng thái phòng
              <select
                aria-label="Trạng thái phòng"
                value={status}
                disabled={!!busy}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setOffset(0);
                  setConfirm(null);
                }}
              >
                <option value="">Tất cả trạng thái</option>
                {[
                  "needs_review",
                  "verified",
                  "rejected",
                  "hidden",
                  "rented",
                ].map((value) => (
                  <option key={value} value={value}>
                    {labels[value]}
                  </option>
                ))}
              </select>
            </label>
            {(query || status) && (
              <button
                className="secondary-btn"
                disabled={!!busy}
                onClick={() => {
                  setQuery("");
                  setStatus("");
                  setOffset(0);
                  setConfirm(null);
                }}
              >
                Bỏ bộ lọc
              </button>
            )}
          </div>
          <h2 ref={heading} tabIndex={-1}>
            {query || status ? "Kết quả lọc" : "Tin đã đăng"}
            {!loading && meta ? ` (${meta.total})` : ""}
          </h2>
          {loading && <p role="status">Đang tải phòng…</p>}
          {loadError && (
            <button
              className="secondary-btn"
              disabled={loading}
              onClick={reload}
            >
              Thử tải lại phòng
            </button>
          )}
          {!loading && !loadError && (
            <ManagementPager
              meta={meta}
              disabled={!!busy || loading}
              label="phòng của tôi"
              position="đầu"
              onPage={page}
            />
          )}
          {!loading &&
            !loadError &&
            (!data.listings.length ? (
              <div className="route-feedback">
                <h3>
                  {query || status
                    ? "Không có phòng phù hợp"
                    : "Bắt đầu với phòng đầu tiên"}
                </h3>
                <p>
                  {query || status
                    ? "Thử từ khóa khác hoặc bỏ bộ lọc để xem các phòng còn lại."
                    : "Chuẩn bị mô tả, giá thuê và vài ảnh thực tế để người thuê dễ lựa chọn."}
                </p>
              </div>
            ) : (
              <div className="management-grid">
                {data.listings.map((l) => (
                  <article className="management-room" key={l.externalId}>
                    {l.imageUrl && (
                      <img src={l.imageUrl} alt="" loading="lazy" />
                    )}
                    <div className="management-room-body">
                      <span
                        className={
                          "listing-status status-" + l.verificationStatus
                        }
                      >
                        {labels[l.verificationStatus] || l.verificationStatus}
                      </span>
                      <h3>{l.title}</h3>
                      <p>{l.address}</p>
                      <p className="management-price">
                        {Number(l.price).toLocaleString("vi-VN")} đ/tháng{" "}
                        <span>· {l.area} m²</span>
                      </p>
                      <div className="management-actions">
                        {data.status === "verified" && (
                          <Link
                            className="secondary-btn"
                            href={
                              "/quan-ly-phong/" +
                              encodeURIComponent(l.externalId)
                            }
                          >
                            Chỉnh sửa
                          </Link>
                        )}
                        {l.verificationStatus === "verified" && (
                          <Link
                            className="text-link"
                            href={"/bai/" + encodeURIComponent(l.externalId)}
                          >
                            Xem công khai →
                          </Link>
                        )}
                        {l.verificationStatus !== "hidden" && (
                          <button
                            className="text-button"
                            disabled={!!busy || loading}
                            onClick={() =>
                              askConfirm({
                                id: l.externalId,
                                action: "hide",
                                title: l.title,
                              })
                            }
                          >
                            Ẩn tin
                          </button>
                        )}
                        {l.verificationStatus !== "rented" && (
                          <button
                            className="text-button"
                            disabled={!!busy || loading}
                            onClick={() =>
                              askConfirm({
                                id: l.externalId,
                                action: "rented",
                                title: l.title,
                              })
                            }
                          >
                            Đã hết phòng
                          </button>
                        )}
                        {["hidden", "rented", "rejected"].includes(
                          l.verificationStatus,
                        ) &&
                          data.status === "verified" && (
                            <button
                              className="primary-btn"
                              disabled={!!busy || loading}
                              onClick={() =>
                                askConfirm({
                                  id: l.externalId,
                                  action: "resubmit",
                                  title: l.title,
                                })
                              }
                            >
                              Gửi duyệt lại
                            </button>
                          )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ))}
          {!loading && !loadError && data.listings.length > 0 && (
            <ManagementPager
              meta={meta}
              disabled={!!busy}
              label="phòng của tôi"
              position="cuối"
              onPage={page}
            />
          )}
        </>
      )}
    </div>
  );
}
