import { randomUUID } from 'node:crypto';
import type {
  ControlMode,
  DesiredUpdateRequest,
  DeviceCommandRequest,
  DeviceShadowSnapshot,
  DeviceSummary,
  LampState
} from '@moyan/contracts';
import type { CommandProviderResult, DeviceProvider } from './provider.js';
import { ProviderError } from './provider.js';

export class MockDeviceProvider implements DeviceProvider {
  private readonly device: DeviceSummary = {
    deviceId: 'smart-room-demo-01',
    deviceName: '智慧空间 · 展示间 A01',
    nodeId: 'demo-a01',
    productId: 'smart-room-product',
    status: 'ONLINE',
    lastActiveAt: new Date().toISOString()
  };

  private lamp: LampState = 'ON';
  private mode: ControlMode = 'AUTO';
  private desired: Record<string, unknown> = {};
  private version = 1;

  async listDevices(): Promise<DeviceSummary[]> {
    return [{ ...this.device, lastActiveAt: new Date().toISOString() }];
  }

  async getDevice(deviceId: string): Promise<DeviceSummary> {
    this.assertDevice(deviceId);
    return { ...this.device, lastActiveAt: new Date().toISOString() };
  }

  async getShadow(deviceId: string): Promise<DeviceShadowSnapshot> {
    this.assertDevice(deviceId);
    const wave = Date.now() / 35_000;
    const reported = {
      temperature: Number((24.6 + Math.sin(wave) * 1.9).toFixed(1)),
      humidity: Number((54 + Math.cos(wave * 0.7) * 7).toFixed(1)),
      luminance: Math.round(420 + Math.sin(wave * 1.3) * 180),
      distance: Math.round(128 + Math.cos(wave * 1.6) * 22),
      battery: 86,
      lamp: this.lamp,
      mode: this.mode
    } as const;

    return {
      deviceId,
      serviceId: 'smartRoom',
      observedAt: new Date().toISOString(),
      status: 'ONLINE',
      reported,
      desired: { ...this.desired },
      version: this.version,
      raw: {
        shadow: [
          {
            service_id: 'smartRoom',
            reported: { properties: reported, event_time: new Date().toISOString() },
            desired: { properties: this.desired },
            version: this.version
          }
        ]
      }
    };
  }

  async updateDesired(deviceId: string, update: DesiredUpdateRequest): Promise<DeviceShadowSnapshot> {
    this.assertDevice(deviceId);
    this.desired = { ...this.desired, ...update.desired };
    if (typeof update.desired.switch === 'string') this.lamp = this.normalizeLamp(update.desired.switch);
    if (typeof update.desired.LampST === 'string') this.lamp = this.normalizeLamp(update.desired.LampST);
    if (typeof update.desired.mode === 'string') this.mode = this.normalizeMode(update.desired.mode);
    if (typeof update.desired.CtlMode === 'string') this.mode = this.normalizeMode(update.desired.CtlMode);
    this.version += 1;
    return this.getShadow(deviceId);
  }

  async sendCommand(deviceId: string, command: DeviceCommandRequest): Promise<CommandProviderResult> {
    this.assertDevice(deviceId);
    if (command.type === 'LIGHT') this.lamp = this.normalizeLamp(command.value);
    if (command.type === 'MODE') this.mode = this.normalizeMode(command.value);

    return {
      commandId: randomUUID(),
      response: {
        result_code: 0,
        response_name: 'COMMAND_RESPONSE',
        paras: { result: 'success' }
      }
    };
  }

  private assertDevice(deviceId: string): void {
    if (deviceId !== this.device.deviceId) throw new ProviderError('设备不存在', 404, 'DEVICE_NOT_FOUND');
  }

  private normalizeLamp(value: unknown): LampState {
    return String(value).toUpperCase() === 'ON' ? 'ON' : 'OFF';
  }

  private normalizeMode(value: unknown): ControlMode {
    const mode = String(value).toUpperCase();
    return mode === 'AUTO' || mode === 'HUMAN' || mode === 'VOICE' ? mode : 'UNKNOWN';
  }
}
