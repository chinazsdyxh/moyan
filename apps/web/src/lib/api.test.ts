import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, type AssistantChatResponse } from './api';

describe('assistant web api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the raw assistant chat response from the backend', async () => {
    const assistantResponse: AssistantChatResponse = {
      replyText: '好的，开灯前请您确认一下。',
      assistant: {
        control: {
          action: 'Light',
          value: 'ON',
          requires_confirmation: true,
          program_action: { ready_to_execute: false }
        }
      },
      pendingAction: {
        deviceId: 'smart-room-demo-01',
        action: 'Light',
        value: 'ON',
        confirmQuestion: '要现在打开灯吗？'
      }
    };
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => assistantResponse
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.assistantChat({
      userId: 'user_001',
      deviceId: 'smart-room-demo-01',
      message: '帮我开灯',
      deviceState: {
        Temp: 26.5,
        Humi: 68,
        Lumi: 120,
        Dist: 45,
        LampST: 'OFF',
        CtlMode: 'HUMAN'
      }
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/assistant/chat', expect.objectContaining({ method: 'POST' }));
    expect(result.replyText).toBe('好的，开灯前请您确认一下。');
    expect(result.pendingAction?.action).toBe('Light');
  });

  it('throws the backend problem detail when an API response fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 400,
        json: async () => ({
          status: 400,
          code: 'VALIDATION_ERROR',
          title: 'Invalid request',
          detail: 'message is required',
          requestId: 'request-1'
        })
      }))
    );

    await expect(api.devices()).rejects.toThrow('message is required');
  });

  it('encodes device ids in REST paths and event stream URLs', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: [], meta: { requestId: 'request-1', provider: 'mock', timestamp: 'now' } })
    }));
    vi.stubGlobal('fetch', fetchMock);

    await api.logs('room one/alpha');
    await api.device('room one/alpha');

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/devices/room%20one%2Falpha/logs?limit=30', expect.any(Object));
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/devices/room%20one%2Falpha', expect.any(Object));
    expect(api.eventsUrl('room one/alpha')).toBe('/api/v1/events?deviceId=room%20one%2Falpha');
  });

  it('wraps standard API endpoints and preserves response envelopes', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        data: { status: 'ok', provider: 'mock', configured: true, uptimeSeconds: 12 },
        meta: { requestId: 'request-1', provider: 'mock', timestamp: 'now' }
      })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await api.health();

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/health', expect.objectContaining({
      headers: { 'Content-Type': 'application/json' }
    }));
    expect(result.data.status).toBe('ok');
  });

  it('sends desired shadow updates and device commands with JSON bodies', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: {}, meta: { requestId: 'request-1', provider: 'mock', timestamp: 'now' } })
    }));
    vi.stubGlobal('fetch', fetchMock);

    await api.updateDesired('device-1', { desired: { threshold: 28 } });
    await api.command('device-1', { type: 'LIGHT', value: 'OFF' });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/devices/device-1/shadow/desired',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ desired: { threshold: 28 } })
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/devices/device-1/commands',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ type: 'LIGHT', value: 'OFF' })
      })
    );
  });

  it('sends assistant confirmations without the display question', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ ok: true, replyText: 'ok', command: {} })
    }));
    vi.stubGlobal('fetch', fetchMock);

    await api.assistantConfirm({
      deviceId: 'device-1',
      action: 'CtlMode',
      value: 'AUTO',
      confirmQuestion: 'Switch now?'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/assistant/confirm',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ deviceId: 'device-1', action: 'CtlMode', value: 'AUTO' })
      })
    );
  });

  it('falls back to HTTP status text when the error body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => {
          throw new Error('not json');
        }
      }))
    );

    await expect(api.shadow('device-1')).rejects.toThrow('Service Unavailable');
  });

  it('falls back to HTTP status text for raw assistant errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: async () => {
          throw new Error('not json');
        }
      }))
    );

    await expect(api.assistantConfirm({
      deviceId: 'device-1',
      action: 'Light',
      value: 'ON',
      confirmQuestion: ''
    })).rejects.toThrow('Bad Gateway');
  });
});
