import type { AssistantAnswer, AssistantChatResult, AssistantDeviceState, AssistantPendingAction } from '../types/assistant.js';

const FALLBACK_TEXT = '抱歉，我刚才没有理解清楚，请您再说一遍。';
const APP_CONTEXT =
  '这是面向听障老年人的智能家居文字助手。回答要简短、清楚、温和。涉及控制设备时，必须先让用户确认，不能直接执行。';

export interface DifyServiceOptions {
  apiBase: string;
  apiKey?: string;
  appUserPrefix: string;
}

export interface ChatWithDifyInput {
  userId: string;
  deviceId: string;
  message: string;
  deviceState: AssistantDeviceState;
}

interface DifyChatResponse {
  answer?: unknown;
}

export class DifyService {
  constructor(private readonly options: DifyServiceOptions) {}

  async chat(input: ChatWithDifyInput): Promise<AssistantChatResult> {
    if (!this.options.apiKey) return fallbackResult('DIFY_API_KEY 未配置');

    try {
      const response = await fetch(`${this.options.apiBase.replace(/\/$/, '')}/chat-messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.options.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: {
            device_state: input.deviceState,
            pending_action: {},
            app_context: APP_CONTEXT
          },
          query: input.message,
          response_mode: 'blocking',
          conversation_id: '',
          user: input.userId || `${this.options.appUserPrefix}_${input.deviceId}`
        })
      });

      const text = await response.text();
      const data = parseJson<DifyChatResponse>(text);
      if (!response.ok) return fallbackResult(`Dify 请求失败 (${response.status})`);
      if (typeof data.answer !== 'string') return fallbackResult('Dify answer 不是字符串');

      const assistant = normalizeAssistant(parseJson<unknown>(data.answer));
      return toChatResult(input.deviceId, assistant, input.message);
    } catch (error) {
      return fallbackResult(error instanceof Error ? error.message : 'Dify answer 解析失败');
    }
  }
}

export function toChatResult(deviceId: string, assistant: AssistantAnswer, message = ''): AssistantChatResult {
  const safeAssistant = forceSafeControl(applyDeterministicControlFallback(assistant, message));
  const pendingAction = buildPendingAction(deviceId, safeAssistant);

  return {
    replyText: safeAssistant.reply_text || FALLBACK_TEXT,
    assistant: safeAssistant,
    pendingAction
  };
}

function applyDeterministicControlFallback(assistant: AssistantAnswer, message: string): AssistantAnswer {
  if (assistant.control.action === 'Light' || assistant.control.action === 'CtlMode') return assistant;

  const fallback = detectControlFromMessage(message);
  if (!fallback) return assistant;

  return {
    ...assistant,
    reply_text: fallback.replyText,
    control: {
      ...assistant.control,
      requires_confirmation: true,
      confirmed: false,
      action: fallback.action,
      value: fallback.value,
      safety_level: 'SAFE',
      confirm_question: fallback.confirmQuestion,
      program_action: {
        ready_to_execute: false,
        command_name: fallback.action,
        paras: fallback.action === 'Light' ? { light: fallback.value } : { ctlMode: fallback.value }
      }
    }
  };
}

function detectControlFromMessage(message: string):
  | { action: 'Light'; value: 'ON' | 'OFF'; confirmQuestion: string; replyText: string }
  | { action: 'CtlMode'; value: 'AUTO' | 'HUMAN' | 'VOICE'; confirmQuestion: string; replyText: string }
  | null {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return null;

  if (/(开灯|打开灯|亮灯|turn on.*light|light.*on)/i.test(normalized)) {
    return {
      action: 'Light',
      value: 'ON',
      confirmQuestion: '要现在打开灯吗？',
      replyText: '好的。开灯前请您确认一下：要现在打开灯吗？'
    };
  }
  if (/(关灯|关闭灯|熄灯|turn off.*light|light.*off)/i.test(normalized)) {
    return {
      action: 'Light',
      value: 'OFF',
      confirmQuestion: '要现在关闭灯吗？',
      replyText: '好的。关灯前请您确认一下：要现在关闭灯吗？'
    };
  }
  if (/(自动模式|切换自动|auto mode)/i.test(normalized)) {
    return {
      action: 'CtlMode',
      value: 'AUTO',
      confirmQuestion: '要现在切换到自动模式吗？',
      replyText: '好的。切换到自动模式前请您确认一下：要现在切换吗？'
    };
  }
  if (/(人工模式|手动模式|切换人工|human mode|manual mode)/i.test(normalized)) {
    return {
      action: 'CtlMode',
      value: 'HUMAN',
      confirmQuestion: '要现在切换到人工模式吗？',
      replyText: '好的。切换到人工模式前请您确认一下：要现在切换吗？'
    };
  }
  if (/(语音模式|切换语音|voice mode)/i.test(normalized)) {
    return {
      action: 'CtlMode',
      value: 'VOICE',
      confirmQuestion: '要现在切换到语音模式吗？',
      replyText: '好的。切换到语音模式前请您确认一下：要现在切换吗？'
    };
  }
  return null;
}

export function fallbackResult(errorMessage = 'Dify answer 解析失败'): AssistantChatResult {
  const assistant = fallbackAssistant(errorMessage);
  return {
    replyText: assistant.reply_text,
    assistant,
    pendingAction: null
  };
}

function normalizeAssistant(value: unknown): AssistantAnswer {
  if (!isRecord(value)) throw new Error('Dify answer 解析失败');

  const control = isRecord(value.control) ? value.control : {};
  const programAction = isRecord(control.program_action) ? control.program_action : {};

  return {
    ...value,
    reply_text: typeof value.reply_text === 'string' && value.reply_text ? value.reply_text : FALLBACK_TEXT,
    intent: isRecord(value.intent)
      ? {
          type: typeof value.intent.type === 'string' ? value.intent.type : 'UNKNOWN',
          confidence: typeof value.intent.confidence === 'number' ? value.intent.confidence : 0
        }
      : { type: 'UNKNOWN', confidence: 0 },
    device_summary: isRecord(value.device_summary) ? value.device_summary : {},
    control: {
      requires_confirmation: Boolean(control.requires_confirmation),
      confirmed: Boolean(control.confirmed),
      action: typeof control.action === 'string' ? control.action : 'NONE',
      value: typeof control.value === 'string' ? control.value : 'NONE',
      safety_level: typeof control.safety_level === 'string' ? control.safety_level : 'SAFE',
      confirm_question: typeof control.confirm_question === 'string' ? control.confirm_question : '',
      program_action: {
        ready_to_execute: false,
        command_name: typeof programAction.command_name === 'string' ? programAction.command_name : 'NONE',
        paras: isRecord(programAction.paras) ? programAction.paras : {}
      }
    },
    suggested_buttons: Array.isArray(value.suggested_buttons) ? value.suggested_buttons : [],
    errors: Array.isArray(value.errors) ? value.errors.map(String) : []
  };
}

function forceSafeControl(assistant: AssistantAnswer): AssistantAnswer {
  const action = assistant.control.action;
  const requiresConfirmation = action === 'Light' || action === 'CtlMode' || assistant.control.requires_confirmation;

  return {
    ...assistant,
    control: {
      ...assistant.control,
      requires_confirmation: requiresConfirmation,
      confirmed: false,
      program_action: {
        ...assistant.control.program_action,
        ready_to_execute: false
      }
    }
  };
}

function buildPendingAction(deviceId: string, assistant: AssistantAnswer): AssistantPendingAction | null {
  const { action, value, confirm_question: confirmQuestion } = assistant.control;
  if (action === 'Light' && (value === 'ON' || value === 'OFF')) {
    return {
      deviceId,
      action,
      value,
      confirmQuestion: confirmQuestion || (value === 'ON' ? '要现在打开灯吗？' : '要现在关闭灯吗？')
    };
  }
  if (action === 'CtlMode' && (value === 'AUTO' || value === 'HUMAN' || value === 'VOICE')) {
    return {
      deviceId,
      action,
      value,
      confirmQuestion: confirmQuestion || '要现在切换控制模式吗？'
    };
  }
  return null;
}

function fallbackAssistant(errorMessage: string): AssistantAnswer {
  return {
    reply_text: FALLBACK_TEXT,
    intent: {
      type: 'UNKNOWN',
      confidence: 0
    },
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
    errors: [errorMessage || 'Dify answer 解析失败']
  };
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Dify answer 解析失败');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
