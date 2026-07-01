import 'dotenv/config';
import { z } from 'zod';

const configSchema = z.object({
  IOTDA_MODE: z.enum(['mock', 'huaweicloud']).default('mock'),
  PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  IOTDA_ENDPOINT: z.string().url().optional(),
  IOTDA_PROJECT_ID: z.string().optional(),
  IOTDA_INSTANCE_ID: z.string().optional(),
  IOTDA_SERVICE_ID: z.string().default('smartRoom'),
  IOTDA_LIGHT_COMMAND_NAME: z.string().default('Light'),
  IOTDA_MODE_COMMAND_NAME: z.string().default('CtlMode'),
  DIFY_API_BASE: z.string().url().default('https://api.dify.ai/v1'),
  DIFY_API_KEY: z.string().optional(),
  DIFY_APP_USER_PREFIX: z.string().default('moyan_user'),
  HUAWEICLOUD_IAM_ENDPOINT: z.string().url().default('https://iam.cn-north-4.myhuaweicloud.com'),
  HUAWEICLOUD_IAM_USERNAME: z.string().optional(),
  HUAWEICLOUD_IAM_PASSWORD: z.string().optional(),
  HUAWEICLOUD_IAM_DOMAIN: z.string().optional(),
  HUAWEICLOUD_IAM_PROJECT: z.string().default('cn-north-4')
});

const parsed = configSchema.parse(process.env);

export const config = {
  mode: parsed.IOTDA_MODE,
  port: parsed.PORT,
  webOrigin: parsed.WEB_ORIGIN,
  iotda: {
    endpoint: parsed.IOTDA_ENDPOINT?.replace(/\/$/, ''),
    projectId: parsed.IOTDA_PROJECT_ID,
    instanceId: parsed.IOTDA_INSTANCE_ID,
    serviceId: parsed.IOTDA_SERVICE_ID,
    lightCommandName: parsed.IOTDA_LIGHT_COMMAND_NAME,
    modeCommandName: parsed.IOTDA_MODE_COMMAND_NAME
  },
  dify: {
    apiBase: parsed.DIFY_API_BASE.replace(/\/$/, ''),
    apiKey: parsed.DIFY_API_KEY,
    appUserPrefix: parsed.DIFY_APP_USER_PREFIX
  },
  iam: {
    endpoint: parsed.HUAWEICLOUD_IAM_ENDPOINT.replace(/\/$/, ''),
    username: parsed.HUAWEICLOUD_IAM_USERNAME,
    password: parsed.HUAWEICLOUD_IAM_PASSWORD,
    domain: parsed.HUAWEICLOUD_IAM_DOMAIN,
    project: parsed.HUAWEICLOUD_IAM_PROJECT
  }
} as const;

export function isHuaweiCloudConfigured(): boolean {
  return Boolean(
    config.iotda.endpoint &&
      config.iotda.projectId &&
      config.iam.username &&
      config.iam.password &&
      config.iam.domain
  );
}
