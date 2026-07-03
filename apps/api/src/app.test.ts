import { describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { MockDeviceProvider } from './providers/mock-provider.js';
import { DeviceService } from './services/device-service.js';

describe('api app routes', () => {
  it('wraps health responses in the shared API envelope', async () => {
    const app = await buildApp({ logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });
    await app.close();

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.status).toMatch(/^(ok|degraded)$/);
    expect(['mock', 'huaweicloud']).toContain(body.data.provider);
    expect(typeof body.data.configured).toBe('boolean');
    expect(body.meta.requestId).toEqual(expect.any(String));
    expect(body.meta.timestamp).toEqual(expect.any(String));
  });

  it('rejects incomplete non-custom device commands', async () => {
    const app = await buildApp({ logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/smart-room-demo-01/commands',
      payload: { type: 'LIGHT' }
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.requestId).toEqual(expect.any(String));
  });

  it('serves device list, detail, shadow, and desired updates', async () => {
    const app = await buildApp({
      devices: new DeviceService(new MockDeviceProvider()),
      logger: false
    });

    const listResponse = await app.inject({ method: 'GET', url: '/api/v1/devices' });
    const detailResponse = await app.inject({ method: 'GET', url: '/api/v1/devices/smart-room-demo-01' });
    const shadowResponse = await app.inject({ method: 'GET', url: '/api/v1/devices/smart-room-demo-01/shadow' });
    const desiredResponse = await app.inject({
      method: 'PUT',
      url: '/api/v1/devices/smart-room-demo-01/shadow/desired',
      payload: { desired: { CtlMode: 'VOICE', threshold: 31 } }
    });
    await app.close();

    expect(listResponse.statusCode).toBe(200);
    expect(listResponse.json().data[0].deviceId).toBe('smart-room-demo-01');
    expect(detailResponse.statusCode).toBe(200);
    expect(detailResponse.json().data.deviceId).toBe('smart-room-demo-01');
    expect(shadowResponse.statusCode).toBe(200);
    expect(shadowResponse.json().data.reported).toMatchObject({ lamp: 'ON' });
    expect(desiredResponse.statusCode).toBe(200);
    expect(desiredResponse.json().data.desired).toMatchObject({ CtlMode: 'VOICE', threshold: 31 });
  });

  it('returns a problem document for unknown routes', async () => {
    const app = await buildApp({ logger: false });

    const response = await app.inject({ method: 'GET', url: '/api/v1/missing' });
    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.json()).toMatchObject({ status: 404, code: 'ROUTE_NOT_FOUND' });
  });

  it('returns stored command records only for the matching device', async () => {
    const app = await buildApp({
      devices: new DeviceService(new MockDeviceProvider()),
      logger: false
    });

    const commandResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/devices/smart-room-demo-01/commands',
      payload: { type: 'MODE', value: 'VOICE' }
    });
    const commandId = commandResponse.json().data.commandId as string;

    const sameDeviceResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/devices/smart-room-demo-01/commands/${commandId}`
    });
    const otherDeviceResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/devices/other-device/commands/${commandId}`
    });
    await app.close();

    expect(sameDeviceResponse.statusCode).toBe(200);
    expect(sameDeviceResponse.json().data).toMatchObject({
      commandId,
      deviceId: 'smart-room-demo-01',
      type: 'MODE',
      status: 'SUCCESSFUL'
    });
    expect(otherDeviceResponse.statusCode).toBe(404);
    expect(otherDeviceResponse.json().code).toBe('COMMAND_NOT_FOUND');
  });

  it('applies the requested log limit from query parameters', async () => {
    const devices = new DeviceService(new MockDeviceProvider());
    const app = await buildApp({ devices, logger: false });

    await app.inject({
      method: 'POST',
      url: '/api/v1/devices/smart-room-demo-01/commands',
      payload: { type: 'LIGHT', value: 'OFF' }
    });
    await app.inject({
      method: 'POST',
      url: '/api/v1/devices/smart-room-demo-01/commands',
      payload: { type: 'LIGHT', value: 'ON' }
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/devices/smart-room-demo-01/logs?limit=1'
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toHaveLength(1);
  });

  it('confirms control-mode actions as mode commands', async () => {
    const devices = new DeviceService(new MockDeviceProvider());
    const app = await buildApp({ devices, dify: { apiKey: 'test-key' }, logger: false });

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/assistant/confirm',
      payload: {
        deviceId: 'smart-room-demo-01',
        action: 'CtlMode',
        value: 'HUMAN'
      }
    });
    const shadow = await devices.getShadow('smart-room-demo-01');
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().command.type).toBe('MODE');
    expect(shadow.reported.mode).toBe('HUMAN');
  });
});
