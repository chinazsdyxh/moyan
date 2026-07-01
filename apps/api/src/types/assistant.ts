export type AssistantLampState = 'ON' | 'OFF' | 'UNKNOWN';
export type AssistantControlMode = 'AUTO' | 'HUMAN' | 'VOICE' | 'UNKNOWN';
export type AssistantAction = 'NONE' | 'Light' | 'CtlMode' | string;
export type AssistantActionValue = 'NONE' | 'ON' | 'OFF' | 'AUTO' | 'HUMAN' | 'VOICE' | string;

export interface AssistantDeviceState {
  Temp: number | null;
  Humi: number | null;
  Lumi: number | null;
  Dist: number | null;
  LampST: AssistantLampState;
  CtlMode: AssistantControlMode;
}

export interface AssistantControl {
  requires_confirmation: boolean;
  confirmed: boolean;
  action: AssistantAction;
  value: AssistantActionValue;
  safety_level: string;
  confirm_question: string;
  program_action: {
    ready_to_execute: boolean;
    command_name: string;
    paras: Record<string, unknown>;
  };
}

export interface AssistantAnswer {
  reply_text: string;
  intent: {
    type: string;
    confidence: number;
  };
  device_summary?: Record<string, unknown>;
  control: AssistantControl;
  suggested_buttons: unknown[];
  errors: string[];
  [key: string]: unknown;
}

export interface AssistantPendingAction {
  deviceId: string;
  action: 'Light' | 'CtlMode';
  value: 'ON' | 'OFF' | 'AUTO' | 'HUMAN' | 'VOICE';
  confirmQuestion: string;
}

export interface AssistantChatResult {
  replyText: string;
  assistant: AssistantAnswer;
  pendingAction: AssistantPendingAction | null;
}

