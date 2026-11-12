"use client";
import { useState, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSubmissionKey } from "@/components/useSubmissionKey";
import { clusters } from "@/lib/data";
export type ListingDraft = {
  externalId: string;
  title: string;
  summary: string;
  address: string;
  price: number;
  area: number;
  phone: string;
  clusterId: string;
  imageUrl: string | null;
  imageIds: string[];
  revision: string;
  verificationStatus: string;
};
export default function LandlordListingForm({
  initial,
}: {
  initial?: ListingDraft;
}) {
  const router = useRouter();
  const attempt = useSubmissionKey();
  const [images, setImages] = useState(
      (initial?.imageIds || []).map((id) => ({ id, url: "/api/images/" + id })),
    ),
    [uploading, setUploading] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [removeRemote, setRemoveRemote] = useState(false);
  const busy = uploading || loading;
  async function upload(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    setError("");
    if (images.length + files.length > 4) {
      setError("Mỗi phòng tối đa 4 ảnh. Hãy bỏ bớt ảnh trước khi thêm.");
      input.value = "";
      return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024)
          throw new Error("Ảnh cần nhỏ hơn 5 MB.");
        const form = new FormData();
        form.append("file", file);
        const r = await fetch("/api/images", { method: "POST", body: form });
        const p = await r.json();
        if (!r.ok) throw new Error(p.error);
        setImages((current) => [...current, p.data]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa tải được ảnh.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  }
  async function remove(id: string) {
    setImages((current) => current.filter((i) => i.id !== id));
    if (!initial?.imageIds.includes(id))
      await fetch("/api/images/" + encodeURIComponent(id), {
        method: "DELETE",
      }).catch(() => undefined);
  }
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setLoading(true);
    setError("");
    const body = {
      ...Object.fromEntries(new FormData(e.currentTarget)),
      imageIds: images.map((i) => i.id),
      ...(initial
        ? {
            action: "edit",
            revision: initial.revision,
            removeExternalImage: removeRemote,
          }
        : {}),
    };
    try {
      const r = await fetch(
        initial
          ? "/api/landlord/listings/" + encodeURIComponent(initial.externalId)
          : "/api/listings/create",
        {
          method: initial ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
            ...(!initial ? { "Idempotency-Key": attempt.keyFor(body) } : {}),
          },
          body: JSON.stringify(body),
        },
      );
      const p = await r.json();
      if (r.status === 410) attempt.confirmed();
      if (!r.ok) throw new Error(p.error);
      attempt.confirmed();
      router.push("/quan-ly-phong?da-gui=1");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && e.name !== "TypeError"
          ? e.message
          : "Mất kết nối. Thông tin vẫn được giữ lại.",
      );
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="content-shell listing-editor">
      <Link className="text-link" href="/quan-ly-phong">
        ← Quản lý phòng
      </Link>
      <span className="section-eyebrow">Không gian dành cho chủ trọ</span>
      <h1>{initial ? "Chỉnh sửa tin phòng" : "Đăng phòng mới"}</h1>
      <p>
        Thông tin rõ ràng, ảnh thật giúp người thuê dễ lựa chọn.{" "}
        {initial
          ? "Sau khi lưu, tin sẽ tạm rời danh sách công khai và chờ Admin duyệt lại."
          : "Tin sẽ công khai sau khi được Admin duyệt."}
      </p>
      <p>
        <Link className="text-link" href="/quy-dinh">
          Xem quy định đăng tin và bình luận →
        </Link>
      </p>
      <form className="listing-form" onSubmit={submit}>
        <div className="editor-section">
          <h2>Thông tin cơ bản</h2>
          <label>
            Tiêu đề
            <input
              name="title"
              defaultValue={initial?.title}
              required
              minLength={5}
              maxLength={120}
              placeholder="Phòng studio có ban công gần Đại học Bách khoa"
            />
          </label>
          <label>
            Mô tả phòng
            <textarea
              name="summary"
              defaultValue={initial?.summary}
              required
              minLength={20}
              maxLength={3000}
              rows={6}
              placeholder="Mô tả tiện ích, nội thất, chi phí điện nước và quy định..."
            />
          </label>
          <label>
            Địa chỉ
            <input
              name="address"
              defaultValue={initial?.address}
              required
              maxLength={500}
              placeholder="Tên đường, phường, quận tại Đà Nẵng"
            />
          </label>
          <div className="form-row">
            <label>
              Giá thuê / tháng (đồng)
              <input
                name="price"
                defaultValue={initial?.price}
                required
                type="number"
                min="1"
                max="1000000000"
                step="1"
                placeholder="2500000"
              />
            </label>
            <label>
              Diện tích (m²)
              <input
                name="area"
                defaultValue={initial?.area}
                required
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                placeholder="25"
              />
            </label>
          </div>
          <label>
            Khu vực
            <select
              name="clusterId"
              defaultValue={initial?.clusterId || "chua-phan-cum"}
            >
              {clusters.map((c) => (
                <option value={c.id} key={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Số điện thoại liên hệ (không bắt buộc)
            <input
              name="phone"
              defaultValue={initial?.phone || ""}
              inputMode="tel"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              placeholder="Số điện thoại của bạn"
            />
          </label>
        </div>
        <div className="editor-section">
          <h2>Ảnh thực tế của phòng</h2>
          <p id="photo-help">
            Tối đa 4 ảnh JPG, PNG hoặc WebP, mỗi ảnh không quá 5 MB. Nên chọn
            ảnh ngang khoảng 1200 × 900 px (tỉ lệ 4:3), đủ sáng và không chèn
            chữ che nội thất. Ảnh đầu tiên là ảnh bìa; bạn có thể đổi ảnh bìa
            bên dưới. Ảnh dọc vẫn được chấp nhận; trang chi tiết cho xem trọn
            ảnh. Hệ thống tự nén và giữ đúng tỉ lệ trước khi lưu.
          </p>
          <label className="photo-upload">
            Chọn ảnh phòng
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={upload}
              disabled={busy || images.length >= 4}
              aria-describedby="photo-help"
            />
          </label>
          {uploading && <p role="status">Đang xử lý ảnh...</p>}
          <div className="photo-grid">
            {images.map((i, index) => (
              <figure key={i.id}>
                <img src={i.url} alt={"Ảnh phòng " + (index + 1)} />
                <figcaption>
                  <span>{index === 0 ? "Ảnh bìa" : "Ảnh " + (index + 1)}</span>
                  {index > 0 && (
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      aria-label={`Đặt làm bìa: ảnh ${index + 1}`}
                      onClick={() =>
                        setImages((current) => [
                          current[index],
                          ...current.filter(
                            (_, position) => position !== index,
                          ),
                        ])
                      }
                    >
                      Đặt làm bìa
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => remove(i.id)}
                    aria-label={"Bỏ ảnh " + (index + 1)}
                  >
                    Bỏ ảnh
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
          {initial?.imageUrl?.startsWith("https://") &&
            !images.length &&
            !removeRemote && (
              <div>
                <img
                  className="legacy-photo"
                  src={initial.imageUrl}
                  alt="Ảnh bìa hiện tại"
                />
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setRemoveRemote(true)}
                >
                  Bỏ ảnh bìa hiện tại
                </button>
              </div>
            )}
        </div>
        {error && (
          <p className="feedback feedback-error" role="alert">
            {error}
          </p>
        )}
        <div className="editor-actions">
          <Link className="secondary-btn" href="/quan-ly-phong">
            Quay lại
          </Link>
          <button className="primary-btn" disabled={busy}>
            {loading
              ? "Đang lưu..."
              : initial
                ? "Lưu và gửi duyệt lại"
                : "Gửi tin chờ duyệt"}
          </button>
        </div>
      </form>
    </section>
  );
}
