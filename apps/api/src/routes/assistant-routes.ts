import type { DeviceCommandRecord } from '@moyan/contracts';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DifyService } from '../services/dify-service.js';
import type { DeviceService } from '../services/device-service.js';
import type { AssistantChatResult, AssistantDeviceState } from '../types/assistant.js';

const lampStateSchema = z.enum(['ON', 'OFF', 'UNKNOWN']);
const controlModeSchema = z.enum(['AUTO', 'HUMAN', 'VOICE', 'UNKNOWN']);

const deviceStateSchema = z
  .object({
    Temp: z.number().nullable().default(null),
    Humi: z.number().nullable().default(null),
    Lumi: z.number().nullable().default(null),
    Dist: z.number().nullable().default(null),
    LampST: lampStateSchema.default('UNKNOWN'),
    CtlMode: controlModeSchema.default('UNKNOWN')
  })
  .default({
    Temp: null,
    Humi: null,
    Lumi: null,
    Dist: null,
    LampST: 'UNKNOWN',
    CtlMode: 'UNKNOWN'
  });

const chatSchema = z.object({
  userId: z.string().min(1),
  deviceId: z.string().min(1),
  message: z.string().min(1),
  deviceState: deviceStateSchema.optional()
});

const confirmSchema = z
  .object({
    deviceId: z.string().min(1),
    action: z.enum(['Light', 'CtlMode']),
    value: z.enum(['ON', 'OFF', 'AUTO', 'HUMAN', 'VOICE'])
  })
  .superRefine((body, context) => {
    if (body.action === 'Light' && body.value !== 'ON' && body.value !== 'OFF') {
      context.addIssue({ code: 'custom', message: 'Light 只支持 ON 或 OFF' });
    }
    if (body.action === 'CtlMode' && !['AUTO', 'HUMAN', 'VOICE'].includes(body.value)) {
      context.addIssue({ code: 'custom', message: 'CtlMode 只支持 AUTO、HUMAN 或 VOICE' });
    }
  });

export interface AssistantRoutesOptions {
  devices: DeviceService;
  dify: DifyService;
}

export async function registerAssistantRoutes(app: FastifyInstance, options: AssistantRoutesOptions): Promise<void> {
  app.post('/api/v1/assistant/chat', async (request) => {
    const body = chatSchema.parse(request.body);
    const deviceState = body.deviceState ?? defaultDeviceState();
    const result = await options.dify.chat({
      userId: body.userId,
      deviceId: body.deviceId,
      message: body.message,
      deviceState
    });
    return result;
  });

  app.post('/api/v1/assistant/confirm', async (request) => {
    const body = confirmSchema.parse(request.body);
    const command =
      body.action === 'Light'
        ? await options.devices.sendCommand(body.deviceId, { type: 'LIGHT', value: body.value })
        : await options.devices.sendCommand(body.deviceId, { type: 'MODE', value: body.value });

    return {
      ok: true,
      replyText: replyTextFor(body.action, body.value),
      command
    } satisfies { ok: true; replyText: string; command: DeviceCommandRecord };
  });
}

function defaultDeviceState(): AssistantDeviceState {
  return {
    Temp: null,
    Humi: null,
    Lumi: null,
    Dist: null,
    LampST: 'UNKNOWN',
    CtlMode: 'UNKNOWN'
  };
}

function replyTextFor(action: 'Light' | 'CtlMode', value: 'ON' | 'OFF' | 'AUTO' | 'HUMAN' | 'VOICE'): string {
  if (action === 'Light') return value === 'ON' ? '已为您打开灯。' : '已为您关闭灯。';
  if (value === 'AUTO') return '已为您切换到自动模式。';
  if (value === 'HUMAN') return '已为您切换到人工模式。';
  return '已为您切换到语音模式。';
}
