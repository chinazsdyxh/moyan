/*
 * 版权所有 (c) 2025 沈阳市网联通信规划设计有限公司
 * 作者：程国辉 刘艳
 * 修改：张天健 (Zhang Tianjian), 2026.07 — Hi3863适配
 * 经原作者许可发布。
 * SPDX-License-Identifier: Apache-2.0
 */

#include "stdio.h"
#include "pwm_lamp.h"

static unsigned char g_pwm_initialized = 0;

/**
 * @brief 计算PWM高低电平时间（时钟周期数）
 * @param freq   PWM频率(Hz)
 * @param duty   占空比(0-100)
 * @param low_time  输出低电平时钟周期数
 * @param high_time 输出高电平时钟周期数
 * @return errcode_t
 */
static errcode_t calculate_pwm_timing(uint32_t freq, uint8_t duty,
                                       uint32_t *low_time, uint32_t *high_time)
{
    if (freq == 0) {
        printf("Error: PWM frequency cannot be 0\r\n");
        return ERRCODE_FAIL;
    }

    uint32_t total_cycles = PWM_BASE_CLOCK_HZ / freq;

    // 检查周期数范围
    if (total_cycles < 2) {
        total_cycles = 2;
    }
    if (total_cycles > 0xFFFF) {
        total_cycles = 0xFFFF;
    }

    uint32_t high_cycles = (total_cycles * duty) / 100;
    uint32_t low_cycles = total_cycles - high_cycles;

    // 确保至少有一个时钟周期
    if (high_cycles == 0) high_cycles = 1;
    if (low_cycles == 0) low_cycles = 1;

    *high_time = high_cycles;
    *low_time = low_cycles;

    return ERRCODE_SUCC;
}

/**
 * @brief PWM灯泡模块初始化
 */
errcode_t pwm_lamp_init(void)
{
    if (g_pwm_initialized) {
        return ERRCODE_SUCC; // 已初始化，无需重复
    }

    printf("--- PWM Lamp Init: GPIO_%d -> PWM mode %d ---\r\n", PWM_PIN, PWM_PIN_MODE);

    // Step 1: 配置GPIO引脚为PWM功能
    uapi_pin_set_mode(PWM_PIN, PWM_PIN_MODE);

    // Step 2: 初始化PWM模块
    uapi_pwm_deinit();
    errcode_t ret = uapi_pwm_init();
    if (ret != ERRCODE_SUCC) {
        printf("Error: PWM init failed: %d\r\n", ret);
        return ret;
    }

    // Step 3: 将PWM通道注册到组（Hi3863必须，否则不输出波形）
    uint8_t channel_set[] = {PWM_CHANNEL};
    ret = uapi_pwm_set_group(PWM_GROUP_ID, channel_set,
                              sizeof(channel_set) / sizeof(channel_set[0]));
    if (ret != ERRCODE_SUCC) {
        printf("Error: pwm_set_group failed: %d\r\n", ret);
        return ret;
    }

    g_pwm_initialized = 1;
    printf("PWM lamp init success (ch=%d, group=%d, freq=%dHz)\r\n",
           PWM_CHANNEL, PWM_GROUP_ID, PWM_DESIRED_FREQ_HZ);
    return ERRCODE_SUCC;
}

/**
 * @brief 设置PWM占空比（灯泡亮度0-100%）
 */
errcode_t pwm_lamp_set_duty(uint8_t percent)
{
    if (percent > 100) {
        percent = 100;
    }

    // 自动初始化
    if (!g_pwm_initialized) {
        errcode_t ret = pwm_lamp_init();
        if (ret != ERRCODE_SUCC) {
            return ret;
        }
    }

    uint32_t low_time, high_time;
    errcode_t ret = calculate_pwm_timing(PWM_DESIRED_FREQ_HZ, percent, &low_time, &high_time);
    if (ret != ERRCODE_SUCC) {
        return ret;
    }

    // 配置PWM参数
    pwm_config_t cfg = {
        .low_time = low_time,
        .high_time = high_time,
        .offset_time = 0,
        .cycles = 0,        // 0 = 连续输出
        .repeat = 1
    };

    // 先关闭再重新打开（更新占空比）
    uapi_pwm_close(PWM_CHANNEL);

    ret = uapi_pwm_open(PWM_CHANNEL, &cfg);
    if (ret != ERRCODE_SUCC) {
        printf("Error: pwm_open failed: %d\r\n", ret);
        return ret;
    }

    ret = uapi_pwm_start(PWM_CHANNEL);
    if (ret != ERRCODE_SUCC) {
        printf("Error: pwm_start failed: %d\r\n", ret);
        uapi_pwm_close(PWM_CHANNEL);
        return ret;
    }

    printf("PWM duty set: %d%% (high=%d, low=%d cycles)\r\n", percent, high_time, low_time);
    return ERRCODE_SUCC;
}
