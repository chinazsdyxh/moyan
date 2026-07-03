export interface CloudConfig {
  authUrl: string;
  iamUserName: string;
  iamPassword: string;
  iamDomainName: string;
  projectName: string;
  iotdaAppEndpoint: string;
  projectId: string;
  deviceId: string;
  assistantApiBaseUrl: string;
  serviceId: string;
  lightCommandName: string;
  modeCommandName: string;
  fanCommandName: string;
}

export const cloudConfig: CloudConfig = {
  authUrl: 'https://iam.cn-north-4.myhuaweicloud.com/v3/auth/tokens',
  iamUserName: 'dust6600',
  iamPassword: 'z123456789',
  iamDomainName: 'dust6699',
  projectName: 'cn-north-4',
  iotdaAppEndpoint: 'https://f89d6f04a4.st1.iotda-app.cn-north-4.myhuaweicloud.com:443',
  projectId: '1af62592905f4c729efe3050786c31fb',
  deviceId: '6a3a6e13cbb0cf6bb96829d9_roomone',
  assistantApiBaseUrl: 'http://172.22.41.63:3001/api/v1',
  serviceId: 'smartRoom',
  lightCommandName: 'Light',
  modeCommandName: 'CtlMode',
  fanCommandName: ''
};

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function buildAuthRequestBody(): string {
  return `{
    "auth": {
      "identity": {
        "methods": [
          "password"
        ],
        "password": {
          "user": {
            "name": "${cloudConfig.iamUserName}",
            "password": "${cloudConfig.iamPassword}",
            "domain": {
              "name": "${cloudConfig.iamDomainName}"
            }
          }
        }
      },
      "scope": {
        "project": {
          "name": "${cloudConfig.projectName}"
        }
      }
    }
  }`;
}

export function buildDeviceShadowUrl(): string {
  const endpoint = trimTrailingSlash(cloudConfig.iotdaAppEndpoint);
  return `${endpoint}/v5/iot/${cloudConfig.projectId}/devices/${cloudConfig.deviceId}/shadow`;
}

export function buildCommandUrl(): string {
  const endpoint = trimTrailingSlash(cloudConfig.iotdaAppEndpoint);
  return `${endpoint}/v5/iot/${cloudConfig.projectId}/devices/${cloudConfig.deviceId}/commands`;
}

export function buildAssistantChatUrl(): string {
  const endpoint = trimTrailingSlash(cloudConfig.assistantApiBaseUrl);
  return `${endpoint}/assistant/chat`;
}

export function buildAssistantConfirmUrl(): string {
  const endpoint = trimTrailingSlash(cloudConfig.assistantApiBaseUrl);
  return `${endpoint}/assistant/confirm`;
}

export function isAssistantCloudConfigComplete(): boolean {
  return !!(
    cloudConfig.assistantApiBaseUrl &&
    cloudConfig.deviceId
  );
}

export function isDisplayCloudConfigComplete(): boolean {
  return !!(
    cloudConfig.authUrl &&
    cloudConfig.iamUserName &&
    cloudConfig.iamPassword &&
    cloudConfig.iamDomainName &&
    cloudConfig.projectName &&
    cloudConfig.iotdaAppEndpoint &&
    cloudConfig.projectId &&
    cloudConfig.deviceId
  );
}

export function isLightCommandCloudConfigComplete(): boolean {
  return !!(
    isDisplayCloudConfigComplete() &&
    cloudConfig.serviceId &&
    cloudConfig.lightCommandName
  );
}

export function isFanCommandCloudConfigComplete(): boolean {
  return !!(
    isDisplayCloudConfigComplete() &&
    cloudConfig.serviceId &&
    cloudConfig.fanCommandName
  );
}

export function isModeCommandCloudConfigComplete(): boolean {
  return !!(
    isDisplayCloudConfigComplete() &&
    cloudConfig.serviceId &&
    cloudConfig.modeCommandName
  );
}

export function pickFirstPropertyValue(
  first?: string | number | boolean,
  second?: string | number | boolean,
  third?: string | number | boolean,
  fourth?: string | number | boolean,
  fifth?: string | number | boolean
): string {
  if (first !== undefined && first !== null) {
    return String(first);
  }
  if (second !== undefined && second !== null) {
    return String(second);
  }
  if (third !== undefined && third !== null) {
    return String(third);
  }
  if (fourth !== undefined && fourth !== null) {
    return String(fourth);
  }
  if (fifth !== undefined && fifth !== null) {
    return String(fifth);
  }
  return '--';
}

function extractJsonValue(source: string, key: string): string {
  const marker = '"' + key + '"';
  const keyIndex = source.indexOf(marker);
  if (keyIndex < 0) {
    return '--';
  }

  const colonIndex = source.indexOf(':', keyIndex + marker.length);
  if (colonIndex < 0) {
    return '--';
  }

  let valueStart = colonIndex + 1;
  while (valueStart < source.length && source.charAt(valueStart) === ' ') {
    valueStart++;
  }

  if (valueStart < source.length && source.charAt(valueStart) === '"') {
    valueStart++;
  }

  let valueEnd = valueStart;
  while (valueEnd < source.length) {
    const current = source.charAt(valueEnd);
    if (current === '"' || current === ',' || current === '}' || current === ']') {
      break;
    }
    valueEnd++;
  }

  if (valueEnd > valueStart) {
    return source.slice(valueStart, valueEnd);
  }
  return '--';
}

export function pickFirstJsonValue(
  source: string,
  first: string,
  second: string,
  third: string,
  fourth: string,
  fifth: string
): string {
  let value = extractJsonValue(source, first);
  if (value !== '--') {
    return value;
  }
  value = extractJsonValue(source, second);
  if (value !== '--') {
    return value;
  }
  value = extractJsonValue(source, third);
  if (value !== '--') {
    return value;
  }
  value = extractJsonValue(source, fourth);
  if (value !== '--') {
    return value;
  }
  value = extractJsonValue(source, fifth);
  if (value !== '--') {
    return value;
  }
  return '--';
}
