const CLUSTER_RULES = [
  {
    id: 'bach-khoa-su-pham',
    keywords: [
      'bách khoa', 'sư phạm', 'liên chiểu', 'hòa khánh', 'hoa khanh',
      'hòa minh', 'hoa minh', 'nguyễn lương bằng', 'nguyen luong bang',
      'tôn đức thắng', 'ton duc thang', 'đèo ông ích khiêm'
    ]
  },
  {
    id: 'hoa-cuong',
    keywords: [
      'hòa cường', 'hoa cuong', 'xô viết nghệ tĩnh', 'xo viet nghe tinh',
      'cách mạng tháng tám', 'cach mang thang tam', 'phạm hùng', 'pham hung',
      'đại học đông á', 'dai hoc dong a'
    ]
  },
  {
    id: 'hai-chau',
    keywords: [
      'hải châu', 'hai chau', 'thạch thang', 'thach thang', 'thanh bình',
      'thanh binh', 'hải châu bắc', 'hai chau bac', 'hải châu nam', 'hai chau nam',
      'lê duẩn', 'le duan', 'trần phú', 'tran phu', 'hùng vương', 'hung vuong',
      'bạch đằng', 'bach dang', 'nguyễn văn linh', 'nguyen van linh',
      'lê đình dương', 'le dinh duong', 'trưng nữ vương', 'trung nu vuong',
      'sư phạm kỹ thuật', 'su pham ky thuat'
    ]
  },
  {
    id: 'ngu-hanh-son',
    keywords: [
      'ngũ hành sơn', 'ngu hanh son', 'mỹ an', 'my an', 'mỹ khê', 'my khe',
      'an thượng', 'an thuong', 'hòa hải', 'hoa hai', 'đại học kinh tế',
      'dai hoc kinh te', 'fpt'
    ]
  },
  {
    id: 'nam-da-nang',
    keywords: [
      'nam đà nẵng', 'nam da nang', 'hòa quý', 'hoa quy', 'trần đại nghĩa',
      'tran dai nghia', 'vku', 'việt hàn', 'viet han', 'khu đô thị đại học',
      'khu do thi dai hoc', 'đại học y dược', 'dai hoc y duoc'
    ]
  }
];
const DISTRICT_KEYWORDS = [
  'liên chiểu', 'hoa khanh', 'hải châu', 'hai chau',
  'ngũ hành sơn', 'ngu hanh son', 'nam đà nẵng', 'nam da nang'
].map((keyword) => normalizeText(keyword));

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

function findCluster(value) {
  const text = normalizeText(value);
  const matches = CLUSTER_RULES.flatMap(({ id, keywords }) => keywords
    .map(normalizeText)
    .filter((keyword) => text.includes(keyword))
    .map((keyword) => ({
      id,
      score: keyword.length + (DISTRICT_KEYWORDS.includes(keyword) ? 0 : 100)
    })));
  return matches.sort((left, right) => right.score - left.score)[0]?.id ?? null;
}

export function inferClusterFromAddress(address) {
  return findCluster(address);
}

export function inferClusterFromText(text) {
  return findCluster(text);
}
