import type { ApiResponse } from '@moyan/contracts';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { QueryResultRow } from 'pg';
import { z } from 'zod';
import { config } from '../config.js';
import type { DatabaseClient } from '../database.js';
import { ProviderError } from '../providers/provider.js';

interface DatabaseRoutesOptions {
  database: DatabaseClient;
}

interface UserRow extends QueryResultRow {
  id: number;
  name: string;
}

interface DatabaseCheckRow extends QueryResultRow {
  ok: number;
}

const idSchema = z.object({ id: z.coerce.number().int().positive() });
const userSchema = z.object({ name: z.string().trim().min(1, '姓名不能为空').max(100, '姓名不能超过 100 个字符') });

export async function registerDatabaseRoutes(app: FastifyInstance, options: DatabaseRoutesOptions): Promise<void> {
  const { database } = options;

  function response<T>(request: FastifyRequest, data: T): ApiResponse<T> {
    return {
      data,
      meta: { requestId: request.id, provider: config.mode, timestamp: new Date().toISOString() }
    };
  }

  async function query<T extends QueryResultRow>(sql: string, values: unknown[] = []) {
    try {
      return await database.query<T>(sql, values);
    } catch {
      throw new ProviderError('数据库暂时不可用，请检查连接配置和数据表', 503, 'DATABASE_UNAVAILABLE');
    }
  }

  app.get('/api/v1/db/test', async (request) => {
    const result = await query<DatabaseCheckRow>('SELECT 1 AS ok');
    return response(request, { connected: result.rows[0]?.ok === 1 });
  });

  app.get('/api/v1/users', async (request) => {
    const result = await query<UserRow>('SELECT id, name FROM test_table ORDER BY id');
    return response(request, result.rows);
  });

  app.get('/api/v1/users/:id', async (request) => {
    const { id } = idSchema.parse(request.params);
    const result = await query<UserRow>('SELECT id, name FROM test_table WHERE id = $1', [id]);
    const user = result.rows[0];
    if (!user) throw new ProviderError('用户不存在', 404, 'USER_NOT_FOUND');
    return response(request, user);
  });

  app.post('/api/v1/users', async (request, reply) => {
    const { name } = userSchema.parse(request.body);
    const result = await query<UserRow>('INSERT INTO test_table (name) VALUES ($1) RETURNING id, name', [name]);
    return reply.code(201).send(response(request, result.rows[0]));
  });

  app.put('/api/v1/users/:id', async (request) => {
    const { id } = idSchema.parse(request.params);
    const { name } = userSchema.parse(request.body);
    const result = await query<UserRow>('UPDATE test_table SET name = $1 WHERE id = $2 RETURNING id, name', [name, id]);
    const user = result.rows[0];
    if (!user) throw new ProviderError('用户不存在', 404, 'USER_NOT_FOUND');
    return response(request, user);
  });

  app.delete('/api/v1/users/:id', async (request) => {
    const { id } = idSchema.parse(request.params);
    const result = await query<UserRow>('DELETE FROM test_table WHERE id = $1 RETURNING id, name', [id]);
    const user = result.rows[0];
    if (!user) throw new ProviderError('用户不存在', 404, 'USER_NOT_FOUND');
    return response(request, user);
  });
}
