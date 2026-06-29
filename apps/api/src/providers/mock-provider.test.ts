import { describe, expect, it } from 'vitest';
import { MockDeviceProvider } from './mock-provider.js';

describe('MockDeviceProvider', () => {
  it('applies light and mode commands to the next shadow', async () => {
    const provider = new MockDeviceProvider();
    const [device] = await provider.listDevices();
    expect(device).toBeDefined();

    await provider.sendCommand(device!.deviceId, { type: 'LIGHT', value: 'OFF' });
    await provider.sendCommand(device!.deviceId, { type: 'MODE', value: 'VOICE' });
    const shadow = await provider.getShadow(device!.deviceId);

    expect(shadow.reported.lamp).toBe('OFF');
    expect(shadow.reported.mode).toBe('VOICE');
  });

  it('persists desired properties in mock mode', async () => {
    const provider = new MockDeviceProvider();
    const [device] = await provider.listDevices();
    const shadow = await provider.updateDesired(device!.deviceId, { desired: { threshold: 29 } });
    expect(shadow.desired.threshold).toBe(29);
    expect(shadow.version).toBe(2);
  });
});
