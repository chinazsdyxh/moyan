import { Pool } from 'pg';
import { config, isDatabaseConfigured } from './config.js';

export type DatabaseClient = Pick<Pool, 'query' | 'end'>;

export function createDatabaseClient(): DatabaseClient {
  if (!isDatabaseConfigured()) {
    throw new Error('数据库已启用，但 DB_USER 或 DB_PASSWORD 未配置');
  }

  return new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    max: 10
  });
}
