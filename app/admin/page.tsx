import AdminHeader from '@/components/AdminHeader';
import AdminCollectorClient from './AdminCollectorClient';
import { getAdminSession } from '@/lib/server/admin-auth';
import { redirect } from 'next/navigation';

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (!(await getAdminSession())) redirect('/dang-nhap');
  const { tab } = await searchParams;
  const initialTab =
    tab === 'listings' || tab === 'reports' ? tab : 'collector';
  return (
    <>
      <AdminHeader />
      <main id="main-content" tabIndex={-1} className="admin-main">
        <AdminCollectorClient initialTab={initialTab} />
      </main>
    </>
  );
}
