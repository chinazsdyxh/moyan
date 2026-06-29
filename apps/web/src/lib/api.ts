import type {
  ApiProblem,
  ApiResponse,
  DesiredUpdateRequest,
  DeviceCommandRecord,
  DeviceCommandRequest,
  DeviceLogEntry,
  DeviceShadowSnapshot,
  DeviceSummary,
  HealthStatus
} from '@moyan/contracts';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers }
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => ({
      status: response.status,
      code: 'HTTP_ERROR',
      title: '请求失败',
      detail: response.statusText,
      requestId: 'unknown'
    }))) as ApiProblem;
    throw new Error(problem.detail || problem.title);
  }
  return response.json() as Promise<ApiResponse<T>>;
}

export const api = {
  health: () => request<HealthStatus>('/health'),
  devices: () => request<DeviceSummary[]>('/devices'),
  device: (deviceId: string) => request<DeviceSummary>(`/devices/${encodeURIComponent(deviceId)}`),
  shadow: (deviceId: string) => request<DeviceShadowSnapshot>(`/devices/${encodeURIComponent(deviceId)}/shadow`),
  updateDesired: (deviceId: string, update: DesiredUpdateRequest) =>
    request<DeviceShadowSnapshot>(`/devices/${encodeURIComponent(deviceId)}/shadow/desired`, {
      method: 'PUT',
      body: JSON.stringify(update)
    }),
  command: (deviceId: string, command: DeviceCommandRequest) =>
    request<DeviceCommandRecord>(`/devices/${encodeURIComponent(deviceId)}/commands`, {
      method: 'POST',
      body: JSON.stringify(command)
    }),
  logs: (deviceId: string) => request<DeviceLogEntry[]>(`/devices/${encodeURIComponent(deviceId)}/logs?limit=30`),
  eventsUrl: (deviceId: string) => `${API_BASE}/events?deviceId=${encodeURIComponent(deviceId)}`
};
