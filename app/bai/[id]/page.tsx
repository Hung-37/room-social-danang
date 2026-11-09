import Header from '@/components/Header';
import PostDetailClient from './PostDetailClient';

type PageProps = { params: Promise<{ id: string }> };

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <>
      <Header />
      <main>
        <PostDetailClient id={id} />
      </main>
    </>
  );
}
