function normalized(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}
export function listingRejectionReason(l, daNangOnly = true) {
  if (
    typeof l.title !== 'string' ||
    l.title.trim().length < 5 ||
    !(
      (l.price !== null && l.price >= 1 && l.price <= 1e9) ||
      (l.area !== null && l.area >= 0.01 && l.area <= 100000) ||
      l.address
    )
  )
    return 'Thiếu thông tin cơ bản hoặc số liệu không hợp lệ.';
  if (!daNangOnly) return '';
  const where = normalized(l.address || [l.title, l.summary].join(' '));
  if (
    /\b(?:ha noi|ho chi minh|sai gon|hai phong|nha trang|da lat)\b/.test(where) ||
    !/\b(?:da nang|hai chau|lien chieu|ngu hanh son|thanh khe|son tra|cam le|hoa vang|hoa khanh|my an|hoa cuong|hoa xuan)\b/.test(
      where
    )
  )
    return 'Chưa xác định thuộc phạm vi Đà Nẵng.';
  return '';
}
