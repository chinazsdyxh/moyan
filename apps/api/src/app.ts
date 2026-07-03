import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type { ApiProblem, ApiResponse, HealthStatus, RealtimeEvent } from '@moyan/contracts';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z, ZodError } from 'zod';
import { config, isHuaweiCloudConfigured } from './config.js';
import { HuaweiCloudProvider } from './providers/huaweicloud-provider.js';
import { MockDeviceProvider } from './providers/mock-provider.js';
import { ProviderError } from './providers/provider.js';
import { registerAssistantRoutes } from './routes/assistant-routes.js';
import { DifyService, type DifyServiceOptions } from './services/dify-service.js';
import { DeviceService } from './services/device-service.js';

export interface BuildAppOptions {
  devices?: DeviceService;
  dify?: Partial<DifyServiceOptions>;
  logger?: boolean;
}

const desiredSchema = z.object({
  serviceId: z.string().min(1).optional(),
  desired: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  version: z.number().int().nonnegative().optional()
});

const commandSchema = z
  .object({
    type: z.enum(['LIGHT', 'MODE', 'CUSTOM']),
    value: z.union([z.string(), z.number(), z.boolean()]).optional(),
    serviceId: z.string().min(1).optional(),
    commandName: z.string().min(1).optional(),
    parameters: z.record(z.string(), z.unknown()).optional()
  })
  .superRefine((command, context) => {
    if (command.type !== 'CUSTOM' && command.value === undefined && command.parameters === undefined) {
      context.addIssue({ code: 'custom', message: '灯光或模式命令必须提供 value 或 parameters' });
    }
    if (command.type === 'CUSTOM' && (!command.commandName || !command.parameters)) {
      context.addIssue({ code: 'custom', message: '自定义命令必须提供 commandName 和 parameters' });
    }
  });

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const devices = options.devices ?? new DeviceService(createProvider());
  const dify = new DifyService({
    apiBase: options.dify?.apiBase ?? config.dify.apiBase,
    apiKey: options.dify?.apiKey ?? config.dify.apiKey,
    appUserPrefix: options.dify?.appUserPrefix ?? config.dify.appUserPrefix
  });
  const app = Fastify({ logger: options.logger ?? true, requestIdHeader: 'x-request-id' });

  await app.register(cors, { origin: config.webOrigin, credentials: true });
  await app.register(helmet, { contentSecurityPolicy: false });

  function response<T>(request: FastifyRequest, data: T): ApiResponse<T> {
    return {
      data,
      meta: { requestId: request.id, provider: config.mode, timestamp: new Date().toISOString() }
    };
  }

  function deviceIdFrom(request: FastifyRequest): string {
    return (request.params as { deviceId: string }).deviceId;
  }

  app.get('/api/v1/health', async (request) => {
    const data: HealthStatus = {
      status: config.mode === 'huaweicloud' && !isHuaweiCloudConfigured() ? 'degraded' : 'ok',
      provider: config.mode,
      configured: config.mode === 'mock' || isHuaweiCloudConfigured(),
      uptimeSeconds: Math.round(process.uptime())
    };
    return response(request, data);
  });

  app.get('/api/v1/devices', async (request) => response(request, await devices.listDevices()));

  app.get('/api/v1/devices/:deviceId', async (request) =>
    response(request, await devices.getDevice(deviceIdFrom(request)))
  );

  app.get('/api/v1/devices/:deviceId/shadow', async (request) =>
    response(request, await devices.getShadow(deviceIdFrom(request)))
  );

  app.put('/api/v1/devices/:deviceId/shadow/desired', async (request) => {
    const update = desiredSchema.parse(request.body);
    return response(request, await devices.updateDesired(deviceIdFrom(request), update));
  });

  app.post('/api/v1/devices/:deviceId/commands', async (request, reply) => {
    const command = commandSchema.parse(request.body);
    const record = await devices.sendCommand(deviceIdFrom(request), command);
    return reply.code(200).send(response(request, record));
  });

  app.get('/api/v1/devices/:deviceId/commands/:commandId', async (request, reply) => {
    const { deviceId, commandId } = request.params as { deviceId: string; commandId: string };
    const command = devices.getCommand(commandId);
    if (!command || command.deviceId !== deviceId) {
      throw new ProviderError('命令记录不存在', 404, 'COMMAND_NOT_FOUND');
    }
    return reply.send(response(request, command));
  });

  app.get('/api/v1/devices/:deviceId/logs', async (request) => {
    const query = z.object({ limit: z.coerce.number().int().min(1).max(100).default(40) }).parse(request.query);
    return response(request, devices.getLogs(deviceIdFrom(request), query.limit));
  });

  app.get('/api/v1/events', async (request, reply) => {
    const { deviceId } = z.object({ deviceId: z.string().min(1) }).parse(request.query);
    reply.hijack();
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });

    let closed = false;
    let polling = false;
    const send = (event: RealtimeEvent) => {
      if (closed) return;
      reply.raw.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    };

    const poll = async () => {
      if (polling || closed) return;
      polling = true;
      try {
        const shadow = await devices.getShadow(deviceId);
        send({ id: randomUUID(), type: 'shadow.updated', deviceId, data: shadow, createdAt: new Date().toISOString() });
      } catch (error) {
        send({
          id: randomUUID(),
          type: 'device.status',
          deviceId,
          data: { status: 'UNKNOWN', error: error instanceof Error ? error.message : '更新失败' },
          createdAt: new Date().toISOString()
        });
      } finally {
        polling = false;
      }
    };

    await poll();
    const shadowTimer = setInterval(poll, 3000);
    const heartbeatTimer = setInterval(() => {
      send({ id: randomUUID(), type: 'heartbeat', deviceId, data: {}, createdAt: new Date().toISOString() });
    }, 15_000);

    request.raw.on('close', () => {
      closed = true;
      clearInterval(shadowTimer);
      clearInterval(heartbeatTimer);
    });
  });

  await registerAssistantRoutes(app, { devices, dify });

  app.setNotFoundHandler((request, reply) => {
    const problem: ApiProblem = {
      status: 404,
      code: 'ROUTE_NOT_FOUND',
      title: '接口不存在',
      detail: `${request.method} ${request.url} 未注册`,
      requestId: request.id
    };
    return reply.code(404).type('application/problem+json').send(problem);
  });

  app.setErrorHandler((error, request, reply) => {
    const isValidation = error instanceof ZodError;
    const status = error instanceof ProviderError ? error.statusCode : isValidation ? 400 : 500;
    const problem: ApiProblem = {
      status,
      code: error instanceof ProviderError ? error.code : isValidation ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
      title: isValidation ? '请求参数错误' : status >= 500 ? '服务暂时不可用' : '请求失败',
      detail: isValidation
        ? error.issues.map((issue) => issue.message).join('；')
        : error instanceof Error
          ? error.message
          : '未知服务错误',
      requestId: request.id
    };
    request.log.error({ err: error, requestId: request.id }, problem.detail);
    return reply.code(status).type('application/problem+json').send(problem);
  });

  return app;
}

function createProvider() {
  return config.mode === 'huaweicloud' ? new HuaweiCloudProvider() : new MockDeviceProvider();
}
