import { afterEach, describe, expect, it, vi } from 'vitest';
import { DifyService, fallbackResult, toChatResult } from './dify-service.js';

const deviceState = {
  Temp: null,
  Humi: null,
  Lumi: null,
  Dist: null,
  LampST: 'UNKNOWN',
  CtlMode: 'UNKNOWN'
} as const;

const baseAssistant = {
  reply_text: 'I can help.',
  intent: { type: 'UNKNOWN', confidence: 0 },
  device_summary: {},
  control: {
    requires_confirmation: false,
    confirmed: true,
    action: 'NONE',
    value: 'NONE',
    safety_level: 'SAFE',
    confirm_question: '',
    program_action: {
      ready_to_execute: true,
      command_name: 'NONE',
      paras: {}
    }
  },
  suggested_buttons: [],
  errors: []
};

describe('DifyService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a fallback result when the API key is missing', async () => {
    const service = new DifyService({ apiBase: 'https://api.example.test', appUserPrefix: 'moyan' });

    const result = await service.chat({
      userId: 'user-1',
      deviceId: 'device-1',
      message: 'status',
      deviceState
    });

    expect(result.pendingAction).toBeNull();
    expect(result.assistant.errors[0]).toContain('DIFY_API_KEY');
  });

  it('normalizes a valid Dify answer and keeps device commands pending', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          answer: JSON.stringify({
            reply_text: 'Please confirm light on.',
            control: {
              action: 'Light',
              value: 'ON',
              requires_confirmation: false,
              confirmed: true,
              program_action: { ready_to_execute: true, command_name: 'Light', paras: { light: 'ON' } }
            }
          })
        })
    }));
    vi.stubGlobal('fetch', fetchMock);
    const service = new DifyService({ apiBase: 'https://api.example.test/', apiKey: 'key', appUserPrefix: 'moyan' });

    const result = await service.chat({
      userId: '',
      deviceId: 'device-1',
      message: 'turn on the light',
      deviceState
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/chat-messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer key' })
      })
    );
    expect(result.pendingAction).toMatchObject({ deviceId: 'device-1', action: 'Light', value: 'ON' });
    expect(result.assistant.control.requires_confirmation).toBe(true);
    expect(result.assistant.control.confirmed).toBe(false);
    expect(result.assistant.control.program_action.ready_to_execute).toBe(false);
  });

  it('uses deterministic control fallback for clear English mode requests', () => {
    const result = toChatResult('device-1', baseAssistant, 'please switch to voice mode');

    expect(result.pendingAction).toEqual({
      deviceId: 'device-1',
      action: 'CtlMode',
      value: 'VOICE',
      confirmQuestion: expect.any(String)
    });
    expect(result.assistant.control.program_action.paras).toEqual({ ctlMode: 'VOICE' });
  });

  it('does not create pending actions for unsupported control values', () => {
    const result = toChatResult('device-1', {
      ...baseAssistant,
      control: {
        ...baseAssistant.control,
        action: 'Light',
        value: 'BLINK'
      }
    });

    expect(result.pendingAction).toBeNull();
    expect(result.assistant.control.requires_confirmation).toBe(true);
  });

  it('captures fallback errors for malformed answers', async () => {
    const result = fallbackResult('bad answer');

    expect(result.replyText).toEqual(expect.any(String));
    expect(result.pendingAction).toBeNull();
    expect(result.assistant.errors).toEqual(['bad answer']);
  });
});
