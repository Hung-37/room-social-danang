export function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

export function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validateCommunityPost(input) {
  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const summary = typeof input?.summary === 'string' ? input.summary.trim() : '';
  return Boolean(typeof input?.id === 'string' && input.id.trim() && title.length >= 5 && title.length <= 120 && summary.length >= 20 && summary.length <= 3000);
}

export function validateListingInput(input) {
  return Boolean(
    typeof input?.title === 'string' && input.title.trim() &&
    typeof input?.summary === 'string' && input.summary.trim() &&
    typeof input?.address === 'string' && input.address.trim() &&
    Number.isFinite(Number(input?.price)) && Number(input.price) >= 0 &&
    Number.isFinite(Number(input?.area)) && Number(input.area) > 0
  );
}

export function canAccessAdmin(role) {
  return role === 'admin';
}
