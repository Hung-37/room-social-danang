import Header from '@/components/Header';
import ProfileClient from './ProfileClient';

export default function ProfilePage() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <ProfileClient />
      </main>
    </>
  );
}