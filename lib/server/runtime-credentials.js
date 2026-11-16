/** Check names only: errors must never include configuration values. */
export function getAdminCredentials(env = process.env) {
  return {
    email: env.ADMIN_EMAIL || (env.NODE_ENV === 'development' ? 'developer@example.invalid' : ''),
    password: env.ADMIN_PASSWORD || '',
  };
}

export function assertProductionCredentials(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const missing = ['ADMIN_PASSWORD', 'ADMIN_SESSION_SECRET', 'USER_SESSION_SECRET']
    .filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Không thể khởi động production: thiếu ${missing.join(', ')}. Hãy đặt các biến này trước khi deploy.`);
  }
}
