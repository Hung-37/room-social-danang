import Header from '@/components/Header';
import PostDetailClient from './PostDetailClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <PostDetailClient id={id} />
      </main>
    </>
  );
}
