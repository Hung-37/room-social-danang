import { getDatabasePool, hasDatabaseConfig } from './mysql-pool';
import type { RowDataPacket } from 'mysql2/promise';
export type SiteSettings = {
  siteName: string;
  contactEmail: string;
  postingGuidelines: string;
  registrationEnabled: boolean;
  collectorEnabled: boolean;
  daNangOnly: boolean;
};
export function defaultSettings(): SiteSettings {
  return {
    siteName: 'RoomĐàNẵng',
    contactEmail: '',
    postingGuidelines:
      'Đăng thông tin phòng chính xác, ảnh thực tế và chi phí rõ ràng. Không đăng nội dung lừa đảo, thông tin cá nhân của người khác hoặc bình luận xúc phạm. Tin mới và tin chỉnh sửa phải được Admin kiểm duyệt.',
    registrationEnabled: true,
    collectorEnabled: true,
    daNangOnly: true
  };
}
export function validateSettings(b: unknown): SiteSettings {
  if (!b || typeof b !== 'object') throw new Error('Cấu hình không hợp lệ.');
  const s = b as SiteSettings;
  if (
    typeof s.siteName !== 'string' ||
    s.siteName.trim().length < 2 ||
    s.siteName.length > 60 ||
    typeof s.contactEmail !== 'string' ||
    s.contactEmail.length > 254 ||
    (s.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.contactEmail)) ||
    typeof s.postingGuidelines !== 'string' ||
    s.postingGuidelines.trim().length < 20 ||
    s.postingGuidelines.length > 2000 ||
    ['registrationEnabled', 'collectorEnabled', 'daNangOnly'].some(
      (k) => typeof s[k as keyof SiteSettings] !== 'boolean'
    )
  )
    throw new Error('Kiểm tra tên (2–60 ký tự), email và quy định (20–2000 ký tự).');
  return {
    siteName: s.siteName.trim(),
    contactEmail: s.contactEmail.trim(),
    postingGuidelines: s.postingGuidelines.trim(),
    registrationEnabled: s.registrationEnabled,
    collectorEnabled: s.collectorEnabled,
    daNangOnly: s.daNangOnly
  };
}
export async function getSiteSettings() {
  const fallback = defaultSettings();
  if (!hasDatabaseConfig()) return { settings: fallback, version: 0 };
  const [rows] = await getDatabasePool().query<RowDataPacket[]>(
    'SELECT value,version FROM site_settings WHERE id=1'
  );
  if (!rows[0]) return { settings: fallback, version: 0 };
  const stored = (typeof rows[0].value === 'string'
    ? JSON.parse(rows[0].value)
    : rows[0].value) as Record<string, unknown>;
  const compatibleSettings = Object.fromEntries(
    Object.entries(stored).filter(([key]) => Object.prototype.hasOwnProperty.call(fallback, key))
  ) as Partial<SiteSettings>;
  return {
    settings: {
      ...fallback,
      ...compatibleSettings
    },
    version: Number(rows[0].version)
  };
}
