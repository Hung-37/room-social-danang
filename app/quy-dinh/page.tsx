import Header from "@/components/Header";
import { getSiteSettings } from "@/lib/site-settings";
export const dynamic = "force-dynamic";
export default async function Page() {
  const { settings } = await getSiteSettings();
  return (
    <>
      <Header />
      <main id="main-content" tabIndex={-1} className="content-shell explorer">
        <span className="section-eyebrow">Hướng dẫn cộng đồng</span>
        <h1>Quy định sử dụng {settings.siteName}</h1>
        <p className="full-description">{settings.postingGuidelines}</p>
        <h2>Kiểm duyệt và quyền tài khoản</h2>
        <p>
          Chủ trọ cần được xác minh trước khi đăng phòng. Tin mới và tin chỉnh
          sửa phải được Admin duyệt trước khi công khai. Nội dung AI là gợi ý,
          không thay thế kiểm tra phòng và hợp đồng.
        </p>
        <h2>Ảnh phòng rõ ràng, đúng thực tế</h2>
        <p>
          Mỗi phòng tối đa 4 ảnh JPG, PNG hoặc WebP, tối đa 5 MB mỗi ảnh. Ưu
          tiên ảnh ngang 1200 × 900 px (4:3), chụp đủ sáng, không dùng ảnh của
          phòng khác và không chèn chữ che nội dung.
        </p>
        <p>
          Ảnh đầu tiên là ảnh bìa, có thể chọn lại khi đăng hoặc sửa tin. Bản
          tin căn ảnh bìa trong khung 4:3; trang chi tiết giữ trọn ảnh và cho mở
          ảnh lớn. Hệ thống giữ tỉ lệ, xoay đúng chiều và thu gọn tối đa 1600 px
          mỗi cạnh trước khi lưu.
        </p>
        {settings.contactEmail && (
          <p>
            Liên hệ hỗ trợ:{" "}
            <a className="text-link" href={"mailto:" + settings.contactEmail}>
              {settings.contactEmail}
            </a>
          </p>
        )}
      </main>
    </>
  );
}
