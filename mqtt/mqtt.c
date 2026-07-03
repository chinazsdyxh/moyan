/*
 * Copyright (c) 2024 Beijing HuaQingYuanJian Education Technology Co., Ltd.
 * 修改：张天健 (Zhang Tianjian), 2026.07 — 三模式AUTO拦截/LightDegree命令
 * SPDX-License-Identifier: Apache-2.0
 */

#include "soc_osal.h"
#include "app_init.h"
#include "cmsis_os2.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "MQTTClientPersistence.h"
#include "MQTTClient.h"
#include "errcode.h"
#include "../wifi/wifi_connect.h"
#include "../app_main.h"
#include "../dht11/dht11.h"
#include "../led/led.h"
#include "../voice/voice.h"

#ifndef unused
#define unused(var)     (void)(var)
#endif

osThreadId_t mqtt_init_task_id; // mqtt订阅数据任务

#define KEEP_ALIVE_INTERVAL 120
#define DELAY_TIME_MS 100


char g_send_buffer[260] = {0}; // 发布数据缓冲区
char g_response_id[100] = {0}; // 保存命令id缓冲区

MQTTClient_message pubmsg = MQTTClient_message_initializer;
MQTTClient_deliveryToken token;

// 全局定义静态缓冲区（避免函数内反复分配）
static char topicBuf[256] = {0};
static char dataBuf[1024] = {0};
#define		JSON_Tree_Format	"{ \n "					\
                                "\"services\": [{ \n"		\
                                "\"service_id\": \"smartRoom\", \n"	\
                                "\"properties\": { \n"	\
                                    "\"Temp\":  \"%4.2f\", \n"	\
                                    "\"Humi\":  \"%4.2f\", \n"	\
                                    "\"Lumi\":  \"%d\", \n"	\
                                    "\"Dist\":  \"%d\" ,\n"	\
                                    "\"LampST\":  \"%s\" ,\n"	\
                                    "\"LightDegree\":  %d ,\n"	\
                                    "\"CtlMode\":  \"%s\" \n"	\
                                    "}, \n"	\
                                "\"event_time\": \"\" \n"	\
                                "} \n"	\
                                "] \n"	\
                                "}\n"
                                

char A_JSON_Tree[512] = {0};	// 存放JSON树（扩容以容纳LightDegree字段）

char g_response_buf[] =
    "{\"result_code\": 0,\"response_name\": \"smartPet\",\"paras\": {\"result\": \"success\"}}"; // 响应json
uint8_t g_cmdFlag;
MQTTClient client;
volatile MQTTClient_deliveryToken deliveredToken;
extern int MQTTClient_init(void);
static osal_mutex g_mux_id;

extern DHT11_Data_TypeDef DHT11_Data;  //存放温度数据
extern char LampSt[4] ;//灯状态
extern int lampState;
extern char g_ctlMode[10];  // 云端下发控制模式：AUTO=自动, HUMAN=手动, VOICE=语音

extern int32_t distance;
extern uint16_t alsData;
extern uint16_t ldr_value;

// 创建JSON树
//===================================================================================================
static void  Setup_JSON_Tree_JX(void)
{

	printf(" into setup json\n");
	// 赋值JSON树【赋值JSON_Tree_Format字符串中的格式字符】
	//--------------------------------------------------------------------------------------------	
	//sprintf(A_JSON_Tree, JSON_Tree_Format,light_num,distant,humitystr,tempstr,LampSt,CondSt);
	memset(A_JSON_Tree,0,512);
	sprintf(A_JSON_Tree, JSON_Tree_Format,DHT11_Data.temperature,DHT11_Data.humidity,ldr_value,distance,LampSt,led_get_brightness(),g_ctlMode);//这些数据现在是调试用的，后面需要用驱动获取变量加以更换 2025年11月17日

	printf("\r\n-------------------- create JSON tree -------------------\r\n");

	printf("%s",A_JSON_Tree);	// 串口打印JSON树

	printf("\r\n--------------------create JSON tree  -------------------\r\n");

}


/* 回调函数，处理连接丢失 */
void connlost(void *context, char *cause)
{
    unused(context);
    printf("Connection lost: %s\n", cause);
}
int mqtt_subscribe(const char *topic)
{
    printf("subscribe start\r\n");
    MQTTClient_subscribe(client, topic, 1);
    return 0;
}

int mqtt_publish(const char *topic, char *msg)
{

    int ret = 0;
    pubmsg.payload = msg;
    pubmsg.payloadlen = (int)strlen(msg);
    pubmsg.qos = 1;
    pubmsg.retained = 0;
    //printf("[payload]:  %s, [topic]: %s\r\n", msg, topic);
    ret = MQTTClient_publishMessage(client, topic, &pubmsg, &token);

    if (ret != MQTTCLIENT_SUCCESS) {
        printf("mqtt publish failed\r\n");
        return ret;
    }

    return ret;
}

/* 回调函数，处理消息到达 */
void delivered(void *context, MQTTClient_deliveryToken dt)
{
    unused(context);
   // printf("Message with token value %d delivery confirmed\n", dt);

    deliveredToken = dt;
}
// 解析字符串并保存到数组中
void parse_after_equal(const char *input, char *output)
{
    const char *equalsign = strchr(input, '=');
    if (equalsign != NULL) {
        // 计算等于号后面的字符串长度
        strcpy(output, equalsign + 1);
    }
}
/* 回调函数，处理接收到的消息 */
int messageArrived(void *context, char *topic_name, int topic_len, MQTTClient_message *message)
{
    unused(context);
    uint16_t data_len = message->payloadlen;
   
    char *tmpT = NULL;
    // 新增长度校验，避免内存越界
    if (topic_len >= (int)sizeof(topicBuf)) {
        printf("Topic length exceeds buffer size!\n");
        topic_len = sizeof(topicBuf) - 1; // 截断保护
    }
    if (data_len >= sizeof(dataBuf)) {
        printf("Data length exceeds buffer size!\n");
        data_len = sizeof(dataBuf) - 1; // 截断保护
    }

    memset(topicBuf, 0, sizeof(topicBuf));
    memcpy(topicBuf, topic_name, topic_len < (int)sizeof(topicBuf) ? topic_len : (int)sizeof(topicBuf)-1);
    memset(dataBuf, 0, sizeof(dataBuf));
    memcpy(dataBuf, (char *)message->payload, data_len < (int)sizeof(dataBuf) ? data_len : sizeof(dataBuf)-1);
    // 安全复制主题和消息
    memcpy(topicBuf, topic_name, topic_len);
    topicBuf[topic_len] = '\0';
    memcpy(dataBuf, (char *)message->payload, data_len);
    dataBuf[data_len] = '\0';

    // 打印接收日志
    printf("[MQTT] Receive topic: %s, data: %s \r\n", topicBuf, dataBuf);
    printf( "[MQTT] Topic len: %d, Data len: %d\r\n", topic_len, data_len);

    // 1. 解析灯泡控制命令（AUTO模式下忽略，仅HUMAN/VOICE模式响应）
    tmpT = strstr(dataBuf, "Light");
    if(tmpT != NULL)
    {
        if(strcmp(g_ctlMode, "AUTO") == 0) {
            printf("[MQTT] Light cmd IGNORED (mode=AUTO)\r\n");
        } else {
            if(strstr(dataBuf, "ON") != NULL) {
                printf("[MQTT] Command: led on\r\n");
                lampState=0; //设置灯泡状态为开(GPIO高电平点亮, led_on→GPIO HIGH→灯亮)
                led_on(1);
            }
            if(strstr(dataBuf, "OFF") != NULL) {
                printf("[MQTT] Command: led off\r\n");
                lampState=1; //设置灯泡状态为关(GPIO低电平熄灭, led_off→GPIO LOW→灯灭)
                led_off(1);
            }
        }
    }

    // 2. 解析空调控制命令
    tmpT = strstr(dataBuf, "Condi");
    if(tmpT != NULL)
    {
        if(strstr(dataBuf, "ON") != NULL) printf("[MQTT] Command: condition on\r\n");
        else printf("[MQTT] Command: condition off\r\n");
    }

    // 3. 解析电视控制命令
    tmpT = strstr(dataBuf, "TV");
    if(tmpT != NULL)
    {
        printf("[MQTT] Command: tv command comein\r\n");
        if(strstr(dataBuf, "ON") != NULL) printf("[MQTT] Command: tv now on\r\n");
        else printf("[MQTT] Command: tv now off\r\n");
    }

    // 4. 解析洗衣机控制命令
    tmpT = strstr(dataBuf, "Wash");
    if(tmpT != NULL)
    {
        printf("[MQTT] Command: Wash command comein\r\n");
        if(strstr(dataBuf, "ON") != NULL) printf("[MQTT] Command: Wash now on\r\n");
        else printf("[MQTT] Command: Wash now off\r\n");
    }

    // 5. 解析告警器控制命令
    tmpT = strstr(dataBuf, "BeepWarning");
    if(tmpT != NULL)
    {
        printf("[MQTT] Command: BeepWarning command comein\r\n");
        if(strstr(dataBuf, "ON") != NULL) printf("[MQTT] Command: BeepWarning now on\r\n");
        else printf("[MQTT] Command: BeepWarning now off\r\n");
    }

    // 6. 解析控制模式命令
    tmpT = strstr(dataBuf, "CtlMode");
    if(tmpT != NULL)
    {
        if(strstr(dataBuf, "AUTO") != NULL) {
            printf("[MQTT] Command: auto control mode\r\n");
            memset(g_ctlMode, 0, sizeof(g_ctlMode));
            strcpy(g_ctlMode, "AUTO"); //切换回自动控制模式
            voice_notify_mode("AUTO");
        }
        if(strstr(dataBuf, "HUMAN") != NULL) {
            printf("[MQTT] Command: human control mode\r\n");
            memset(g_ctlMode, 0, sizeof(g_ctlMode));
            strcpy(g_ctlMode, "HUMAN"); //切换到手动控制模式
            voice_notify_mode("HUMAN");
        }
        if(strstr(dataBuf, "VOICE") != NULL) {
            printf("[MQTT] Command: voice control mode\r\n");
            memset(g_ctlMode, 0, sizeof(g_ctlMode));
            strcpy(g_ctlMode, "VOICE"); //切换到语音控制模式
            voice_notify_mode("VOICE");
        }
    }

    // 7. 解析灯光亮度控制命令（LightDegree: 0-100）
    tmpT = strstr(dataBuf, "LightDegree");
    if(tmpT != NULL)
    {
        printf("[MQTT] Command: LightDegree\r\n");

        // 从"LightDegree"位置向后扫描，提取数字
        char *p = tmpT + strlen("LightDegree");
        while (*p && (*p < '0' || *p > '9')) p++; // 跳过非数字字符

        if (*p >= '0' && *p <= '9') {
            int brightness = atoi(p);
            if (brightness < 0)   brightness = 0;
            if (brightness > 100) brightness = 100;
            printf("[MQTT] LightDegree parsed: %d%%\r\n", brightness);
            led_set_brightness(brightness);
            lampState = (brightness > 0) ? 0 : 1; // 同步灯状态
        } else {
            printf("[MQTT] LightDegree: no numeric value found\r\n");
        }
    }

    // 8. 命令下发兜底：直接搜参数名 lightdegree
    tmpT = strstr(dataBuf, "lightdegree");
    if(tmpT != NULL)
    {
        printf("[MQTT] Command: lightdegree\r\n");

        // 从"lightdegree"向后扫描提取数字
        char *p = tmpT + strlen("lightdegree");
        while (*p && (*p < '0' || *p > '9')) p++;

        if (*p >= '0' && *p <= '9') {
            int brightness = atoi(p);
            if (brightness < 0)   brightness = 0;
            if (brightness > 100) brightness = 100;
            printf("[MQTT] lightdegree parsed: %d%%\r\n", brightness);
            led_set_brightness(brightness);
            lampState = (brightness > 0) ? 0 : 1;
        } else {
            printf("[MQTT] lightdegree: no numeric value found\r\n");
        }
    }


    // 资源释放
    // 解析命令id
    parse_after_equal(topic_name, g_response_id);
   
    sprintf(g_send_buffer, MQTT_CLIENT_RESPONSE, g_response_id);
    
    

    g_cmdFlag = 1;

    memset((char *)message->payload, 0, message->payloadlen);
    MQTTClient_freeMessage(&message);
    MQTTClient_free(topic_name);

    return 1;
}

static errcode_t mqtt_connect(void)
{
    int ret;
    MQTTClient_connectOptions conn_opts = MQTTClient_connectOptions_initializer;
    /* 初始化MQTT客户端 */
    MQTTClient_init();
    /* 创建 MQTT 客户端 */
    ret = MQTTClient_create(&client, SERVER_IP_ADDR, CLIENT_ID, MQTTCLIENT_PERSISTENCE_NONE, NULL);
    if (ret != MQTTCLIENT_SUCCESS) {
        printf("Failed to create MQTT client, return code %d\n", ret);
        return ERRCODE_FAIL;
    }
    conn_opts.keepAliveInterval = KEEP_ALIVE_INTERVAL;
    conn_opts.cleansession = 1;
#ifdef IOT
    conn_opts.username = DEVICEID;
    conn_opts.password = CLIENTPASSWORD;
#endif
    // 绑定回调函数
    MQTTClient_setCallbacks(client, NULL, connlost, messageArrived, delivered);

    // 尝试连接
    if ((ret = MQTTClient_connect(client, &conn_opts)) != MQTTCLIENT_SUCCESS) {
        printf("Failed to connect, return code %d\n", ret);
        MQTTClient_destroy(&client); // 连接失败时销毁客户端
        return ERRCODE_FAIL;
    }
    printf("Connected to MQTT broker!\n");
    osDelay(DELAY_TIME_MS);
    // 订阅MQTT主题
    mqtt_subscribe(MQTT_CMDTOPIC_SUB);

    return ERRCODE_SUCC;
}

void mqtt_init_task(const char *argument)
{
    unused(argument);
    osDelay(DELAY_TIME_MS);
    mqtt_connect();

    while(1){
            // 响应平台命令部分
        osDelay(DELAY_TIME_MS); // 需要延时 否则会发布失败
        if (g_cmdFlag) {
            sprintf(g_send_buffer, MQTT_CLIENT_RESPONSE, g_response_id);
            // 设备响应命令
            osal_mutex_lock_timeout(&g_mux_id, 10);//增加互斥锁，防止多进程冲突
            mqtt_publish(g_send_buffer, g_response_buf);
            osal_mutex_unlock(&g_mux_id);
            g_cmdFlag = 0;
            memset(g_response_id, 0, sizeof(g_response_id) / sizeof(g_response_id[0]));
        }

        printf("construct json tree\r\n");
        Setup_JSON_Tree_JX();   
        mqtt_publish(MQTT_DATATOPIC_PUB, A_JSON_Tree);
        memset(A_JSON_Tree, 0,512);
        osDelay(DELAY_TIME_MS);   //延时1000Ms
        //osal_msleep(1000);  //每1秒采集一次
    }

}

/*********************************************************************
 * 函数名：mqtt_app_start
 * 描述：MQTT应用启动入口（创建MQTT任务）
 * 参数：无
 * 返回值：ERRCODE_SUCC(0)-成功，ERRCODE_FAIL(-1)-失败
 ********************************************************************/
void mqtt_app_start(void)
{
    // osal_kthread_lock();
	 
	// osal_task *task1 = osal_kthread_create((osal_kthread_handler)mqtt_init_task, 0, "mqtt_init_task", 0x3000);
	// osal_kthread_set_priority(task1, 10);
	// printf("Create mqtt_init_task succ.\r\n");

	// osal_kthread_unlock();

    // printf("Enter network_wifi_mqtt_example()!");

    // 配置新任务的属性
    osThreadAttr_t options;
    options.name = "mqtt_init_task";     // 任务名称
    options.attr_bits = 0;               // 属性位
    options.cb_mem = NULL;               // 控制块内存地址
    options.cb_size = 0;                 // 控制块大小
    options.stack_mem = NULL;            // 栈内存地址
    options.stack_size = 0x6000;         // 栈大小（12KB）
    options.priority = osPriorityNormal; // 任务优先级

    // 创建并启动MQTT初始化任务
    mqtt_init_task_id = osThreadNew((osThreadFunc_t)mqtt_init_task, NULL, &options);
    if (mqtt_init_task_id != NULL) {
        printf("ID = %d, Create mqtt_init_task_id is OK!", mqtt_init_task_id);
    }


}

