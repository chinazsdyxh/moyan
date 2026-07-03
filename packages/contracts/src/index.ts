export type ProviderMode = 'mock' | 'huaweicloud';

export type DeviceConnectionStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
export type LampState = 'ON' | 'OFF' | 'UNKNOWN';
export type ControlMode = 'AUTO' | 'HUMAN' | 'VOICE' | 'UNKNOWN';

export interface DeviceSummary {
  deviceId: string;
  deviceName: string;
  nodeId: string;
  productId: string;
  status: DeviceConnectionStatus;
  lastActiveAt: string | null;
}

export interface SmartRoomMetrics {
  temperature: number | null;
  humidity: number | null;
  luminance: number | null;
  distance: number | null;
  battery: number | null;
  lamp: LampState;
  mode: ControlMode;
}

export interface DeviceShadowSnapshot {
  deviceId: string;
  serviceId: string;
  observedAt: string;
  status: DeviceConnectionStatus;
  reported: SmartRoomMetrics;
  desired: Record<string, unknown>;
  version: number | null;
  raw: unknown;
}

export interface DesiredUpdateRequest {
  serviceId?: string;
  desired: Record<string, string | number | boolean | null>;
  version?: number;
}

export type DeviceCommandKind = 'LIGHT' | 'MODE' | 'CUSTOM';

export interface DeviceCommandRequest {
  type: DeviceCommandKind;
  value?: string | number | boolean;
  serviceId?: string;
  commandName?: string;
  parameters?: Record<string, unknown>;
}

export type CommandStatus = 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'TIMEOUT';

export interface DeviceCommandRecord {
  commandId: string;
  deviceId: string;
  type: DeviceCommandKind;
  serviceId: string;
  commandName: string;
  parameters: Record<string, unknown>;
  status: CommandStatus;
  providerResponse?: unknown;
  error?: string;
  createdAt: string;
  completedAt: string | null;
}

export type LogLevel = 'info' | 'warn' | 'error';

export interface DeviceLogEntry {
  id: string;
  deviceId: string;
  level: LogLevel;
  category: 'connection' | 'shadow' | 'command' | 'system';
  message: string;
  createdAt: string;
  context?: Record<string, unknown>;
}

export interface ApiMeta {
  requestId: string;
  provider: ProviderMode;
  timestamp: string;
}

export interface ApiResponse<T> {
  data: T;
  meta: ApiMeta;
}

export interface ApiProblem {
  status: number;
  code: string;
  title: string;
  detail: string;
  requestId: string;
}

export interface HealthStatus {
  status: 'ok' | 'degraded';
  provider: ProviderMode;
  configured: boolean;
  uptimeSeconds: number;
}

export interface RealtimeEvent<T = unknown> {
  id: string;
  type: 'shadow.updated' | 'command.updated' | 'device.status' | 'heartbeat';
  deviceId?: string;
  data: T;
  createdAt: string;
}
