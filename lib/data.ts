import type { Cluster, RoomPost } from "@/lib/types";
import { decodeHtmlText } from "@/lib/html-text";
export type { Cluster, RoomPost } from "@/lib/types";

import { UNASSIGNED_CLUSTER_ID } from "@/lib/policies/address-cluster.js";
export { UNASSIGNED_CLUSTER_ID };

export const clusters: Cluster[] = [
  {
    id: "bach-khoa-su-pham",
    name: "Bách khoa – Sư phạm",
    short: "Liên Chiểu",
    schools: ["ĐH Bách khoa", "ĐH Sư phạm"],
    accent: "one",
    description:
      "Khu vực tập trung nhiều trường đại học lớn, phòng trọ phong phú",
    tags: ["Gần trường", "Giá hợp lý", "Tiện ích"],
  },
  {
    id: "hoa-cuong",
    name: "Hòa Cường",
    short: "Hòa Cường – Xô Viết Nghệ Tĩnh",
    schools: ["ĐH Đông Á", "ĐH Kiến trúc"],
    accent: "two",
    description: "Khu vực phát triển, nhiều phòng trọ mới và tiện ích hiện đại",
    tags: ["Phòng mới", "Full nội thất", "An ninh"],
  },
  {
    id: "hai-chau",
    name: "Hải Châu",
    short: "Trung tâm",
    schools: ["ĐH Sư phạm Kỹ thuật", "Các cơ sở lân cận"],
    accent: "three",
    description: "Khu vực trung tâm, gần các tiện ích công cộng và chợ",
    tags: ["Trung tâm", "Tiện ích", "Gần chợ"],
  },
  {
    id: "ngu-hanh-son",
    name: "Ngũ Hành Sơn",
    short: "Ngũ Hành Sơn",
    schools: ["ĐH Kinh tế", "Các trường lân cận"],
    accent: "four",
    description: "Khu vực yên tĩnh, gần biển và các khu du lịch",
    tags: ["Yên tĩnh", "Gần biển", "Môi trường tốt"],
  },
  {
    id: "nam-da-nang",
    name: "Nam Đà Nẵng",
    short: "Khu đô thị đại học",
    schools: ["VKU", "ĐH Y Dược", "Các cơ sở lân cận"],
    accent: "five",
    description: "Khu đô thị đại học mới, nhiều phòng trọ sinh viên giá rẻ",
    tags: ["Giá sinh viên", "Khu đô thị", "Wifi miễn phí"],
  },
  {
    id: "son-tra",
    name: "Sơn Trà",
    short: "Sơn Trà – An Hải",
    schools: [],
    accent: "four",
    description: "Phòng trọ khu vực Sơn Trà, An Hải và các khu dân cư ven biển",
    tags: ["Sơn Trà", "An Hải", "Ven biển"],
  },
  {
    id: "cam-le",
    name: "Cẩm Lệ",
    short: "Cẩm Lệ – Hòa An – Hòa Xuân",
    schools: [],
    accent: "two",
    description: "Phòng trọ khu vực Cẩm Lệ, Hòa An, Hòa Thọ và Hòa Xuân",
    tags: ["Cẩm Lệ", "Khu dân cư", "Thuận tiện đi lại"],
  },
  {
    id: "hoa-vang",
    name: "Hòa Vang",
    short: "Khu vực Hòa Vang",
    schools: [],
    accent: "five",
    description: "Phòng trọ thuộc khu vực Hòa Vang và các khu dân cư lân cận",
    tags: ["Hòa Vang", "Yên tĩnh", "Khu dân cư"],
  },
  {
    id: UNASSIGNED_CLUSTER_ID,
    name: "Chưa phân cụm",
    short: "Đà Nẵng",
    schools: ["Đang chờ xác định khu vực"],
    accent: "six",
    description: "Các phòng chưa đủ thông tin để xếp vào một cụm cụ thể",
    tags: ["Cần bổ sung địa chỉ", "Chờ kiểm chứng"],
  },
];

const CLUSTER_NAMES = new Map(
  clusters.map((cluster) => [cluster.id, cluster.name]),
);

/**
 * Chuẩn hóa dữ liệu từ database/phù kiện sang RoomPost với khuôn mẫu thống nhất
 * Hàm này được dùng ở tất cả các nơi để đảm bảo dữ liệu đồng nhất
 */
export function normalizeToRoomPost(input: Record<string, unknown>): RoomPost {
  const text = (key: string) =>
    typeof input[key] === "string" ? (input[key] as string) : "";
  const number = (key: string) =>
    input[key] === null || input[key] === undefined || input[key] === ""
      ? null
      : Number.isFinite(Number(input[key]))
        ? Number(input[key])
        : null;
  const kind = text("postKind");
  const item = {
    externalId:
      text("externalId") ||
      (typeof input.externalId === "number" ? String(input.externalId) : ""),
    id: text("id") || (typeof input.id === "number" ? String(input.id) : ""),
    title: text("title"),
    summary: text("summary"),
    clusterId: text("clusterId"),
    price: number("price"),
    area: number("area"),
    trustScore: number("trustScore"),
    commentCount: number("commentCount"),
    verificationStatus: text("verificationStatus"),
    imageUrl: text("imageUrl"),
    address: text("address"),
    sourceUrl: text("sourceUrl"),
    phone: text("phone"),
    authorName: text("authorName"),
    postKind:
      kind === "question" || kind === "experience" || kind === "warning"
        ? kind
        : undefined,
    tags: Array.isArray(input.tags)
      ? input.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
  };
  const clusterId = String(item.clusterId || UNASSIGNED_CLUSTER_ID);
  const verificationStatus = String(item.verificationStatus ?? "needs_review");
  const hasPrice =
    item.price !== null && item.price !== undefined && item.price > 0;

  // Xác định trạng thái dựa trên verificationStatus
  let status: "Còn phòng" | "Cần kiểm chứng" | "Đã có báo cáo" | "Đã từ chối";
  if (verificationStatus === "verified") {
    status = "Còn phòng";
  } else if (verificationStatus === "rejected") {
    status = "Đã từ chối";
  } else if (verificationStatus === "reported") {
    status = "Đã có báo cáo";
  } else {
    status = "Cần kiểm chứng";
  }

  // Format giá nếu có
  const price = hasPrice
    ? `${Number(item.price).toLocaleString("vi-VN")}đ/tháng`
    : "";

  // Format diện tích nếu có
  const area = item.area ? `${item.area}m²` : "";

  // Xác định image icon dựa trên loại bài
  const image = hasPrice ? "🏠" : "💬";

  // Tags mặc định dựa trên loại bài
  const defaultTags = hasPrice
    ? []
    : item.postKind === "question"
      ? ["Hỏi đáp"]
      : item.postKind === "experience"
        ? ["Trải nghiệm"]
        : item.postKind === "warning"
          ? ["Cảnh báo"]
          : [];

  return {
    id: String(item.externalId || item.id || ""),
    title: decodeHtmlText(item.title || "Không có tiêu đề"),
    price,
    area,
    distance: "", // Không có từ database
    clusterId,
    clusterName: CLUSTER_NAMES.get(clusterId) || "Đà Nẵng",
    source: "Website",
    trust: Number(item.trustScore ?? 20),
    comments: Number(item.commentCount ?? 0),
    updated: "mới cập nhật",
    status,
    tags:
      item.tags && item.tags.length > 0
        ? item.tags.map(decodeHtmlText)
        : defaultTags,
    image,
    imageUrl:
      typeof item.imageUrl === "string" && item.imageUrl.trim()
        ? item.imageUrl
        : undefined,
    address:
      typeof item.address === "string" && item.address.trim()
        ? decodeHtmlText(item.address)
        : undefined,
    sourceUrl:
      typeof item.sourceUrl === "string" && item.sourceUrl.trim()
        ? item.sourceUrl
        : undefined,
    summary: decodeHtmlText(item.summary ?? ""),
    phone:
      typeof item.phone === "string" && item.phone.trim()
        ? item.phone
        : undefined,
    authorName:
      typeof item.authorName === "string" && item.authorName.trim()
        ? item.authorName
        : undefined,
    postKind: item.postKind as RoomPost["postKind"],
  };
}

export const posts: RoomPost[] = [];

export const comments: Array<{
  id: number;
  user: string;
  text: string;
  time: string;
}> = [];
