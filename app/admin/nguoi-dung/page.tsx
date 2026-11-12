import { getAdminSession } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import UsersClient from './UsersClient';
export default async function Page() {
  if (!(await getAdminSession())) redirect('/dang-nhap');
  return (
    <>
      <AdminHeader />
      <main id="main-content" tabIndex={-1} className="content-shell explorer">
        <UsersClient />
      </main>
    </>
  );
}
