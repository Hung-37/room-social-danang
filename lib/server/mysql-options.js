import { readFileSync } from 'node:fs';

/** Server-only options shared by the app and database maintenance scripts. */
export function mysqlConnectionOptions(env = process.env) {
  const uri = env.MYSQL_URL?.trim();
  if (!uri) throw new Error('MYSQL_URL is required.');
  const ca = env.MYSQL_SSL_CA?.replace(/\\n/g, '\n') ||
    (env.MYSQL_SSL_CA_PATH ? readFileSync(env.MYSQL_SSL_CA_PATH, 'utf8') : undefined);
  if (env.MYSQL_SSL && !['true', 'false'].includes(env.MYSQL_SSL)) {
    throw new Error('MYSQL_SSL must be true or false.');
  }
  if (env.MYSQL_SSL === 'false' && ca) throw new Error('CA configured but MYSQL_SSL=false.');
  return {
    uri,
    ...(env.MYSQL_SSL === 'true' || ca ? { ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } } : {}),
  };
}
