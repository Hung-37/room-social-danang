export type Cluster = {
  id: string;
  name: string;
  short: string;
  schools: string[];
  accent: string;
  description?: string;
  tags?: string[];
};

export type PostKind = 'question' | 'experience' | 'warning';
export type PostStatus = 'Còn phòng' | 'Cần kiểm chứng' | 'Đã có báo cáo' | 'Đã từ chối';

export type RoomPost = {
  id: string;
  title: string;
  price: string;
  area: string;
  distance: string;
  clusterId: string;
  clusterName: string;
  source: 'Facebook' | 'Threads' | 'Website';
  trust: number;
  comments: number;
  updated: string;
  status: PostStatus;
  tags: string[];
  image: string;
  imageUrl?: string;
  sourceUrl?: string;
  phone?: string;
  authorName?: string;
  postKind?: PostKind;
  address?: string;
  summary: string;
};

export type UserRole = 'student' | 'landlord' | 'admin';
export type User = { id: string; name: string; email: string; role: UserRole };

export type ListingFilters = {
  minPrice?: number;
  maxPrice?: number;
  minArea?: number;
  maxArea?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'area_desc';
};

export type ApiError = { error: string; code?: string; details?: unknown };
