import type {
  ControlMode,
  DeviceConnectionStatus,
  DeviceShadowSnapshot,
  LampState,
  SmartRoomMetrics
} from '@moyan/contracts';

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {};
}

function firstValue(source: UnknownRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key];
  }
  return undefined;
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function toLamp(value: unknown): LampState {
  const normalized = String(value ?? '').toUpperCase();
  if (normalized === 'ON' || normalized === '1' || normalized === 'TRUE') return 'ON';
  if (normalized === 'OFF' || normalized === '0' || normalized === 'FALSE') return 'OFF';
  return 'UNKNOWN';
}

function toMode(value: unknown): ControlMode {
  const normalized = String(value ?? '').toUpperCase();
  if (normalized === 'AUTO' || normalized === 'HUMAN' || normalized === 'VOICE') return normalized;
  if (normalized === 'MANUAL') return 'HUMAN';
  return 'UNKNOWN';
}

function normalizeMetrics(properties: UnknownRecord): SmartRoomMetrics {
  return {
    temperature: toNumber(firstValue(properties, ['temperature', 'Temp', 'temp', 'Temperature'])),
    humidity: toNumber(firstValue(properties, ['humidity', 'Humi', 'humi', 'Humidity'])),
    luminance: toNumber(firstValue(properties, ['luminance', 'Lumi', 'lumi', 'illumination'])),
    distance: toNumber(firstValue(properties, ['distance', 'Dist', 'dist'])),
    battery: toNumber(firstValue(properties, ['battery', 'Battery', 'batteryLevel'])),
    lamp: toLamp(firstValue(properties, ['switch', 'LampS', 'LampST', 'LampSt', 'lampStatus', 'light'])),
    mode: toMode(firstValue(properties, ['mode', 'CtlMode', 'ctlMode', 'ctlmode']))
  };
}

export function normalizeShadow(
  raw: unknown,
  deviceId: string,
  serviceId: string,
  status: DeviceConnectionStatus = 'UNKNOWN'
): DeviceShadowSnapshot {
  const root = asRecord(raw);
  const shadow = Array.isArray(root.shadow) ? root.shadow.map(asRecord) : [];
  const service = shadow.find((item) => item.service_id === serviceId) ?? shadow[0] ?? {};
  const reportedBlock = asRecord(service.reported);
  const desiredBlock = asRecord(service.desired);
  const reportedProperties = asRecord(reportedBlock.properties ?? service.reported);
  const desiredProperties = asRecord(desiredBlock.properties ?? service.desired);
  const eventTime = reportedBlock.event_time;

  return {
    deviceId,
    serviceId: String(service.service_id ?? serviceId),
    observedAt: typeof eventTime === 'string' ? eventTime : new Date().toISOString(),
    status,
    reported: normalizeMetrics(reportedProperties),
    desired: desiredProperties,
    version: typeof service.version === 'number' ? service.version : null,
    raw
  };
}
