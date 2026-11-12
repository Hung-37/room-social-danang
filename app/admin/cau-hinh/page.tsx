import { getAdminSession } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import AdminHeader from '@/components/AdminHeader';
import SettingsClient from './SettingsClient';
export default async function Page() {
  if (!(await getAdminSession())) redirect('/dang-nhap');
  return (
    <>
      <AdminHeader />
      <main id="main-content" tabIndex={-1} className="content-shell explorer admin-settings">
        <SettingsClient />
      </main>
    </>
  );
}
