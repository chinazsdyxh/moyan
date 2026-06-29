# 华为云 IoTDA 接入与 Web 联调准备

本文对应当前项目的 `smartRoom` 设备模型和 Web/API 实现。控制台名称可能随实例版本变化，以当前实例页面为准。

## 1. 必须从华为云取得的参数

| 参数 | 获取位置 | 是否敏感 | 服务端变量 |
|---|---|---:|---|
| Region ID | 控制台顶部区域，例如北京四 `cn-north-4` | 否 | 体现在 Endpoint/IAM Project |
| Project ID | 我的凭证 > API 凭证 | 一般 | `IOTDA_PROJECT_ID` |
| Instance ID | IoTDA 总览/实例详情 | 一般 | `IOTDA_INSTANCE_ID` |
| 应用侧 HTTPS Endpoint | IoTDA 总览 > 接入信息 | 否 | `IOTDA_ENDPOINT` |
| 设备侧 MQTT(S) Endpoint | IoTDA 总览 > 接入信息 | 否 | 供设备端使用 |
| IAM 用户名/密码/Domain | IAM 用户与账号信息 | 是 | `HUAWEICLOUD_IAM_*` |
| Product ID | 产品详情 | 否 | 设备管理/诊断使用 |
| Device ID | 设备详情 | 一般 | 设备端 Username/Topic 使用 |
| Device Secret | 注册设备时生成或指定 | 是 | 只保存在设备安全存储中 |

官方入口：

- [实例购买与区域说明](https://support.huaweicloud.com/usermanual-Iothub/iot_01_0078.html)
- [实例管理与切换](https://support.huaweicloud.com/usermanual-iothub/iot_01_0079.html)
- [平台接入信息与证书资源](https://support.huaweicloud.com/usermanual-Iothub/iot_01_01271.html)
- [IAM 用户授权 IoTDA](https://support.huaweicloud.com/usermanual-iothub/iot_01_0231.html)
- [应用侧 API Token/AK-SK 认证](https://support.huaweicloud.com/intl/zh-cn/api-iothub/iot_06_v5_0091.html)

## 2. 推荐产品与模型

控制台操作：进入实例后选择“产品 > 创建产品”。

- 产品名称：`SmartRoomDevice`
- 协议：MQTT
- 数据格式：JSON
- 设备类型：`SmartRoom`
- 服务 ID：为兼容现有 HarmonyOS 代码，使用区分大小写的 `smartRoom`

[创建产品官方文档](https://support.huaweicloud.com/usermanual-Iothub/iot_01_0054.html) · [在线开发产品模型](https://support.huaweicloud.com/devg-iothub/iot_02_0005.html)

### 属性

| 属性 | 类型 | 权限 | 建议单位 | 说明 |
|---|---|---|---|---|
| `Temp` | double | R | °C | 温度 |
| `Humi` | double | R | % | 湿度 |
| `Lumi` | int | R | lx | 光照 |
| `Dist` | int | R | 由固件确认 | 距离 |
| `LampST` | string/enum | RW | `ON/OFF` | 灯状态，可用于 desired |
| `CtlMode` | string/enum | RW | `AUTO/HUMAN/VOICE` | 控制模式 |
| `battery` | int | R | % | 电量，0—100 |
| `threshold` | double | RW | °C | Web 端期望温度阈值 |

`RW` 属性需要在产品模型中包含可写权限，否则 desired 无法下发。影子 key 不应包含点、`$` 或空字符。

### 命令

| 命令 | 输入参数 | 响应参数 |
|---|---|---|
| `Light` | `light: ON/OFF` | `result: string` |
| `CtlMode` | `ctlMode: AUTO/HUMAN/VOICE` | `result: string` |
| `SetThreshold`（可选） | `threshold: double` | `result: string` |

命令、属性和服务 ID 必须与固件、HarmonyOS、后端完全一致。后端同时兼容 `Temp/Humi/Lumi/Dist/LampST/CtlMode` 和常见小驼峰字段，但云端模型仍应选定唯一命名。

## 3. 注册设备与 MQTT 参数

控制台：`设备 > 所有设备 > 注册设备`。

1. 选择相同资源空间和 `SmartRoomDevice` 产品。
2. Node ID 使用设备唯一序列号/MAC 的安全表示，例如 `room-a01`。
3. 测试阶段选择密钥认证；生产批量设备建议评估 X.509。
4. 保存注册结果中的 Device ID 和 Device Secret。密钥丢失后只能重置。

[注册单个设备](https://support.huaweicloud.com/usermanual-Iothub/iot_01_0031.html) · [MQTT 设备连接鉴权](https://support.huaweicloud.com/intl/zh-cn/api-iothub/iot_06_v5_3009.html) · [X.509 认证](https://support.huaweicloud.com/intl/en-us/usermanual-iothub/iot_01_0211.html)

设备端推荐 MQTTS `8883`：

- Username：Device ID
- Client ID：使用控制台参数生成工具或官方 SDK 生成
- Password：基于 Device Secret 与时间戳生成的 HMAC-SHA256 值
- CA：从当前实例“接入信息/证书资源”下载，与接入域名匹配

不要手工把 Device Secret、生成后的 Password 或 CA 私钥写进 Web/API 仓库。

## 4. 设备 MQTT Topic

| 方向 | Topic | 用途 |
|---|---|---|
| 上行 | `$oc/devices/{device_id}/sys/properties/report` | 属性上报 |
| 下行 | `$oc/devices/{device_id}/sys/commands/#` | 接收命令 |
| 上行 | `$oc/devices/{device_id}/sys/commands/response/request_id={request_id}` | 命令响应 |
| 上行 | `$oc/devices/{device_id}/sys/shadow/get/request_id={request_id}` | 主动获取影子 |
| 下行 | `$oc/devices/{device_id}/sys/shadow/get/response/#` | 影子响应 |
| 下行 | `$oc/devices/{device_id}/sys/properties/set/#` | desired 差值/属性设置 |
| 上行 | `$oc/devices/{device_id}/sys/properties/set/response/request_id={request_id}` | 属性设置响应 |

[完整 Topic 定义](https://support.huaweicloud.com/api-iothub/iot_06_v5_3004.html) · [属性上报](https://support.huaweicloud.com/api-iothub/iot_06_v5_3010.html) · [设备获取影子](https://support.huaweicloud.com/api-iothub/iot_06_v5_3012.html) · [设备命令](https://support.huaweicloud.com/intl/zh-cn/api-iothub/iot_06_v5_3014.html) · [平台设置属性](https://support.huaweicloud.com/intl/zh-cn/api-iothub/iot_06_v5_3008.html)

属性上报示例：

```json
{
  "services": [{
    "service_id": "smartRoom",
    "properties": {
      "Temp": 24.6,
      "Humi": 53.2,
      "Lumi": 460,
      "Dist": 128,
      "LampST": "ON",
      "CtlMode": "AUTO",
      "battery": 86
    },
    "event_time": "20260629T101500Z"
  }]
}
```

命令响应必须复用下行 Topic 中的 `request_id`：

```json
{
  "result_code": 0,
  "response_name": "COMMAND_RESPONSE",
  "paras": { "result": "success" }
}
```

## 5. 应用侧 API 映射

后端使用华为云 v5 API：

| 本项目接口 | 华为云接口 |
|---|---|
| `GET /api/v1/devices` | `GET /v5/iot/{project_id}/devices` |
| `GET /api/v1/devices/:id` | `GET /v5/iot/{project_id}/devices/{device_id}` |
| `GET /api/v1/devices/:id/shadow` | `GET /v5/iot/{project_id}/devices/{device_id}/shadow` |
| `PUT /api/v1/devices/:id/shadow/desired` | `PUT /v5/iot/{project_id}/devices/{device_id}/shadow` |
| `POST /api/v1/devices/:id/commands` | `POST /v5/iot/{project_id}/devices/{device_id}/commands` |

- [查询设备列表](https://support.huaweicloud.com/api-iothub/iot_06_v5_0048.html)
- [查询设备详情](https://support.huaweicloud.com/api-iothub/iot_06_v5_0055.html)
- [查询设备影子](https://support.huaweicloud.com/api-iothub/iot_06_v5_0079.html)
- [更新 desired](https://support.huaweicloud.com/api-iothub/iot_06_v5_0072.html)
- [下发同步命令](https://support.huaweicloud.com/api-iothub/iot_06_v5_0038.html)

MQTT 设备使用同步命令：平台等待设备响应，官方超时时间为 20 秒。异步设备命令 API 当前主要用于 NB/LwM2M，不应直接套用到本 MQTT 产品。MQTT 需要离线缓存的单向业务可使用设备消息及 TTL：[下发设备消息](https://support.huaweicloud.com/api-iothub/iot_06_v5_0059.html)。

## 6. 端到端验收顺序

1. 使用控制台在线调试或 MQTT.fx/Python/Node Demo 让设备上线。
2. 订阅命令、影子响应、属性设置 Topic。
3. 上报一次完整属性，确认设备详情及 reported 更新。
4. 调用查询影子 API，确认字段、类型和单位。
5. 通过控制台下发 `Light`，设备执行并响应。
6. 通过本项目 Web 关闭/开启灯，检查 API 日志和设备响应。
7. 写入 `threshold` desired，设备收到 properties/set 后响应并上报新的 reported。
8. 断开设备，验证影子仍可查询；重新上线验证 desired 同步。

官方测试工具与示例：

- [MQTT.fx 调测](https://support.huaweicloud.com/devg-iothub/iot_01_2127.html)
- [Python 设备 Demo](https://support.huaweicloud.com/devg-iothub/iot_02_2129.html)
- [Node.js 设备 Demo](https://support.huaweicloud.com/devg-iothub/iot_02_2133.html)
- [设备侧 Python SDK](https://support.huaweicloud.com/intl/zh-cn/sdkreference-iothub/iot_02_00942.html)
- [产品在线调试](https://support.huaweicloud.com/devg-iothub/iot_02_9988.html)
- [IoTDA 新版运行日志](https://support.huaweicloud.com/usermanual-Iothub/iot_01_0030_8.html)

## 7. 当前尚不能自动取得的信息

华为云账号级的 Endpoint、Project ID、Instance ID、Product ID、Device ID 和凭据只能从已登录的用户控制台读取。本次开发环境没有可复用的登录会话，因此代码以安全占位符和 Mock 模式完成；不要通过聊天发送真实密码、AK/SK、Device Secret 或 Token。将这些值仅写入本机 `apps/api/.env` 后即可进行真机联调。
