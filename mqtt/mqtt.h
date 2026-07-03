/*
 * Copyright (c) 2024 Beijing HuaQingYuanJian Education Technology Co., Ltd.
 * 修改：张天健 (Zhang Tianjian), 2026.07
 * SPDX-License-Identifier: Apache-2.0
 */

#ifndef _MQTT_H
#define _MQTT_H

#include "soc_osal.h"
#include "app_init.h"
#include "cmsis_os2.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "errcode.h"
#include "../wifi/wifi_connect.h"


#endif


int mqtt_publish(const char *topic, char *msg);

void mqtt_app_start(void);
void mqtt_init_task(const char *argument);