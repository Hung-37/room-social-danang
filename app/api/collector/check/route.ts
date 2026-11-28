import { load } from 'cheerio';
import { randomUUID } from 'node:crypto';
import { isPublicFeedUrl } from '@/lib/server/collector/parser.js';
import { getAdminSessionFromRequest } from '@/lib/server/admin-auth';
import { getManagedSourcesAsync, setSourceEnabledAsync } from '@/lib/server/collector-source-storage';
import { saveCollectorSourceSetting } from '@/lib/server/collector-db';
import { apiData, apiError } from '@/lib/server/api-response';
import type { CollectorSource } from '@/lib/server/collector/parser.js';

function sourceEnableRestriction(source: CollectorSource) {
  if (source.permission === 'manual_review')
    return 'Nguồn này chỉ dùng để tham khảo; chưa được phép thu thập tự động.';
  if (
    source.id === 'data-template' &&
    process.env.NODE_ENV === 'production' &&
    process.env.COLLECTOR_INCLUDE_DEMO !== 'true'
  )
    return 'Nguồn dữ liệu mẫu đang bị khóa trên production.';
  if (source.permission !== 'local_file' && !isPublicFeedUrl(source.url))
    return 'Cần cấu hình URL HTTPS công khai hợp lệ trước khi bật nguồn.';
  return null;
}

export async function GET(r: Request) {
  if (!getAdminSessionFromRequest(r)) return apiError('Yêu cầu quyền Admin.', 401);
  try {
    const sources = (await getManagedSourcesAsync()).filter(
      (source) => sourceEnableRestriction(source) === null
    );
    return apiData(
      sources.map((s) => {
        const enableRestriction = sourceEnableRestriction(s);
        return {
          ...s,
          canEnable: enableRestriction === null,
          enableRestriction,
          result: {
            ok: false,
            status: s.enabled ? 'configured' : 'disabled',
            note: 'Trạng thái cấu hình, chưa xác minh nguồn trực tiếp. Dùng Xem thử URL để kiểm tra.'
          }
        };
      }),
      { meta: { configured: sources.length } }
    );
  } catch {
    return apiError('Chưa tải được cấu hình nguồn.', 503);
  }
}
export async function POST(r: Request) {
  const admin = getAdminSessionFromRequest(r);
  if (!admin) return apiError('Yêu cầu quyền Admin.', 401);
  const b = await r.json().catch(() => null);
  if (!b || typeof b !== 'object') return apiError('JSON cấu hình không hợp lệ.', 400);
  try {
    if (typeof b.sourceId === 'string' && typeof b.enabled === 'boolean' && !('url' in b)) {
      const selected=(await getManagedSourcesAsync()).find(s=>s.id===b.sourceId);
      if (b.enabled && selected) {
        const restriction = sourceEnableRestriction(selected);
        if (restriction) return apiError(restriction, 400);
      }
      const ok = await setSourceEnabledAsync(b.sourceId, b.enabled, admin.email);
      return ok
        ? apiData({ success: true, sourceId: b.sourceId, enabled: b.enabled })
        : apiError('Không tìm thấy nguồn.', 404);
    }
    const name = typeof b.name === 'string' ? b.name.trim() : '';
    const url = typeof b.url === 'string' ? b.url.trim() : '';
    if (
      name.length < 2 ||
      name.length > 100 ||
      !isPublicFeedUrl(url) ||
      url.length > 2000 ||
      typeof b.enabled !== 'boolean'
    )
      return apiError(
        'Nhập tên nguồn (2–100 ký tự), URL HTTPS công khai và trạng thái hợp lệ.',
        400
      );
    const permission = b.permission === 'public_feed' ? 'public_feed' : 'public_html';
    const selectors = b.selectors ?? {};
    if (typeof selectors !== 'object' || Array.isArray(selectors))
      return apiError('Bộ chọn HTML không hợp lệ.', 400);
    const listingSelectors: Record<string, string> = {};
    for (const key of [
      'itemSelector',
      'titleSelector',
      'descriptionSelector',
      'priceSelector',
      'areaSelector',
      'addressSelector'
    ]) {
      if (selectors[key] !== undefined) {
        if (typeof selectors[key] !== 'string' || selectors[key].length > 200)
          return apiError('Mỗi bộ chọn tối đa 200 ký tự.', 400);
        try {
          if (selectors[key].trim()) load('')(selectors[key]);
        } catch {
          return apiError('Bộ chọn HTML không hợp lệ: ' + key, 400);
        }
        listingSelectors[key] = selectors[key];
      }
    }
    const sources = await getManagedSourcesAsync();
    let id = 'custom-' + randomUUID();
    if (b.sourceId) {
      const original = sources.find((s) => s.id === b.sourceId);
      if (!original) return apiError('Không tìm thấy nguồn.', 404);
      if (original.permission === 'local_file' || original.permission === 'manual_review')
        return apiError('Không chỉnh sửa loại nguồn này.', 400);
      id = original.id;
    }
    const source = {
      id,
      name,
      url,
      type: permission === 'public_html' ? 'html' : 'json_or_rss',
      permission,
      enabled: b.enabled,
      keywords: ['phòng trọ', 'phòng cho thuê', 'tìm phòng', 'ở ghép', 'room for rent'],
      listingSelectors,
      note: 'Nguồn cấu hình bởi Admin. Dữ liệu mới cần được duyệt.'
    } as CollectorSource;
    await saveCollectorSourceSetting(source, b.enabled, admin.email);
    return apiData(source, {
      meta: { message: 'Đã lưu nguồn vào MySQL. Cấu hình được giữ sau khi khởi động lại.' }
    });
  } catch {
    return apiError('Chưa lưu được nguồn. Kiểm tra database.', 503);
  }
}
