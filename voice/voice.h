/*
 * Copyright (c) 2024 Beijing HuaQingYuanJian Education Technology Co., Ltd.
 * 修改：张天健 (Zhang Tianjian), 2026.07
 * SPDX-License-Identifier: Apache-2.0
 */

#ifndef VOICE_H
#define VOICE_H

// 控制模式定义（与21_huaweiiot保持同步）
#define CTL_MODE_AUTO   "AUTO"   // 自动控制模式
#define CTL_MODE_HUMAN  "HUMAN"  // 手动控制模式
#define CTL_MODE_VOICE  "VOICE"  // 语音控制模式

// 全局模式变量
extern char g_ctlMode[10];

// 函数声明
void uart_gpio_init(void);
void uart_init_config(void);
void voice_analysis(uint8_t *info);
void *uart_voice_task(const char *arg);
void voice_notify_mode(const char *mode);  // 云端切换模式后通知语音板播报

#endif