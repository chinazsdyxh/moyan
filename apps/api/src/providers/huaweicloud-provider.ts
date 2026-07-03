import type {
  DesiredUpdateRequest,
  DeviceCommandRequest,
  DeviceConnectionStatus,
  DeviceShadowSnapshot,
  DeviceSummary
} from '@moyan/contracts';
import { config, isHuaweiCloudConfigured } from '../config.js';
import { normalizeShadow } from './normalize-shadow.js';
import type { CommandProviderResult, DeviceProvider } from './provider.js';
import { ProviderError } from './provider.js';

type JsonRecord = Record<string, unknown>;

export class HuaweiCloudProvider implements DeviceProvider {
  private token = '';
  private tokenExpiresAt = 0;

  constructor() {
    if (!isHuaweiCloudConfigured()) {
      throw new ProviderError(
        'IOTDA_MODE=huaweicloud，但服务端环境变量尚未配置完整',
        503,
        'IOTDA_CONFIG_INCOMPLETE'
      );
    }
  }

  async listDevices(): Promise<DeviceSummary[]> {
    const result = await this.request<JsonRecord>('GET', '/devices?limit=50');
    const devices = Array.isArray(result.devices) ? result.devices : [];
    return devices.map((item) => this.mapDevice(this.asRecord(item)));
  }

  async getDevice(deviceId: string): Promise<DeviceSummary> {
    const result = await this.request<JsonRecord>('GET', `/devices/${encodeURIComponent(deviceId)}`);
    return this.mapDevice(result);
  }

  async getShadow(deviceId: string): Promise<DeviceShadowSnapshot> {
    const [device, raw] = await Promise.all([
      this.getDevice(deviceId),
      this.request<JsonRecord>('GET', `/devices/${encodeURIComponent(deviceId)}/shadow`)
    ]);
    return normalizeShadow(raw, deviceId, config.iotda.serviceId, device.status);
  }

  async updateDesired(deviceId: string, update: DesiredUpdateRequest): Promise<DeviceShadowSnapshot> {
    const serviceId = update.serviceId ?? config.iotda.serviceId;
    const shadow: JsonRecord = { service_id: serviceId, desired: update.desired };
    if (update.version !== undefined) shadow.version = update.version;
    await this.request('PUT', `/devices/${encodeURIComponent(deviceId)}/shadow`, { shadow: [shadow] });
    return this.getShadow(deviceId);
  }

  async sendCommand(deviceId: string, command: DeviceCommandRequest): Promise<CommandProviderResult> {
    const body = this.mapCommand(command);
    const result = await this.request<JsonRecord>(
      'POST',
      `/devices/${encodeURIComponent(deviceId)}/commands`,
      body
    );
    return {
      commandId: String(result.command_id ?? crypto.randomUUID()),
      response: result
    };
  }

  private mapCommand(command: DeviceCommandRequest): JsonRecord {
    if (command.type === 'LIGHT') {
      return {
        service_id: command.serviceId ?? config.iotda.serviceId,
        command_name: command.commandName ?? config.iotda.lightCommandName,
        paras: command.parameters ?? { light: command.value }
      };
    }
    if (command.type === 'MODE') {
      return {
        service_id: command.serviceId ?? config.iotda.serviceId,
        command_name: command.commandName ?? config.iotda.modeCommandName,
        paras: command.parameters ?? { ctlMode: command.value }
      };
    }
    if (!command.commandName || !command.parameters) {
      throw new ProviderError('自定义命令必须提供 commandName 和 parameters', 400, 'INVALID_COMMAND');
    }
    return {
      service_id: command.serviceId ?? config.iotda.serviceId,
      command_name: command.commandName,
      paras: command.parameters
    };
  }

  private async request<T = JsonRecord>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Auth-Token': token
    };
    if (config.iotda.instanceId) headers['Instance-Id'] = config.iotda.instanceId;

    const response = await fetch(
      `${config.iotda.endpoint}/v5/iot/${config.iotda.projectId}${path}`,
      { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }
    );

    if (response.status === 401 && retry) {
      this.token = '';
      this.tokenExpiresAt = 0;
      return this.request<T>(method, path, body, false);
    }

    const text = await response.text();
    const payload = text ? this.safeJson(text) : {};
    if (!response.ok) {
      const error = this.asRecord(payload);
      throw new ProviderError(
        String(error.error_msg ?? `IoTDA 请求失败 (${response.status})`),
        response.status,
        String(error.error_code ?? 'IOTDA_HTTP_ERROR'),
        payload
      );
    }
    return payload as T;
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) return this.token;
    const response = await fetch(`${config.iam.endpoint}/v3/auth/tokens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth: {
          identity: {
            methods: ['password'],
            password: {
              user: {
                name: config.iam.username,
                password: config.iam.password,
                domain: { name: config.iam.domain }
              }
            }
          },
          scope: { project: { name: config.iam.project } }
        }
      })
    });

    const payload = await response.text();
    if (!response.ok) {
      throw new ProviderError('获取 IAM Token 失败', response.status, 'IAM_AUTH_FAILED', this.safeJson(payload));
    }
    const token = response.headers.get('x-subject-token');
    if (!token) throw new ProviderError('IAM 响应缺少 X-Subject-Token', 502, 'IAM_TOKEN_MISSING');
    this.token = token;
    this.tokenExpiresAt = Date.now() + 23 * 60 * 60 * 1000;
    return token;
  }

  private mapDevice(device: JsonRecord): DeviceSummary {
    return {
      deviceId: String(device.device_id ?? ''),
      deviceName: String(device.device_name ?? device.device_id ?? '未命名设备'),
      nodeId: String(device.node_id ?? ''),
      productId: String(device.product_id ?? ''),
      status: this.mapStatus(device.status),
      lastActiveAt: typeof device.active_time === 'string' ? device.active_time : null
    };
  }

  private mapStatus(status: unknown): DeviceConnectionStatus {
    const value = String(status ?? '').toUpperCase();
    if (value === 'ONLINE' || value === 'OFFLINE') return value;
    return 'UNKNOWN';
  }

  private asRecord(value: unknown): JsonRecord {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
  }

  private safeJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return { raw: value };
    }
  }
}
