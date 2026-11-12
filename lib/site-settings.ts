import { getDatabasePool, hasDatabaseConfig } from './mysql-pool';
import type { RowDataPacket } from 'mysql2/promise';
export type SiteSettings = {
  siteName: string;
  contactEmail: string;
  postingGuidelines: string;
  registrationEnabled: boolean;
  collectorEnabled: boolean;
  aiEnabled: boolean;
  aiMaxListings: number;
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
    aiEnabled: process.env.COLLECTOR_USE_AI === 'true' || process.env.ENABLE_AI_ANALYSIS === 'true',
    aiMaxListings: 5,
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
    ['registrationEnabled', 'collectorEnabled', 'aiEnabled', 'daNangOnly'].some(
      (k) => typeof s[k as keyof SiteSettings] !== 'boolean'
    ) ||
    !Number.isInteger(s.aiMaxListings) ||
    s.aiMaxListings < 1 ||
    s.aiMaxListings > 20
  )
    throw new Error(
      'Kiểm tra tên (2–60 ký tự), email, quy định (20–2000 ký tự) và giới hạn AI (1–20).'
    );
  if (process.env.AI_DISABLED === 'true' && s.aiEnabled)
    throw new Error('AI đang bị tắt bởi cấu hình máy chủ.');
  return {
    siteName: s.siteName.trim(),
    contactEmail: s.contactEmail.trim(),
    postingGuidelines: s.postingGuidelines.trim(),
    registrationEnabled: s.registrationEnabled,
    collectorEnabled: s.collectorEnabled,
    aiEnabled: s.aiEnabled,
    aiMaxListings: s.aiMaxListings,
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
  const stored = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value;
  return {
    settings: {
      ...fallback,
      ...stored,
      aiEnabled:
        process.env.AI_DISABLED === 'true' ? false : (stored.aiEnabled ?? fallback.aiEnabled)
    } as SiteSettings,
    version: Number(rows[0].version)
  };
}
