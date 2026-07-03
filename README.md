# MOYAN 智慧空间

本仓库包含智慧房间的完整解决方案：嵌入式 Hi3863 智能家居固件、Web 控制台和 IoTDA 服务端代理。

---

## 一、嵌入式智能家居固件 (`21_huaweiiot/`)

基于 **Hi3863（海思WS63）** 的智能家居控制系统，支持**语音、云端、传感器自动**三种控制模式，通过 MQTT 协议连接华为云 IoTDA。

### 功能特性

- 🔌 **MQTT连接华为云** — 设备认证、属性上报、命令下发
- 🎤 **语音控制** — UART2连接智能公元(Unisound)语音板，10条语音指令
- ☁️ **云端控制** — 华为云IoTDA物模型，支持灯泡开关/亮度调节/模式切换
- 🌡️ **环境感知** — DHT11温湿度 + HC-SR04超声波 + 光敏ADC传感器
- 💡 **PWM调光** — 灯泡亮度0-100%无级调节
- 🖥️ **OLED显示** — I2C SSD1306，实时显示温湿度/距离/亮度
- 🔔 **蜂鸣器反馈** — 操作确认提示音

### 硬件引脚

| GPIO | 设备 | 说明 |
|------|------|------|
| GPIO_01 | 灯泡 LED | HIGH=亮，PWM调光 |
| GPIO_03 | 蜂鸣器 | HIGH=响 |
| GPIO_04 | DHT11 数据 | 温湿度传感器 |
| GPIO_06 | HC-SR04 TRIG | 超声波触发 |
| GPIO_07 | UART2 RX | 语音板接收 |
| GPIO_08 | UART2 TX | 语音板发送 |
| GPIO_09 | HC-SR04 ECHO | 超声波回声 |
| GPIO_15/16 | I2C OLED | SSD1306显示屏 |

### 三模式控制

| 模式 | 语音控灯 | 云端控灯 | 传感器自动控灯 |
|------|:--:|:--:|:--:|
| **AUTO** | ✗ | ✗ | ✓ (光敏>50开灯) |
| **HUMAN** | ✗ | ✓ | ✗ |
| **VOICE** | ✓ | ✓ | ✗ |

### 语音指令

| 指令码 | 功能 | 模式限制 |
|--------|------|----------|
| 0x01 | 开灯 | VOICE |
| 0x02 | 关灯 | VOICE |
| 0x03 | 切换AUTO模式 | - |
| 0x04 | 切换HUMAN模式 | - |
| 0x05 | 切换VOICE模式 | - |
| 0x06 | 调亮(+20%) | VOICE |
| 0x07 | 调暗(-20%) | VOICE |
| 0x0A | 查询温度 | - |
| 0x0B | 查询湿度 | - |
| 0x0C | 查询距离 | - |

### 目录结构

```
21_huaweiiot/
├── app_main.c          # 主入口，三模式自动控灯 + UART语音任务
├── app_main.h          # WiFi/MQTT/设备认证配置
├── CMakeLists.txt
├── Kconfig
├── led/                # LED灯泡 + 蜂鸣器驱动
├── voice/              # UART2语音接收 + 指令解析
├── wifi/               # WiFi STA连接
├── mqtt/               # MQTT华为云连接 + 命令解析
├── dht11/              # DHT11温湿度传感器
├── hcsr04/             # HC-SR04超声波测距
├── adc/                # 光敏传感器ADC
├── pwm/                # PWM灯泡亮度控制
└── oled/               # SSD1306 OLED显示
```

### 模块版权归属

| 模块 | 原始版权 | 许可证 |
|------|----------|--------|
| app_main, led, adc, hcsr04, pwm, dht11, oled | 沈阳市网联通信规划设计有限公司 (程国辉, 刘艳) | Apache 2.0（经许可） |
| voice, mqtt | 北京华清远见教育科技有限公司 | Apache 2.0 |
| wifi, bsp_oled | 海思半导体有限公司 | Apache 2.0 |
| oled_fonts | Alexey Dynda | MIT |

### 开发环境

- **芯片**: Hi3863 (海思WS63)
- **SDK**: HiSilicon WS63 SDK
- **语音板**: 智能公元 Unisound (UART 115200 8N1)
- **云平台**: 华为云 IoTDA
- **编译器**: GCC (RISC-V)

---

## 二、Web 控制台与 API 服务端

### 工程结构

- `apps/web`：React、TypeScript、Vite、Ant Design、ECharts、Three.js 数字房间。
- `apps/api`：Fastify API、华为云 IoTDA 适配器、Mock 适配器、SSE 实时事件。
- `packages/contracts`：前后端共享类型。
- `docs/IOTDA_SETUP.md`：华为云产品、设备和服务端配置清单。

### 本地启动

要求 Node.js 20.19 或更高版本。

```powershell
npm install
npm run dev
```

- Web：`http://localhost:5173`
- API：`http://localhost:3001/api/v1/health`
- 默认使用 Mock 设备，无需云凭据。

### 连接真实 IoTDA

1. 将 `apps/api/.env.example` 复制为 `apps/api/.env`。
2. 从 IoTDA 控制台"总览 > 接入信息"取得应用侧 HTTPS Endpoint、实例 ID。
3. 从"我的凭证"取得当前区域的 Project ID。
4. 在服务端 `.env` 配置 IAM 用户信息，设置 `IOTDA_MODE=huaweicloud`。
5. 重启 API。浏览器不会接触 IAM 密码或 IoTDA Token。

详细步骤见 [IoTDA 配置指南](docs/IOTDA_SETUP.md)。

### 验证

```powershell
npm run typecheck
npm test
npm run build
```

### API 列表

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

## 致谢

- 嵌入式基础框架：沈阳市网联通信规划设计有限公司 — 程国辉老师、刘艳老师
- 语音/云平台参考：北京华清远见教育科技有限公司
- OLED字库：Alexey Dynda (ssd1306 library)
