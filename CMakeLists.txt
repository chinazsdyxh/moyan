# 版权所有 (c) 2025 沈阳市网联通信规划设计有限公司
# 作者：程国辉 刘艳
# 修改：张天健 (Zhang Tianjian), 2026.07
# 经原作者许可发布。
# SPDX-License-Identifier: Apache-2.0

set(SOURCES_LIST
    ${CMAKE_CURRENT_SOURCE_DIR}/hcsr04/hcsr04.c
    ${CMAKE_CURRENT_SOURCE_DIR}/adc/ldr.c
    ${CMAKE_CURRENT_SOURCE_DIR}/wifi/wifi_connect.c
    ${CMAKE_CURRENT_SOURCE_DIR}/dht11/dht11.c
    ${CMAKE_CURRENT_SOURCE_DIR}/oled/oled_fonts.c
    ${CMAKE_CURRENT_SOURCE_DIR}/oled/bsp_oled.c
    ${CMAKE_CURRENT_SOURCE_DIR}/oled/oled.c
    ${CMAKE_CURRENT_SOURCE_DIR}/mqtt/mqtt.c
    ${CMAKE_CURRENT_SOURCE_DIR}/led/led.c
    ${CMAKE_CURRENT_SOURCE_DIR}/voice/voice.c
    ${CMAKE_CURRENT_SOURCE_DIR}/pwm/pwm_lamp.c
    ${CMAKE_CURRENT_SOURCE_DIR}/app_main.c
)
set(HEADER_LIST
    ${CMAKE_CURRENT_SOURCE_DIR}/wifi
    ${CMAKE_CURRENT_SOURCE_DIR}/dht11
    ${CMAKE_CURRENT_SOURCE_DIR}/oled
    ${CMAKE_CURRENT_SOURCE_DIR}/mqtt
    ${CMAKE_CURRENT_SOURCE_DIR}/led
    ${CMAKE_CURRENT_SOURCE_DIR}/voice
    ${CMAKE_CURRENT_SOURCE_DIR}/adc
    ${CMAKE_CURRENT_SOURCE_DIR}/hcsr04
    ${CMAKE_CURRENT_SOURCE_DIR}/pwm
    ${CMAKE_CURRENT_SOURCE_DIR}/../../../../open_source/mqtt/paho.mqtt.c/src
)

set(SOURCES "${SOURCES}" ${SOURCES_LIST} PARENT_SCOPE)
set(PUBLIC_HEADER "${PUBLIC_HEADER}" ${HEADER_LIST} PARENT_SCOPE)
