/*
 * 版权所有 (c) 2025 沈阳市网联通信规划设计有限公司
 * 作者：程国辉 刘艳
 * 修改：张天健 (Zhang Tianjian), 2026.07
 * 经原作者许可发布。
 * SPDX-License-Identifier: Apache-2.0
 */

#ifndef __PWM_LAMP_H__
#define __PWM_LAMP_H__

#include "common_def.h"
#include "pinctrl.h"
#include "pwm.h"
#include "gpio.h"
#include "soc_osal.h"

// Hi3863 PWM配置 - 通道1对应GPIO_01
#define PWM_CHANNEL                1       // PWM通道1
#define PWM_GROUP_ID               0       // PWM组ID
#define PWM_PIN                    1       // GPIO_01
#define PWM_PIN_MODE               1       // Hi3863 PWM功能模式

// PWM时钟参数
#define PWM_BASE_CLOCK_HZ          24000000 // Hi3863 PWM时钟24MHz
#define PWM_DESIRED_FREQ_HZ        1000    // PWM频率1kHz

/**
 * @brief PWM灯泡模块初始化
 * @return errcode_t 成功返回ERRCODE_SUCC，失败返回错误码
 *
 * 功能：配置GPIO_01为PWM模式，初始化PWM硬件
 */
errcode_t pwm_lamp_init(void);

/**
 * @brief 设置PWM占空比（灯泡亮度）
 * @param percent 亮度百分比(0-100)，0=熄灭，100=最亮
 * @return errcode_t 成功返回ERRCODE_SUCC，失败返回错误码
 *
 * 功能：根据百分比计算PWM高低电平时间并输出
 *       若未初始化则自动调用pwm_lamp_init()
 */
errcode_t pwm_lamp_set_duty(uint8_t percent);

#endif /* __PWM_LAMP_H__ */
