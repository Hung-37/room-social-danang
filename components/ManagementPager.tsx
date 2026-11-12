"use client";
import type { PageMeta } from "./usePagedResource";
export default function ManagementPager({
  meta,
  disabled,
  label,
  position,
  onPage,
}: {
  meta: PageMeta | null;
  disabled: boolean;
  label: string;
  position: "đầu" | "cuối";
  onPage: (offset: number) => void;
}) {
  if (!meta) return null;
  if (!meta.count && meta.total > 0)
    return <p role="status">Đang điều chỉnh trang…</p>;
  const page = Math.floor(meta.offset / meta.limit) + 1,
    pages = Math.max(1, Math.ceil(meta.total / meta.limit));
  return (
    <nav
      className="management-pagination"
      aria-label={`Phân trang ${label} ${position} danh sách`}
    >
      <p role="status">
        {meta.total
          ? `Hiển thị ${meta.offset + 1}–${meta.offset + meta.count} / ${meta.total} kết quả. Trang ${page}/${pages}.`
          : "Không có kết quả."}
      </p>
      <div className="inline-actions">
        <button
          className="secondary-btn"
          disabled={disabled || meta.offset === 0}
          onClick={() => onPage(Math.max(0, meta.offset - meta.limit))}
        >
          Trang trước
        </button>
        {Array.from(new Set([1, pages, page - 1, page, page + 1].filter(n => n >= 1 && n <= pages))).sort((a, b) => a - b).map((n, index, numbers) => (
          <span key={n} className="inline-actions">
            {index > 0 && n - numbers[index - 1] > 1 && <span aria-hidden="true">…</span>}
            <button className={n === page ? "primary-btn" : "secondary-btn"} aria-label={`Trang ${n}`} aria-current={n === page ? "page" : undefined} disabled={disabled || n === page} onClick={() => onPage((n - 1) * meta.limit)}>{n}</button>
          </span>
        ))}
        <button
          className="secondary-btn"
          disabled={disabled || !meta.hasMore}
          onClick={() => onPage(meta.nextOffset)}
        >
          Trang sau
        </button>
      </div>
    </nav>
  );
}
