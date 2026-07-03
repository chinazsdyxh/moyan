import type {
  DesiredUpdateRequest,
  DeviceCommandRequest,
  DeviceShadowSnapshot,
  DeviceSummary
} from '@moyan/contracts';
import { describe, expect, it } from 'vitest';
import type { CommandProviderResult, DeviceProvider } from '../providers/provider.js';
import { DeviceService } from './device-service.js';

const device: DeviceSummary = {
  deviceId: 'device-1',
  deviceName: 'Test device',
  nodeId: 'node-1',
  productId: 'product-1',
  status: 'ONLINE',
  lastActiveAt: null
};

function shadowFor(deviceId = device.deviceId): DeviceShadowSnapshot {
  return {
    deviceId,
    serviceId: 'smartRoom',
    observedAt: '2026-07-02T00:00:00.000Z',
    status: 'ONLINE',
    reported: {
      temperature: 25,
      humidity: 60,
      luminance: 300,
      distance: 100,
      battery: 80,
      lamp: 'ON',
      mode: 'AUTO'
    },
    desired: {},
    version: 1,
    raw: {}
  };
}

class SuccessfulProvider implements DeviceProvider {
  async listDevices(): Promise<DeviceSummary[]> {
    return [device];
  }

  async getDevice(): Promise<DeviceSummary> {
    return device;
  }

  async getShadow(): Promise<DeviceShadowSnapshot> {
    return shadowFor();
  }

  async updateDesired(deviceId: string, update: DesiredUpdateRequest): Promise<DeviceShadowSnapshot> {
    return { ...shadowFor(deviceId), desired: update.desired, version: 2 };
  }

  async sendCommand(_deviceId: string, _command: DeviceCommandRequest): Promise<CommandProviderResult> {
    return { commandId: 'provider-command-1', response: { ok: true } };
  }
}

class FailingProvider extends SuccessfulProvider {
  async sendCommand(): Promise<CommandProviderResult> {
    throw new Error('provider unavailable');
  }
}

describe('DeviceService', () => {
  it('maps light commands to IoTDA metadata and stores the completed record', async () => {
    const service = new DeviceService(new SuccessfulProvider());

    const record = await service.sendCommand('device-1', { type: 'LIGHT', value: 'OFF' });

    expect(record).toMatchObject({
      commandId: 'provider-command-1',
      deviceId: 'device-1',
      type: 'LIGHT',
      serviceId: 'smartRoom',
      commandName: 'Light',
      parameters: { light: 'OFF' },
      status: 'SUCCESSFUL',
      providerResponse: { ok: true }
    });
    expect(record.completedAt).toEqual(expect.any(String));
    expect(service.getCommand('provider-command-1')).toEqual(record);
  });

  it('records failed commands and exposes the failure log', async () => {
    const service = new DeviceService(new FailingProvider());

    await expect(service.sendCommand('device-1', { type: 'CUSTOM', commandName: 'Reset', parameters: {} })).rejects.toThrow(
      'provider unavailable'
    );

    const logs = service.getLogs('device-1');
    expect(logs[0]).toMatchObject({
      level: 'error',
      category: 'command',
      context: { error: 'provider unavailable' }
    });
  });

  it('keeps only the most recent 200 logs', async () => {
    const service = new DeviceService(new SuccessfulProvider());

    for (let index = 0; index < 205; index += 1) {
      await service.updateDesired('device-1', { desired: { threshold: index } });
    }

    expect(service.getLogs('device-1', 250)).toHaveLength(200);
    expect(service.getLogs('device-1', 1)[0]?.context).toEqual({ desired: { threshold: 204 } });
  });
});
