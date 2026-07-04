import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.js';
import type { DatabaseClient } from '../database.js';

function result(rows: Array<Record<string, unknown>>) {
  return { rows, rowCount: rows.length, command: '', oid: 0, fields: [] };
}

describe('database routes', () => {
  it('registers database health and CRUD routes when a client is supplied', async () => {
    const query = vi.fn(async (sql: string, values?: unknown[]) => {
      if (sql.startsWith('SELECT 1')) return result([{ ok: 1 }]);
      if (sql.startsWith('SELECT id, name FROM test_table ORDER')) return result([{ id: 1, name: '测试用户' }]);
      if (sql.startsWith('INSERT')) return result([{ id: 2, name: values?.[0] }]);
      return result([]);
    });
    const end = vi.fn(async () => undefined);
    const database = { query, end } as unknown as DatabaseClient;
    const app = await buildApp({ database, logger: false });

    const health = await app.inject({ method: 'GET', url: '/api/v1/db/test' });
    const list = await app.inject({ method: 'GET', url: '/api/v1/users' });
    const created = await app.inject({ method: 'POST', url: '/api/v1/users', payload: { name: '  新用户  ' } });
    await app.close();

    expect(health.statusCode).toBe(200);
    expect(health.json().data.connected).toBe(true);
    expect(list.json().data).toEqual([{ id: 1, name: '测试用户' }]);
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toEqual({ id: 2, name: '新用户' });
    expect(end).toHaveBeenCalledOnce();
  });

  it('validates user input before querying the database', async () => {
    const query = vi.fn();
    const database = { query, end: vi.fn(async () => undefined) } as unknown as DatabaseClient;
    const app = await buildApp({ database, logger: false });

    const response = await app.inject({ method: 'POST', url: '/api/v1/users', payload: { name: '   ' } });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().code).toBe('VALIDATION_ERROR');
    expect(query).not.toHaveBeenCalled();
  });
});
