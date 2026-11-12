import Header from '@/components/Header';
import LandlordDashboard from './LandlordDashboard';
export default function Page() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="container section">
        <LandlordDashboard />
      </main>
    </>
  );
}
