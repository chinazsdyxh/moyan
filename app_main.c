/*
 * 版权所有 (c) 2025 沈阳市网联通信规划设计有限公司
 * 作者：程国辉 刘艳
 * 修改：张天健 (Zhang Tianjian), 2026.07 — 三模式控灯/PWM调光/语音集成
 * 经原作者许可发布。
 * SPDX-License-Identifier: Apache-2.0
 */

#include "lwip/netifapi.h"
#include "wifi_hotspot.h"
#include "wifi_hotspot_config.h"
#include "stdlib.h"
#include "string.h"
#include "uart.h"
#include "lwip/nettool/misc.h"
#include "soc_osal.h"
#include "app_init.h"
#include "cmsis_os2.h"
#include "wifi_device.h"
#include "wifi_event.h"
#include "lwip/sockets.h"
#include "lwip/ip4_addr.h"
#include "wifi/wifi_connect.h"
#include "dht11/dht11.h"
#include "oled/oled.h"
#include "app_main.h"
#include "adc/ldr.h"
#include "hcsr04/hcsr04.h"
#include "led/led.h"
#include "voice/voice.h"


#define WIFI_TASK_STACK_SIZE 0x2000

#define DELAY_TIME_MS 100

DHT11_Data_TypeDef DHT11_Data;  //存放温度数据

char LampSt[4] = {0};//灯状态
int lampState=1;
char g_ctlMode[10] = "AUTO";  // 云端下发控制模式：AUTO=自动, HUMAN=手动, VOICE=语音

int32_t distance;
uint16_t alsData;
uint16_t ldr_value;


//以下为采集环境信息的子任务，源源不断的采集各种物联网环境信息数据
static void *environment_task(const char *arg)
{
     unused(arg);

     char lcd_buff[100]={0};
     errcode_t result;
     osal_msleep(1000);  //先稳定一下情绪每秒钟采集一次信息

     while(1)
     {

        result = dht11_read_data(&DHT11_Data);
         if(result ==  ERRCODE_SUCC)
         {
            printf("Temperature:%d.%d, Humidity:%d.%d\n", DHT11_Data.temp_high8bit, DHT11_Data.temp_low8bit, DHT11_Data.humi_high8bit, DHT11_Data.humi_low8bit);
            memset(lcd_buff,0,100);
            sprintf(lcd_buff, "Temp:%d.%d " ,DHT11_Data.temp_high8bit,DHT11_Data.temp_low8bit);
            bsp_oled_DrawString(0, 0, lcd_buff, Font_7x10, White);
            memset(lcd_buff,0,100);
            sprintf(lcd_buff, "Humi:%d.%d " ,DHT11_Data.humi_high8bit,DHT11_Data.humi_low8bit);
            bsp_oled_DrawString(0, 10, lcd_buff, Font_7x10, White);
            bsp_oled_UpdateScreen();
        }
        else{
            printf("Read DHT11 data fail.\n");
         }

        ldr_value = get_adc_value();
        memset(lcd_buff,0,100);
        sprintf(lcd_buff, "Lumi:%d   " ,ldr_value);
        bsp_oled_DrawString(0, 20, lcd_buff, Font_7x10, White);

        // 三模式灯控逻辑
        if (strcmp(g_ctlMode, "AUTO") == 0) {
            // AUTO模式：根据光敏传感器自动控制灯泡
            if (ldr_value > 50) {
                 led_on(1);
                 lampState=0; //设置灯泡状态为开
            } else {
                 led_off(1);
                 lampState=1; //设置灯泡状态为关
            }
        }
        // 统一显示灯泡状态
        if (lampState == 0) {
            bsp_oled_DrawString(0, 40, "LampSt:ON ", Font_7x10, White);
        } else {
            bsp_oled_DrawString(0, 40, "LampSt:OFF", Font_7x10, White);
        }

        distance=hcsr04_get_distance();
        memset(lcd_buff,0,100);
        sprintf(lcd_buff, "Dist:%d  mm " ,distance);
        bsp_oled_DrawString(0, 30, lcd_buff, Font_7x10, White);
        memset(lcd_buff,0,100);

        memset(LampSt,0,4);
        if(lampState==0)
        snprintf_s(LampSt, sizeof(LampSt), sizeof(LampSt)-1,"ON", lampState);
        else snprintf_s(LampSt, sizeof(LampSt), sizeof(LampSt)-1,"OFF", lampState);


        osDelay(DELAY_TIME_MS);
        osal_msleep(1000);  //每0.5秒采集一次
     }

    return NULL;
}


//本函数处理GPIO输出灯泡，电机的初始化，GPIO输入属性的初始化
static void gpio_init(void)
{

}

//本函数处理环境传感器的初始化、显示屏、串口的初始化
static void environment_sensor_init(void)
{
    dht11_init();
    oled_init();
    hcsr04_init();
    adc_init();
    led_init();
}




static void *appmain_start(const char *argument)
{
    unused(argument);

    gpio_init();    //完成gpio输出相关的初始化，部分输入KEY的初始化
    environment_sensor_init();//完成采集传感器的初始化、显示屏和串口初始化

    // 初始化语音UART控制并创建语音任务
    uart_gpio_init();
    uart_init_config();
    osal_kthread_create((osal_kthread_handler)uart_voice_task, 0, "UartVoiceTask", 0x1000);
    printf("Create UartVoiceTask succ.\r\n");

    wifi_connect(); //连接WIFI热点

    return NULL;
}



static void app_main(void)
{
    printf(" HUAWEI IOT BEGIN.....\r\n");

   // osDelay(DELAY_TIME_MS);   //延时100Ms
    osal_kthread_lock();
        osal_task *task1 = osal_kthread_create((osal_kthread_handler)appmain_start, 0, "appmain_start", 0x1000);
        osal_kthread_set_priority(task1, 10);
        printf("Create appmain_start succ.\r\n");

        osal_task *task2 = osal_kthread_create((osal_kthread_handler)environment_task, 0, "Environment_task", 0x1000);
        osal_kthread_set_priority(task2, 10);
        printf("Create Environment_task succ.\r\n");
  	osal_kthread_unlock();   
}

/* Run the app_main. */
app_run(app_main);