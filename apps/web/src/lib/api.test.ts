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
});
