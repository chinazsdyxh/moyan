import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { MockDeviceProvider } from './providers/mock-provider.js';
import { DeviceService } from './services/device-service.js';

const deviceState = {
  Temp: 26.5,
  Humi: 68,
  Lumi: 120,
  Dist: 45,
  LampST: 'OFF',
  CtlMode: 'HUMAN'
} as const;

function mockDifyAnswer(answer: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ answer: JSON.stringify(answer), files: [] })
    }))
  );
}

describe('assistant routes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses Dify answer into a clean assistant object', async () => {
    mockDifyAnswer({
      reply_text: '现在温度26.5度，挺舒适的。',
      intent: { type: 'QUERY_STATUS', confidence: 1 },
      device_summary: {},
      control: {
        requires_confirmation: false,
        confirmed: false,
        action: 'NONE',
        value: 'NONE',
        safety_level: 'SAFE',
        confirm_question: '',
        program_action: {
          ready_to_execute: false,
          command_name: 'NONE',
          paras: {}
        }
      },
      suggested_buttons: [],
      errors: []
    });

    const app = await buildApp({
      devices: new DeviceService(new MockDeviceProvider()),
      dify: { apiKey: 'test-key' },
      logger: false
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/chat',
      payload: {
        userId: 'user_001',
        deviceId: 'smart-room-demo-01',
        message: '现在家里情况怎么样？',
        deviceState
      }
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.replyText).toBe('现在温度26.5度，挺舒适的。');
    expect(body.assistant).toMatchObject({
      reply_text: '现在温度26.5度，挺舒适的。',
      intent: { type: 'QUERY_STATUS', confidence: 1 }
    });
    expect(typeof body.assistant).toBe('object');
    expect(body.pendingAction).toBeNull();
  });

  it('returns pendingAction for light control without sending a device command', async () => {
    mockDifyAnswer({
      reply_text: '好的。开灯前请您确认一下：要现在打开灯吗？',
      control: {
        requires_confirmation: false,
        confirmed: true,
        action: 'Light',
        value: 'ON',
        safety_level: 'SAFE',
        confirm_question: '要现在打开灯吗？',
        program_action: {
          ready_to_execute: true,
          command_name: 'Light',
          paras: { light: 'ON' }
        }
      },
      suggested_buttons: [],
      errors: []
    });

    const devices = new DeviceService(new MockDeviceProvider());
    const sendCommand = vi.spyOn(devices, 'sendCommand');
    const app = await buildApp({ devices, dify: { apiKey: 'test-key' }, logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/chat',
      payload: {
        userId: 'user_001',
        deviceId: 'smart-room-demo-01',
        message: '帮我开灯',
        deviceState
      }
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.pendingAction).toEqual({
      deviceId: 'smart-room-demo-01',
      action: 'Light',
      value: 'ON',
      confirmQuestion: '要现在打开灯吗？'
    });
    expect(body.assistant.control.program_action.ready_to_execute).toBe(false);
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('falls back to pendingAction when Dify misses a clear light command', async () => {
    mockDifyAnswer({
      reply_text: '抱歉，我刚才没有理解清楚，请您再说一遍。',
      intent: { type: 'UNKNOWN', confidence: 0 },
      control: {
        requires_confirmation: false,
        confirmed: false,
        action: 'NONE',
        value: 'NONE',
        safety_level: 'SAFE',
        confirm_question: '',
        program_action: {
          ready_to_execute: false,
          command_name: 'NONE',
          paras: {}
        }
      },
      suggested_buttons: [],
      errors: []
    });

    const devices = new DeviceService(new MockDeviceProvider());
    const sendCommand = vi.spyOn(devices, 'sendCommand');
    const app = await buildApp({ devices, dify: { apiKey: 'test-key' }, logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/chat',
      payload: {
        userId: 'user_001',
        deviceId: 'smart-room-demo-01',
        message: '开灯',
        deviceState
      }
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.pendingAction).toEqual({
      deviceId: 'smart-room-demo-01',
      action: 'Light',
      value: 'ON',
      confirmQuestion: '要现在打开灯吗？'
    });
    expect(body.replyText).toContain('开灯前');
    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('executes the existing device command path only after confirmation', async () => {
    const devices = new DeviceService(new MockDeviceProvider());
    const app = await buildApp({ devices, dify: { apiKey: 'test-key' }, logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/confirm',
      payload: {
        deviceId: 'smart-room-demo-01',
        action: 'Light',
        value: 'ON'
      }
    });

    const shadow = await devices.getShadow('smart-room-demo-01');
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.ok).toBe(true);
    expect(body.replyText).toBe('已为您打开灯。');
    expect(body.command.type).toBe('LIGHT');
    expect(shadow.reported.lamp).toBe('ON');
  });
});
