/*
 * 版权所有 (c) 2025 沈阳市网联通信规划设计有限公司
 * 作者：程国辉 刘艳
 * 修改：张天健 (Zhang Tianjian), 2026.07 — 蜂鸣器/PWM亮度集成
 * 经原作者许可发布。
 * SPDX-License-Identifier: Apache-2.0
 */

#include "led.h"
#include "pinctrl.h"
#include "gpio.h"
#include "stdio.h"
#include "../pwm/pwm_lamp.h"
#define CONFIG_LED1_PIN GPIO_01
#define CONFIG_LED2_PIN GPIO_03

static int g_last_brightness = 100; // 记录上次非零亮度，用于led_on恢复

/* 定义LED引脚变量 */
static pin_t g_led1 = CONFIG_LED1_PIN;
static pin_t g_led2 = CONFIG_LED2_PIN;

/**
 * @brief LED初始化函数
 */
int led_init(void)
{
    // 设置IO复用关系，使用普通IO功能
    uapi_pin_set_mode(g_led1, PIN_MODE_0);
    uapi_pin_set_mode(g_led2, PIN_MODE_0);

    // 设置IO引脚的方向为输出
    uapi_gpio_set_dir(g_led1, GPIO_DIRECTION_OUTPUT);
    uapi_gpio_set_dir(g_led2, GPIO_DIRECTION_OUTPUT);

    // 设置IO引脚的初始电平为低电平（熄灭状态）
    uapi_gpio_set_val(g_led1, GPIO_LEVEL_HIGH);
    uapi_gpio_set_val(g_led2, GPIO_LEVEL_HIGH);

    printf("LED初始化完成: LED1-PIN%d, LED2-PIN%d\n", g_led1, g_led2);
    
    return 0;
}

/**
 * @brief LED翻转函数
 */
void led_toggle(void)
{
    uapi_gpio_toggle(g_led1);
    uapi_gpio_toggle(g_led2);
    printf("LED State Toggle\n");
}

/**
 * @brief 打开指定LED（点亮）
 *        LED1通过PWM恢复上次亮度，LED2通过GPIO高电平
 */
int led_on(int led_num)
{
    switch(led_num) {
        case 1:
            led_set_brightness(g_last_brightness); // PWM恢复上次非零亮度
            printf("LED1 ON (brightness=%d%%)\n", g_last_brightness);
            break;
        case 2:
            uapi_gpio_set_val(g_led2, GPIO_LEVEL_HIGH);
            printf("LED2 ON\n");
            break;
        default:
            printf("LED Number: %d\n", led_num);
            return -1;
    }
    return 0;
}

/**
 * @brief 关闭指定LED（熄灭）
 *        LED1通过PWM设为0%，LED2通过GPIO低电平
 */
int led_off(int led_num)
{
    switch(led_num) {
        case 1:
            led_set_brightness(0); // PWM占空比0=熄灭
            printf("LED1 OFF\n");
            break;
        case 2:
            uapi_gpio_set_val(g_led2, GPIO_LEVEL_LOW);
            printf("LED2 OFF\n");
            break;
        default:
            printf("Wrong LED NUMBER: %d\n", led_num);
            return -1;
    }
    return 0;
}

/**
 * @brief 获取LED状态
 */
int led_get(int led_num)
{
    int level;
    
    switch(led_num) {
        case 1:
            level = uapi_gpio_get_val(g_led1);
            break;
        case 2:
            level = uapi_gpio_get_val(g_led2);
            break;
        default:
            printf("WRONG LED NUMBER: %d\n", led_num);
            return -1;
    }
    
    printf("LED%d STATE: %s\n", led_num, level ? "ON" : "OFF");
    return level;
}

void pump_on(void)
{
    // 示例：假设LED接GPIO10，低电平点亮
    uapi_gpio_set_val(g_led1, GPIO_LEVEL_LOW);
    // printf("LED turned on\n");
}

void pump_off(void)
{
    uapi_gpio_set_val(g_led1, GPIO_LEVEL_HIGH);
    // printf("LED turned off\n");
}

/**
 * @brief 设置灯泡亮度（PWM控制GPIO_01）
 * @param percent 亮度百分比(0-100)，0=熄灭，100=最亮
 *
 * 功能：首次调用自动初始化PWM，后续直接更新占空比
 *      非零亮度值会被记住，供led_on()恢复使用
 */
void led_set_brightness(int percent)
{
    if (percent < 0)   percent = 0;
    if (percent > 100) percent = 100;

    // 记住非零亮度，供led_on恢复
    if (percent > 0) {
        g_last_brightness = percent;
    }

    pwm_lamp_set_duty((uint8_t)percent);
}

/**
 * @brief 获取当前灯泡亮度值（供MQTT上行JSON使用）
 */
int led_get_brightness(void)
{
    return g_last_brightness;
}

/**
 * @brief LED测试任务
 */
// 蜂鸣器短响提示音（GPIO_03 高电平触发，持续约200ms）
void buzzer_beep(void)
{
    uapi_gpio_set_val(g_led2, GPIO_LEVEL_HIGH);
    osal_msleep(200);
    uapi_gpio_set_val(g_led2, GPIO_LEVEL_LOW);
}

void *led_test_task(const char *arg)
{
    unused(arg);

    // 初始化LED
    if (led_init() != 0) {
        printf("LED INIT FAIL!\n");
        return NULL;
    }

    printf("LED TEST TASK START RUNNING...\n");

    // 测试单独控制LED
    printf("=== Singe Test === \n");
    led_on(1);      // 点亮LED1
    osal_msleep(1000);
    led_on(2);      // 点亮LED2
    osal_msleep(1000);
    led_off(1);     // 熄灭LED1
    osal_msleep(1000);
    led_off(2);     // 熄灭LED2
    osal_msleep(1000);

    printf("=== Blink Test ===\n");
    while (1) {
        // 使用toggle函数实现双LED同步闪烁
        led_toggle();
        osal_msleep(1000);
    }

    return NULL;
}