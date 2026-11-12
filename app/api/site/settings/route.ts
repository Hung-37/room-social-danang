import { getSiteSettings } from '@/lib/site-settings';
import { apiData, apiError } from '@/lib/api-response';
export async function GET() {
  try {
    const { settings: s } = await getSiteSettings();
    return apiData(
      {
        siteName: s.siteName,
        contactEmail: s.contactEmail,
        postingGuidelines: s.postingGuidelines,
        registrationEnabled: s.registrationEnabled
      },
      {},
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch {
    return apiError('Chưa tải được thông tin website.', 503);
  }
}
