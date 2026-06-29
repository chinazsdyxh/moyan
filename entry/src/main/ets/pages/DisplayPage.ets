import { rcp } from '@kit.RemoteCommunicationKit';
import { BusinessError } from '@kit.BasicServicesKit';
import http from '@ohos.net.http';
import promptAction from '@ohos.promptAction';
import router from '@ohos.router';
import {
  buildAuthRequestBody,
  buildCommandUrl,
  buildDeviceShadowUrl,
  cloudConfig,
  isDisplayCloudConfigComplete,
  isLightCommandCloudConfigComplete,
  isModeCommandCloudConfigComplete,
  pickFirstJsonValue
} from '../config/CloudConfig';

interface LightCommandParas {
  light: string;
}

interface LightCommandBody {
  service_id: string;
  command_name: string;
  paras: LightCommandParas;
}

interface ModeCommandParas {
  ctlMode: string;
}

interface ModeCommandBody {
  service_id: string;
  command_name: string;
  paras: ModeCommandParas;
}

interface SmartRoomProperties {
  Temp?: string;
  Humi?: string;
  Lumi?: string;
  Dist?: string;
  LampST?: string;
  CtlMode?: string;
}

interface SmartRoomReported {
  properties: SmartRoomProperties;
}

interface SmartRoomShadow {
  service_id: string;
  reported: SmartRoomReported;
}

interface DeviceShadowResponse {
  shadow: SmartRoomShadow[];
}

let aToken = '';
let fetchTimer = 0;
const MODE_CONFIRM_TIMEOUT_MS = 6000;

@Entry
@Component
struct Display {
  @State temp: string = '--';
  @State humi: string = '--';
  @State lumi: string = '--';
  @State dist: string = '--';
  @State lampst: string = '--';
  @State ctlMode: string = '--';
  @State pendingMode: string = '';
  pendingModeSince: number = 0;
  @State isLampLoading: boolean = false;
  @State isModeLoading: boolean = false;
  @State statusMessage: string = '正在初始化';
  @State debugTokenLength: string = '0';
  @State debugResponseCode: string = '--';
  @State debugResponseLength: string = '0';
  @State debugExtracted: string = '--';
  @State debugRawResponse: string = '--';

  aboutToAppear() {
    this.initData();
  }

  aboutToDisappear() {
    if (fetchTimer !== 0) {
      clearInterval(fetchTimer);
      fetchTimer = 0;
    }
  }

  initData() {
    if (!isDisplayCloudConfigComplete()) {
      this.statusMessage = '云服务配置不完整';
      promptAction.showToast({ message: '请先填写云服务配置', duration: 2000 });
      return;
    }

    this.statusMessage = '正在认证';
    const session = rcp.createSession();
    const postContent: rcp.RequestContent = buildAuthRequestBody();
    session.post(cloudConfig.authUrl, postContent)
      .then((response) => {
        const headerText = JSON.stringify(response.headers);
        aToken = pickFirstJsonValue(headerText, 'x-subject-token', 'X-Subject-Token', 'x_subject_token',
          'X_Subject_Token', 'token');

        if (aToken === '--') {
          aToken = '';
          this.debugTokenLength = '0';
          this.statusMessage = '认证成功但未取到 Token';
          return;
        }

        this.debugTokenLength = String(aToken.length);
        this.statusMessage = '认证成功，正在获取设备数据';
        this.fetchDeviceData();
        this.startTimer();
      })
      .catch((err: BusinessError) => {
        console.error(`Auth failed: ${JSON.stringify(err)}`);
        this.statusMessage = '认证失败: ' + JSON.stringify(err.code);
      });
  }

  startTimer() {
    if (fetchTimer !== 0) {
      return;
    }
    fetchTimer = setInterval(async () => {
      await this.fetchDeviceData();
    }, 1000);
  }

  async fetchDeviceData() {
    if (!aToken) {
      this.statusMessage = '未获取到认证令牌';
      return;
    }

    try {
      const instance = http.createHttp();
      const reqOpt: http.HttpRequestOptions = {
        method: http.RequestMethod.GET,
        expectDataType: http.HttpDataType.STRING,
        header: {
          'Content-Type': 'application/json',
          'X-Auth-Token': aToken
        }
      };
      const res = await instance.request(buildDeviceShadowUrl(), reqOpt);
      const dataall = typeof res.result === 'string' ? res.result : JSON.stringify(res.result);
      console.info('Device shadow response: ' + dataall);
      this.debugTokenLength = String(aToken.length);
      this.debugResponseCode = String(res.responseCode);
      this.debugResponseLength = String(dataall.length);
      this.debugRawResponse = dataall.length > 360 ? dataall.slice(0, 360) + '...' : dataall;

      this.temp = pickFirstJsonValue(dataall, 'Temp', 'temp', 'temperature', 'Temperature', 'TEMP');
      this.humi = pickFirstJsonValue(dataall, 'Humi', 'humi', 'humidity', 'Humidity', 'HUMI');
      this.lumi = pickFirstJsonValue(dataall, 'Lumi', 'lumi', 'illumination', 'Illumination', 'LUMI');
      this.dist = pickFirstJsonValue(dataall, 'Dist', 'dist', 'distance', 'Distance', 'DIST');
      this.lampst = pickFirstJsonValue(dataall, 'LampST', 'LampSt', 'lampst', 'lampStatus', 'light');
      const reportedMode = pickFirstJsonValue(dataall, 'CtlMode', 'ctlMode', 'ctlmode', 'mode', 'Mode');
      const modeApplyResult = this.applyReportedMode(reportedMode);
      this.debugExtracted = 'T=' + this.temp + ', H=' + this.humi + ', L=' + this.lumi + ', D=' + this.dist +
        ', Lamp=' + this.lampst + ', ReportMode=' + reportedMode + ', ShowMode=' + this.ctlMode;

      if (this.temp === '--' && this.humi === '--' && this.lumi === '--' && this.dist === '--' &&
        this.lampst === '--' && reportedMode === '--') {
        this.statusMessage = '影子响应 ' + res.responseCode + '，但属性名未匹配';
      } else if (modeApplyResult === 'confirmed') {
        this.statusMessage = '模式已切换为 ' + this.getModeText(this.ctlMode);
      } else if (modeApplyResult === 'timeout') {
        this.statusMessage = '模式切换未确认，已显示云端状态';
      } else if (this.pendingMode !== '') {
        this.statusMessage = '正在切换到 ' + this.getModeText(this.pendingMode) + '，等待设备确认';
      } else {
        this.statusMessage = '数据已更新，影子响应 ' + res.responseCode;
      }
    } catch (error) {
      console.error('Fetch device data failed:', error);
      this.debugResponseCode = 'ERR';
      this.debugRawResponse = JSON.stringify(error);
      this.statusMessage = '获取设备数据失败';
    }
  }

  applyReportedMode(reportedMode: string): string {
    if (reportedMode === '--') {
      return 'ignored';
    }

    if (this.pendingMode === '') {
      this.ctlMode = reportedMode;
      return 'updated';
    }

    if (reportedMode === this.pendingMode) {
      this.ctlMode = reportedMode;
      this.pendingMode = '';
      this.pendingModeSince = 0;
      this.isModeLoading = false;
      return 'confirmed';
    }

    const waitedMs = Date.now() - this.pendingModeSince;
    if (waitedMs >= MODE_CONFIRM_TIMEOUT_MS) {
      this.pendingMode = '';
      this.pendingModeSince = 0;
      this.isModeLoading = false;
      this.ctlMode = reportedMode;
      return 'timeout';
    }

    this.ctlMode = this.pendingMode;
    return 'pending';
  }

  async controlLamp(command: string) {
    if (!aToken) {
      promptAction.showToast({ message: '未获取到认证令牌', duration: 2000 });
      return;
    }
    if (!isLightCommandCloudConfigComplete()) {
      promptAction.showToast({ message: '请先填写灯控制命令配置', duration: 2000 });
      return;
    }

    this.isLampLoading = true;
    try {
      const instance = http.createHttp();
      const commandBody: LightCommandBody = {
        service_id: cloudConfig.serviceId,
        command_name: cloudConfig.lightCommandName,
        paras: {
          light: command
        }
      };
      const reqOpt: http.HttpRequestOptions = {
        method: http.RequestMethod.POST,
        header: {
          'Content-Type': 'application/json',
          'X-Auth-Token': aToken
        },
        extraData: JSON.stringify(commandBody)
      };
      const res = await instance.request(buildCommandUrl(), reqOpt);

      if (res.responseCode === 200) {
        this.lampst = command;
        promptAction.showToast({
          message: command === 'ON' ? '灯已开启' : '灯已关闭',
          duration: 1500
        });
      } else {
        promptAction.showToast({ message: `灯控制失败: ${res.responseCode}`, duration: 2000 });
        console.error('Light command failed:', res.responseCode, res.result);
      }
    } catch (error) {
      console.error('Light command request failed:', error);
      promptAction.showToast({ message: '灯控制请求失败', duration: 2000 });
    } finally {
      this.isLampLoading = false;
    }
  }

  async controlMode(mode: string) {
    if (this.pendingMode !== '' && this.pendingMode !== mode) {
      promptAction.showToast({ message: '正在切换模式，请稍候', duration: 1200 });
      return;
    }
    if (this.pendingMode === mode) {
      return;
    }
    if (!aToken) {
      promptAction.showToast({ message: '未获取到认证令牌', duration: 2000 });
      return;
    }
    if (!isModeCommandCloudConfigComplete()) {
      promptAction.showToast({ message: '请先填写模式控制命令配置', duration: 2000 });
      return;
    }

    this.pendingMode = mode;
    this.pendingModeSince = Date.now();
    this.isModeLoading = true;
    this.ctlMode = mode;
    this.statusMessage = '正在切换到 ' + this.getModeText(mode) + '，等待设备确认';

    try {
      const instance = http.createHttp();
      const commandBody: ModeCommandBody = {
        service_id: cloudConfig.serviceId,
        command_name: cloudConfig.modeCommandName,
        paras: {
          ctlMode: mode
        }
      };
      const reqOpt: http.HttpRequestOptions = {
        method: http.RequestMethod.POST,
        header: {
          'Content-Type': 'application/json',
          'X-Auth-Token': aToken
        },
        extraData: JSON.stringify(commandBody)
      };
      const res = await instance.request(buildCommandUrl(), reqOpt);

      if (res.responseCode === 200) {
        promptAction.showToast({ message: '模式命令已下发: ' + this.getModeText(mode), duration: 1200 });
      } else {
        this.pendingMode = '';
        this.pendingModeSince = 0;
        this.isModeLoading = false;
        promptAction.showToast({ message: `模式切换失败: ${res.responseCode}`, duration: 2000 });
        console.error('Mode command failed:', res.responseCode, res.result);
      }
    } catch (error) {
      this.pendingMode = '';
      this.pendingModeSince = 0;
      this.isModeLoading = false;
      console.error('Mode command request failed:', error);
      promptAction.showToast({ message: '模式控制请求失败', duration: 2000 });
    }
  }

  getModeText(mode: string): string {
    if (mode === 'AUTO') {
      return '自动';
    }
    if (mode === 'HUMAN') {
      return '人工';
    }
    if (mode === 'VOICE') {
      return '语音';
    }
    return mode;
  }

  getLampText(): string {
    if (this.lampst === '1' || this.lampst === 'ON') {
      return '开启';
    }
    if (this.lampst === '0' || this.lampst === 'OFF') {
      return '关闭';
    }
    return this.lampst;
  }

  isLampOn(): boolean {
    return this.lampst === '1' || this.lampst === 'ON';
  }

  @Builder
  DeviceDataRows() {
    Row() {
      Text('温度:')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .width(90)
      Text(this.temp + '°C')
        .fontSize(18)
        .fontColor(Color.Blue)
        .flexGrow(1)
    }
    .justifyContent(FlexAlign.Start)
    .width('90%')

    Row() {
      Text('湿度:')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .width(90)
      Text(this.humi + '%')
        .fontSize(18)
        .fontColor(Color.Green)
        .flexGrow(1)
    }
    .justifyContent(FlexAlign.Start)
    .width('90%')

    Row() {
      Text('光照:')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .width(90)
      Text(this.lumi)
        .fontSize(18)
        .fontColor(Color.Orange)
        .flexGrow(1)
    }
    .justifyContent(FlexAlign.Start)
    .width('90%')

    Row() {
      Text('距离:')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .width(90)
      Text(this.dist)
        .fontSize(18)
        .fontColor(Color.Red)
        .flexGrow(1)
    }
    .justifyContent(FlexAlign.Start)
    .width('90%')

    Row() {
      Text('灯状态:')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .width(90)
      Text(this.getLampText())
        .fontSize(18)
        .fontColor(this.isLampOn() ? Color.Green : Color.Gray)
        .flexGrow(1)
    }
    .justifyContent(FlexAlign.Start)
    .width('90%')

    Row() {
      Text('控制模式:')
        .fontSize(18)
        .fontWeight(FontWeight.Medium)
        .width(90)
      Text(this.getModeText(this.ctlMode))
        .fontSize(18)
        .fontColor(Color.Blue)
        .flexGrow(1)
    }
    .justifyContent(FlexAlign.Start)
    .width('90%')
  }

  @Builder
  DebugRows() {
    Row() {
      Text('Token长度:')
        .fontSize(12)
        .fontColor(Color.Gray)
        .width(90)
      Text(this.debugTokenLength)
        .fontSize(12)
        .fontColor('#333333')
        .flexGrow(1)
    }
    .width('90%')

    Row() {
      Text('响应码:')
        .fontSize(12)
        .fontColor(Color.Gray)
        .width(90)
      Text(this.debugResponseCode)
        .fontSize(12)
        .fontColor('#333333')
        .flexGrow(1)
    }
    .width('90%')

    Row() {
      Text('响应长度:')
        .fontSize(12)
        .fontColor(Color.Gray)
        .width(90)
      Text(this.debugResponseLength)
        .fontSize(12)
        .fontColor('#333333')
        .flexGrow(1)
    }
    .width('90%')

    Row() {
      Text('提取结果:')
        .fontSize(12)
        .fontColor(Color.Gray)
        .width(90)
      Text(this.debugExtracted)
        .fontSize(12)
        .fontColor('#333333')
        .flexGrow(1)
    }
    .width('90%')
  }

  build() {
    Scroll() {
      Column({ space: 18 }) {
        Text('设备属性监控')
          .fontSize(24)
          .fontWeight(FontWeight.Bold)
          .margin({ top: 20 })

        Text(this.statusMessage)
          .fontSize(14)
          .fontColor(Color.Gray)
          .width('90%')

        this.DeviceDataRows()

        Row({ space: 8 }) {
          Button('自动')
            .fontSize(14)
            .backgroundColor(this.ctlMode === 'AUTO' ? Color.Blue : '#F0F0F0')
            .fontColor(this.ctlMode === 'AUTO' ? Color.White : Color.Black)
            .onClick(() => {
              this.controlMode('AUTO');
            })
          Button('人工')
            .fontSize(14)
            .backgroundColor(this.ctlMode === 'HUMAN' ? Color.Blue : '#F0F0F0')
            .fontColor(this.ctlMode === 'HUMAN' ? Color.White : Color.Black)
            .onClick(() => {
              this.controlMode('HUMAN');
            })
          Button('语音')
            .fontSize(14)
            .backgroundColor(this.ctlMode === 'VOICE' ? Color.Blue : '#F0F0F0')
            .fontColor(this.ctlMode === 'VOICE' ? Color.White : Color.Black)
            .onClick(() => {
              this.controlMode('VOICE');
            })
        }
        .width('90%')

        Button(this.isLampOn() ? '关闭灯' : '开启灯')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .backgroundColor(this.isLampOn() ? Color.Red : Color.Green)
          .fontColor(Color.White)
          .width(120)
          .enabled(!this.isLampLoading)
          .onClick(() => {
            this.controlLamp(this.isLampOn() ? 'OFF' : 'ON');
          })

        Button('视频监控')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .backgroundColor('#1E66FF')
          .fontColor(Color.White)
          .width(140)
          .onClick(() => {
            router.pushUrl({ url: 'pages/monitor' });
          })

        Button('本机摄像头')
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .backgroundColor('#444444')
          .fontColor(Color.White)
          .width(140)
          .onClick(() => {
            router.pushUrl({ url: 'pages/PhoneCameraPage' });
          })

        Text('调试信息')
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .fontColor('#333333')
          .width('90%')
          .margin({ top: 8 })
        this.DebugRows()
        Text(this.debugRawResponse)
          .fontSize(11)
          .fontColor(Color.Gray)
          .width('90%')
          .maxLines(8)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .width('100%')
      .padding(20)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(Color.White)
  }
}
