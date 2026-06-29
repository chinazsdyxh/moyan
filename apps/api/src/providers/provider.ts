import type {
  DesiredUpdateRequest,
  DeviceCommandRequest,
  DeviceShadowSnapshot,
  DeviceSummary
} from '@moyan/contracts';

export interface CommandProviderResult {
  commandId: string;
  response: unknown;
}

export interface DeviceProvider {
  listDevices(): Promise<DeviceSummary[]>;
  getDevice(deviceId: string): Promise<DeviceSummary>;
  getShadow(deviceId: string): Promise<DeviceShadowSnapshot>;
  updateDesired(deviceId: string, update: DesiredUpdateRequest): Promise<DeviceShadowSnapshot>;
  sendCommand(deviceId: string, command: DeviceCommandRequest): Promise<CommandProviderResult>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly statusCode = 502,
    readonly code = 'IOTDA_PROVIDER_ERROR',
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
