import Header from '@/components/Header';
import PostDetailClient from './PostDetailClient';

type PageProps = { params: Promise<{ id: string }> };

function decodePostId(id: string) {
  try {
    return decodeURIComponent(id);
  } catch (error) {
    if (error instanceof URIError) return id;
    throw error;
  }
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1}>
        <PostDetailClient id={decodePostId(id)} />
      </main>
    </>
  );
}
