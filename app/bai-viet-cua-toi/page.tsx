import Header from "@/components/Header";
import OwnedPosts from "./OwnedPosts";
export default function Page() {
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="content-shell explorer">
        <span className="section-eyebrow">Nội dung của bạn</span>
        <h1>Bài viết của tôi</h1>
        <p>
          Bạn có thể sửa hoặc xóa thảo luận của mình. Sau khi sửa, bài sẽ tạm ẩn
          và chờ Admin duyệt lại.
        </p>
        <OwnedPosts />
      </main>
    </>
  );
}
