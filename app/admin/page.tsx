import AdminHeader from '@/components/AdminHeader';
import AdminCollectorClient from './AdminCollectorClient';
import { getAdminSession } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';

export default async function AdminPage() {
  if (!await getAdminSession()) redirect('/dang-nhap');
  return (
    <>
      <AdminHeader />
      <main className="admin-main">
        <AdminCollectorClient />
      </main>
    </>
  );
}
