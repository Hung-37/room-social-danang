import { mysqlConnectionOptions } from './mysql-options.js';
import mysql, { type Pool } from 'mysql2/promise';

const database = globalThis as typeof globalThis & { roomDanangMysqlPool?: Pool };

function positiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, maximum) : fallback;
}

export function hasDatabaseConfig() {
  return Boolean(process.env.MYSQL_URL?.trim());
}

/** One bounded pool per Node process, including across development hot reloads. */
export function getDatabasePool(): Pool {
  if (!hasDatabaseConfig()) throw new Error('MYSQL_URL is not configured.');
  database.roomDanangMysqlPool ??= mysql.createPool({
    ...mysqlConnectionOptions(),
    timezone: 'Z',
    connectionLimit: positiveInteger(process.env.MYSQL_POOL_LIMIT, 10, 50),
    queueLimit: positiveInteger(process.env.MYSQL_QUEUE_LIMIT, 100, 1000),
    waitForConnections: true,
    connectTimeout: 10_000,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  });
  return database.roomDanangMysqlPool;
}
