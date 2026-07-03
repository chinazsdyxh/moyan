# 华为云IoT智能家居 — Hi3863

基于Hi3863（海思WS63）的智能家居控制系统，支持**语音、云端、传感器自动**三种控制模式，通过MQTT协议连接华为云IoT平台。

## 功能特性

- 🔌 **MQTT连接华为云** — 设备认证、属性上报、命令下发
- 🎤 **语音控制** — UART2连接智能公元(Unisound)语音板，10条语音指令
- ☁️ **云端控制** — 华为云IoTDA物模型，支持灯泡开关/亮度调节/模式切换
- 🌡️ **环境感知** — DHT11温湿度 + HC-SR04超声波 + 光敏ADC传感器
- 💡 **PWM调光** — 灯泡亮度0-100%无级调节
- 🖥️ **OLED显示** — I2C SSD1306，实时显示温湿度/距离/亮度
- 🔔 **蜂鸣器反馈** — 操作确认提示音

## 硬件引脚

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

## 三模式控制

| 模式 | 语音控灯 | 云端控灯 | 传感器自动控灯 |
|------|:--:|:--:|:--:|
| **AUTO** | ✗ | ✗ | ✓ (光敏>50开灯) |
| **HUMAN** | ✗ | ✓ | ✗ |
| **VOICE** | ✓ | ✓ | ✗ |

- 模式切换：语音 0x03-0x05 / 云端 CtlMode 命令，**所有模式均可切换**
- 语音板通过 `voice_notify_mode()` 实时播报当前模式

## 语音指令

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

## 目录结构

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

## 模块版权归属

| 模块 | 原始版权 | 许可证 |
|------|----------|--------|
| app_main, led, adc, hcsr04, pwm, dht11, oled | 沈阳市网联通信规划设计有限公司 (程国辉, 刘艳) | Apache 2.0（经许可） |
| voice, mqtt | 北京华清远见教育科技有限公司 | Apache 2.0 |
| wifi, bsp_oled | 海思半导体有限公司 | Apache 2.0 |
| oled_fonts | Alexey Dynda | MIT |

本项目经原作者许可发布，整体采用 Apache License 2.0。

## 开发环境

- **芯片**: Hi3863 (海思WS63)
- **SDK**: HiSilicon WS63 SDK
- **语音板**: 智能公元 Unisound (UART 115200 8N1)
- **云平台**: 华为云 IoTDA
- **编译器**: GCC (RISC-V)

## 致谢

- 基础框架：沈阳市网联通信规划设计有限公司 — 程国辉老师、刘艳老师
- 语音/云平台参考：北京华清远见教育科技有限公司
- OLED字库：Alexey Dynda (ssd1306 library)
