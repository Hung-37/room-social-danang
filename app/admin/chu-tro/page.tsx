import { getAdminSession } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import LandlordReview from './LandlordReview';
export default async function Page() { if (!await getAdminSession()) redirect('/dang-nhap'); return <><AdminHeader /><main id="main-content" tabIndex={-1} className="container section"><h1>Xác minh chủ trọ</h1><p>Kiểm tra thông tin chủ trọ trước khi cấp quyền gửi tin phòng. Mỗi tin vẫn cần được duyệt riêng.</p><LandlordReview /></main></>; }
