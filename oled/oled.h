/*
 * 版权所有 (c) 2025 沈阳市网联通信规划设计有限公司
 * 作者：程国辉 刘艳
 * 修改：张天健 (Zhang Tianjian), 2026.07
 * 经原作者许可发布。
 * SPDX-License-Identifier: Apache-2.0
 */

#ifndef OLED_H
#define OLED_H

#endif

#define CONFIG_OLED_I2C_BUS 1
#include "osal_debug.h"
#include "cmsis_os2.h"
#include "app_init.h"

#include "oled_fonts.h"
#include "bsp_oled.h"
#include "pinctrl.h"
#include "gpio.h"

errcode_t oled_init(void);