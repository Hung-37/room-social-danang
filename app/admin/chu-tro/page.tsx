import { getAdminSession } from '@/lib/server/admin-auth';
import { redirect } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import LandlordReview from './LandlordReview';
export default async function Page() { if (!await getAdminSession()) redirect('/dang-nhap'); return <><AdminHeader /><main id="main-content" tabIndex={-1} className="container section"><h1>Xác minh chủ trọ</h1><LandlordReview /></main></>; }
