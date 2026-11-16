/** Display metadata only: never grants publication or changes database state. */
export const REFERENCE_LABEL = 'Tin tham khảo · Chưa xác minh · Chưa xác nhận còn phòng';
export function safeSourceUrl(value) {
  if (typeof value !== 'string') return undefined;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export function listingPresentation(input) {
  const contentKind = input.contentKind === 'discussion' || (!input.contentKind && input.postKind) ? 'discussion' : 'listing';
  const isReference = contentKind === 'listing' && (input.isReference === true || (input.verificationStatus ? input.verificationStatus !== 'verified' : input.status !== 'Đã duyệt'));
  const owner = typeof input.ownerExternalId === 'string' && input.ownerExternalId.trim();
  const date = input.updatedAt instanceof Date ? input.updatedAt : typeof input.updatedAt === 'string' && input.updatedAt.trim() ? new Date(input.updatedAt) : null;
  return {
    contentKind, isReference,
    label: isReference ? REFERENCE_LABEL : 'Tin đã duyệt',
    canChat: contentKind === 'listing' && !isReference && Boolean(owner),
    showImages: !isReference || input.imageRightsConfirmed === true,
    sourceName: typeof input.sourceName === 'string' ? input.sourceName.trim() : '',
    sourceUrl: safeSourceUrl(input.sourceUrl),
    updated: date && Number.isFinite(date.getTime()) ? date.toLocaleString('vi-VN', {timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'short'}) : 'Chưa có thời gian cập nhật',
  };
}
