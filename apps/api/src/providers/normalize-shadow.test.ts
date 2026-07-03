import { describe, expect, it } from 'vitest';
import { normalizeShadow } from './normalize-shadow.js';

describe('normalizeShadow', () => {
  it('normalizes the current HarmonyOS property aliases', () => {
    const result = normalizeShadow(
      {
        shadow: [
          {
            service_id: 'smartRoom',
            reported: {
              properties: {
                Temp: '24.8',
                Humi: 55,
                Lumi: '420',
                Dist: 130,
                LampST: '1',
                CtlMode: 'MANUAL'
              },
              event_time: '2026-06-29T10:00:00.000Z'
            },
            desired: { properties: { threshold: 28 } },
            version: 4
          }
        ]
      },
      'device-01',
      'smartRoom',
      'ONLINE'
    );

    expect(result.reported).toMatchObject({
      temperature: 24.8,
      humidity: 55,
      luminance: 420,
      distance: 130,
      lamp: 'ON',
      mode: 'HUMAN'
    });
    expect(result.desired).toEqual({ threshold: 28 });
    expect(result.version).toBe(4);
  });

  it('normalizes the LampS field returned by the deployed IoTDA model', () => {
    const result = normalizeShadow(
      {
        shadow: [{
          service_id: 'smartRoom',
          reported: {
            properties: {
              Temp: '27.09',
              Humi: '60.06',
              Lumi: '72',
              Dist: '-1',
              LampS: 'OFF',
              CtlMode: 'AUTO'
            }
          }
        }]
      },
      'roomone',
      'smartRoom',
      'ONLINE'
    );

    expect(result.reported).toEqual({
      temperature: 27.09,
      humidity: 60.06,
      luminance: 72,
      distance: -1,
      battery: null,
      lamp: 'OFF',
      mode: 'AUTO'
    });
  });
});
