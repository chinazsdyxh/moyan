/*
 * 版权所有 (c) 2025 沈阳市网联通信规划设计有限公司
 * 作者：程国辉 刘艳
 * 修改：张天健 (Zhang Tianjian), 2026.07
 * 经原作者许可发布。
 * SPDX-License-Identifier: Apache-2.0
 */

#ifndef _MAIN_H
#define _MAIN_H



// MQTT服务器配置（保持原有）
#define SERVER_IP_ADDR          "f89d6f04a4.st1.iotda-device.cn-north-4.myhuaweicloud.com"
#define SERVER_IP_PORT           1883


// MQTT主题配置（保持原有）
#define MQTT_CMDTOPIC_SUB       "$oc/devices/6a3a6e13cbb0cf6bb96829d9_roomone/sys/commands/#"
#define MQTT_DATATOPIC_PUB      "$oc/devices/6a3a6e13cbb0cf6bb96829d9_roomone/sys/properties/report"
#define MQTT_CLIENT_RESPONSE    "$oc/devices/6a3a6e13cbb0cf6bb96829d9_roomone/sys/commands/response/request_id=%s"

#define IOT
// 认证信息（保持原有）
#ifdef IOT
#define CLIENT_ID               "6a3a6e13cbb0cf6bb96829d9_roomone_0_0_2026062312"
#define DEVICEID                "6a3a6e13cbb0cf6bb96829d9_roomone"
#define CLIENTPASSWORD          "a12b43f85730c07f0c4cdea998d3a5710176c44676ad4ded6b6410ea3586f6d0"
#endif


#define CONFIG_WIFI_SSID        "dusting"      // 要连接的WiFi 热点账号
#define CONFIG_WIFI_PWD         "z961819z"        // 要连接的WiFi 热点密码

#endif
