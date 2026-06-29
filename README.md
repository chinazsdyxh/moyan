# MOYAN 智慧空间

本仓库包含原有 HarmonyOS 智慧房间应用，以及新增的 Web 控制台和 IoTDA 服务端代理。

## 新增工程

- `apps/web`：React、TypeScript、Vite、Ant Design、ECharts、Three.js 数字房间。
- `apps/api`：Fastify API、华为云 IoTDA 适配器、Mock 适配器、SSE 实时事件。
- `packages/contracts`：前后端共享类型。
- `docs/IOTDA_SETUP.md`：华为云产品、设备和服务端配置清单。

## 本地启动

要求 Node.js 20.19 或更高版本。

```powershell
npm install
npm run dev
```

- Web：`http://localhost:5173`
- API：`http://localhost:3001/api/v1/health`
- 默认使用 Mock 设备，无需云凭据。

## 连接真实 IoTDA

1. 将 `apps/api/.env.example` 复制为 `apps/api/.env`。
2. 从 IoTDA 控制台“总览 > 接入信息”取得应用侧 HTTPS Endpoint、实例 ID。
3. 从“我的凭证”取得当前区域的 Project ID。
4. 在服务端 `.env` 配置 IAM 用户信息，设置 `IOTDA_MODE=huaweicloud`。
5. 重启 API。浏览器不会接触 IAM 密码或 IoTDA Token。

详细步骤见 [IoTDA 配置指南](docs/IOTDA_SETUP.md)。

## 验证

```powershell
npm run typecheck
npm test
npm run build
```

当前 API：

- `GET /api/v1/devices`
- `GET /api/v1/devices/:deviceId`
- `GET /api/v1/devices/:deviceId/shadow`
- `PUT /api/v1/devices/:deviceId/shadow/desired`
- `POST /api/v1/devices/:deviceId/commands`
- `GET /api/v1/devices/:deviceId/commands/:commandId`
- `GET /api/v1/devices/:deviceId/logs`
- `GET /api/v1/events?deviceId=...`

## 安全约束

- 禁止将 AK/SK、IAM 密码、设备密钥、Token 或真实 `.env` 提交到 Git。
- Web 端只能访问本项目 API，不允许直连 IAM/IoTDA 管理接口。
- 当前仓库原有 `CloudConfig.ets` 和 `build-profile.json5` 含敏感配置，接入真实环境前应轮换凭据并清理历史。
