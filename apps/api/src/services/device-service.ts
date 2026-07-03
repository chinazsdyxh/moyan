import { randomUUID } from 'node:crypto';
import type {
  DesiredUpdateRequest,
  DeviceCommandRecord,
  DeviceCommandRequest,
  DeviceLogEntry,
  DeviceShadowSnapshot,
  DeviceSummary
} from '@moyan/contracts';
import { config } from '../config.js';
import type { DeviceProvider } from '../providers/provider.js';

export class DeviceService {
  private readonly commands = new Map<string, DeviceCommandRecord>();
  private readonly logs: DeviceLogEntry[] = [];

  constructor(private readonly provider: DeviceProvider) {}

  listDevices(): Promise<DeviceSummary[]> {
    return this.provider.listDevices();
  }

  getDevice(deviceId: string): Promise<DeviceSummary> {
    return this.provider.getDevice(deviceId);
  }

  async getShadow(deviceId: string): Promise<DeviceShadowSnapshot> {
    return this.provider.getShadow(deviceId);
  }

  async updateDesired(deviceId: string, update: DesiredUpdateRequest): Promise<DeviceShadowSnapshot> {
    const shadow = await this.provider.updateDesired(deviceId, update);
    this.addLog(deviceId, 'info', 'shadow', '期望属性已更新', { desired: update.desired });
    return shadow;
  }

  async sendCommand(deviceId: string, request: DeviceCommandRequest): Promise<DeviceCommandRecord> {
    const mapped = this.commandMetadata(request);
    const localId = randomUUID();
    const record: DeviceCommandRecord = {
      commandId: localId,
      deviceId,
      type: request.type,
      serviceId: mapped.serviceId,
      commandName: mapped.commandName,
      parameters: mapped.parameters,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      completedAt: null
    };
    this.commands.set(localId, record);
    this.addLog(deviceId, 'info', 'command', `正在下发 ${mapped.commandName}`, mapped.parameters);

    try {
      const result = await this.provider.sendCommand(deviceId, request);
      const completed: DeviceCommandRecord = {
        ...record,
        commandId: result.commandId,
        status: 'SUCCESSFUL',
        providerResponse: result.response,
        completedAt: new Date().toISOString()
      };
      this.commands.delete(localId);
      this.commands.set(completed.commandId, completed);
      this.addLog(deviceId, 'info', 'command', `${mapped.commandName} 执行成功`, {
        commandId: completed.commandId
      });
      return completed;
    } catch (error) {
      const failed = {
        ...record,
        status: 'FAILED' as const,
        error: error instanceof Error ? error.message : '未知错误',
        completedAt: new Date().toISOString()
      };
      this.commands.set(localId, failed);
      this.addLog(deviceId, 'error', 'command', `${mapped.commandName} 执行失败`, { error: failed.error });
      throw error;
    }
  }

  getCommand(commandId: string): DeviceCommandRecord | undefined {
    return this.commands.get(commandId);
  }

  getLogs(deviceId: string, limit = 40): DeviceLogEntry[] {
    return this.logs.filter((entry) => entry.deviceId === deviceId).slice(0, limit);
  }

  private commandMetadata(request: DeviceCommandRequest) {
    if (request.type === 'LIGHT') {
      return {
        serviceId: request.serviceId ?? config.iotda.serviceId,
        commandName: request.commandName ?? config.iotda.lightCommandName,
        parameters: request.parameters ?? { light: request.value }
      };
    }
    if (request.type === 'MODE') {
      return {
        serviceId: request.serviceId ?? config.iotda.serviceId,
        commandName: request.commandName ?? config.iotda.modeCommandName,
        parameters: request.parameters ?? { ctlMode: request.value }
      };
    }
    return {
      serviceId: request.serviceId ?? config.iotda.serviceId,
      commandName: request.commandName ?? 'CUSTOM',
      parameters: request.parameters ?? {}
    };
  }

  private addLog(
    deviceId: string,
    level: DeviceLogEntry['level'],
    category: DeviceLogEntry['category'],
    message: string,
    context?: Record<string, unknown>
  ): void {
    this.logs.unshift({ id: randomUUID(), deviceId, level, category, message, createdAt: new Date().toISOString(), context });
    if (this.logs.length > 200) this.logs.length = 200;
  }
}
