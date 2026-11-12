import Header from '@/components/Header';
import Editor from './Editor';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <Editor id={(await params).id} />
      </main>
    </>
  );
}
