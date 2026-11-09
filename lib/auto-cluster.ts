import { clusters, UNASSIGNED_CLUSTER_ID } from '@/lib/data';

/**
 * Tự động phân cụm dựa trên địa chỉ/từ khóa
 */
export function autoAssignCluster(address: string, title: string, summary: string): string {
  const text = `${address} ${title} ${summary}`.toLowerCase();

  // Từ khóa cho từng cụm
  const clusterKeywords: Record<string, string[]> = {
    'bach-khoa-su-pham': ['bách khoa', 'sư phạm', 'liên chiểu', 'hoà khánh', 'hoà khánh', 'hòa khánh', 'hòa khánh', 'le dinh duong', 'lê đình dương', 'truong chinh', 'trường chinh'],
    'hoa-cuong': ['hòa cường', 'hoa cuong', 'xô viết nghệ tĩnh', 'xô viết', 'đông á', 'kiến trúc', 'hue', 'huế', 'pham van dong', 'phạm văn đồng'],
    'hai-chau': ['hải châu', 'trung tâm', 'sư phạm kỹ thuật', 'dòng thương', 'hùng vụng', 'hùng vương', 'đống đa', 'dong da', 'thị xã', 'thị xã hội an'],
    'ngu-hanh-son': ['ngũ hành sơn', 'ngũ hành', 'khoa kinh tế', 'mỹ khê', 'mỹ khê 1', 'mỹ khê 2', 'khu đô thị fpt', 'khu dô thi', 'biển', 'bãi biển'],
    'nam-da-nang': ['nam đà nẵng', 'nam da nang', 'vk university', 'vku', 'đại học y dược', 'y dược', 'đại học công nghệ', 'khu đô thị đại học', 'hoa minh', 'hòa minh', 'hoa liên', 'hòa liên']
  };

  // Tìm cụm phù hợp nhất dựa trên từ khóa
  for (const [clusterId, keywords] of Object.entries(clusterKeywords)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return clusterId;
      }
    }
  }

  // Nếu không tìm thấy, phân cụm dựa trên các từ khóa chung
  if (text.includes('trường') || text.includes('đại học') || text.includes('sinh viên')) {
    // Mặc định gán vào Bách khoa - Sư phạm nếu có từ khóa sinh viên
    return 'bach-khoa-su-pham';
  }

  return UNASSIGNED_CLUSTER_ID;
}

/**
 * Cập nhật clusterId cho listing nếu chưa có
 */
export function ensureClusterAssigned(listing: {
  address?: string | null;
  title?: string;
  summary?: string;
  clusterId?: string | null;
}): string {
  if (listing.clusterId && listing.clusterId !== UNASSIGNED_CLUSTER_ID) {
    return listing.clusterId;
  }

  const address = listing.address || '';
  const title = listing.title || '';
  const summary = listing.summary || '';

  return autoAssignCluster(address, title, summary);
}
