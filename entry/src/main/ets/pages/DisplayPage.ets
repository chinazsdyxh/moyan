import { rcp } from '@kit.RemoteCommunicationKit';
import { BusinessError } from '@kit.BasicServicesKit';
import http from '@ohos.net.http';
import promptAction from '@ohos.promptAction';
import router from '@ohos.router';
import {
  buildAuthRequestBody,
  buildAssistantChatUrl,
  buildAssistantConfirmUrl,
  buildCommandUrl,
  buildDeviceShadowUrl,
  cloudConfig,
  isAssistantCloudConfigComplete,
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

interface AssistantDeviceState {
  Temp: number | null;
  Humi: number | null;
  Lumi: number | null;
  Dist: number | null;
  LampST: string;
  CtlMode: string;
}

interface AssistantChatRequest {
  userId: string;
  deviceId: string;
  message: string;
  deviceState: AssistantDeviceState;
}

interface AssistantPendingAction {
  deviceId: string;
  action: string;
  value: string;
  confirmQuestion: string;
}

interface AssistantChatResponse {
  replyText: string;
  pendingAction?: AssistantPendingAction | null;
}

interface AssistantConfirmRequest {
  deviceId: string;
  action: string;
  value: string;
}

interface AssistantConfirmResponse {
  ok: boolean;
  replyText: string;
}

let aToken = '';
let fetchTimer = 0;
const MODE_CONFIRM_TIMEOUT_MS = 6000;
const ASSISTANT_USER_ID = 'harmony_operator';

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
  @State assistantInput: string = '';
  @State assistantReplyText: string = '您好，我可以查看当前设备状态，也可以在您确认后控制灯光和模式。';
  @State assistantPendingDeviceId: string = '';
  @State assistantPendingActionName: string = '';
  @State assistantPendingValue: string = '';
  @State assistantPendingQuestion: string = '';
  @State isAssistantChatLoading: boolean = false;
  @State isAssistantConfirmLoading: boolean = false;

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

  async sendAssistantMessage(message?: string) {
    const text = (message !== undefined ? message : this.assistantInput).trim();
    if (text === '') {
      promptAction.showToast({ message: '请输入要询问的内容', duration: 1200 });
      return;
    }
    if (!isAssistantCloudConfigComplete()) {
      promptAction.showToast({ message: '请先填写后端助手地址', duration: 2000 });
      return;
    }
    if (this.isAssistantChatLoading || this.isAssistantConfirmLoading) {
      return;
    }

    this.isAssistantChatLoading = true;
    this.clearAssistantPendingAction();
    this.assistantInput = '';
    try {
      const requestBody: AssistantChatRequest = {
        userId: ASSISTANT_USER_ID,
        deviceId: cloudConfig.deviceId,
        message: text,
        deviceState: this.buildAssistantDeviceState()
      };
      const reqOpt: http.HttpRequestOptions = {
        method: http.RequestMethod.POST,
        expectDataType: http.HttpDataType.STRING,
        header: {
          'Content-Type': 'application/json'
        },
        extraData: JSON.stringify(requestBody)
      };
      const instance = http.createHttp();
      const res = await instance.request(buildAssistantChatUrl(), reqOpt);
      const responseText = typeof res.result === 'string' ? res.result : JSON.stringify(res.result);
      if (res.responseCode < 200 || res.responseCode >= 300) {
        this.assistantReplyText = '助手请求失败: ' + res.responseCode;
        console.error('Assistant chat failed:', res.responseCode, responseText);
        return;
      }

      const result = JSON.parse(responseText) as AssistantChatResponse;
      this.assistantReplyText = result.replyText || '助手已响应，但没有返回文本。';
      this.setAssistantPendingAction(result.pendingAction);
    } catch (error) {
      console.error('Assistant chat request failed:', error);
      this.assistantReplyText = '助手请求失败，请检查后端服务是否已启动。';
    } finally {
      this.isAssistantChatLoading = false;
    }
  }

  async confirmAssistantAction() {
    if (this.assistantPendingActionName === '') {
      return;
    }
    if (this.isAssistantConfirmLoading || this.isAssistantChatLoading) {
      return;
    }

    const action: AssistantPendingAction = {
      deviceId: this.assistantPendingDeviceId,
      action: this.assistantPendingActionName,
      value: this.assistantPendingValue,
      confirmQuestion: this.assistantPendingQuestion
    };
    this.isAssistantConfirmLoading = true;
    try {
      const requestBody: AssistantConfirmRequest = {
        deviceId: action.deviceId,
        action: action.action,
        value: action.value
      };
      const reqOpt: http.HttpRequestOptions = {
        method: http.RequestMethod.POST,
        expectDataType: http.HttpDataType.STRING,
        header: {
          'Content-Type': 'application/json'
        },
        extraData: JSON.stringify(requestBody)
      };
      const instance = http.createHttp();
      const res = await instance.request(buildAssistantConfirmUrl(), reqOpt);
      const responseText = typeof res.result === 'string' ? res.result : JSON.stringify(res.result);
      if (res.responseCode < 200 || res.responseCode >= 300) {
        this.assistantReplyText = '确认执行失败: ' + res.responseCode;
        console.error('Assistant confirm failed:', res.responseCode, responseText);
        return;
      }

      const result = JSON.parse(responseText) as AssistantConfirmResponse;
      this.assistantReplyText = result.replyText || '命令已确认执行。';
      this.clearAssistantPendingAction();
      this.applyConfirmedAssistantAction(action);
      await this.fetchDeviceData();
    } catch (error) {
      console.error('Assistant confirm request failed:', error);
      this.assistantReplyText = '确认执行失败，请稍后重试。';
    } finally {
      this.isAssistantConfirmLoading = false;
    }
  }

  cancelAssistantAction() {
    this.clearAssistantPendingAction();
    this.assistantReplyText = '已取消本次控制操作。';
  }

  setAssistantPendingAction(action?: AssistantPendingAction | null) {
    if (action === undefined || action === null) {
      this.clearAssistantPendingAction();
      return;
    }
    this.assistantPendingDeviceId = action.deviceId;
    this.assistantPendingActionName = action.action;
    this.assistantPendingValue = action.value;
    this.assistantPendingQuestion = action.confirmQuestion;
  }

  clearAssistantPendingAction() {
    this.assistantPendingDeviceId = '';
    this.assistantPendingActionName = '';
    this.assistantPendingValue = '';
    this.assistantPendingQuestion = '';
  }

  buildAssistantDeviceState(): AssistantDeviceState {
    return {
      Temp: this.parseNullableNumber(this.temp),
      Humi: this.parseNullableNumber(this.humi),
      Lumi: this.parseNullableNumber(this.lumi),
      Dist: this.parseDistance(this.dist),
      LampST: this.normalizeLampState(this.lampst),
      CtlMode: this.normalizeMode(this.ctlMode)
    };
  }

  parseNullableNumber(value: string): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  parseDistance(value: string): number | null {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return null;
    }
    return parsed;
  }

  normalizeLampState(value: string): string {
    if (value === '1' || value === 'ON') {
      return 'ON';
    }
    if (value === '0' || value === 'OFF') {
      return 'OFF';
    }
    return 'UNKNOWN';
  }

  normalizeMode(value: string): string {
    if (value === 'AUTO' || value === 'HUMAN' || value === 'VOICE') {
      return value;
    }
    return 'UNKNOWN';
  }

  applyConfirmedAssistantAction(action: AssistantPendingAction) {
    if (action.action === 'Light') {
      this.lampst = action.value;
    }
    if (action.action === 'CtlMode') {
      this.pendingMode = action.value;
      this.pendingModeSince = Date.now();
      this.ctlMode = action.value;
      this.isModeLoading = true;
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
    Column({ space: 12 }) {
      Row({ space: 12 }) {
        Column({ space: 6 }) {
          Text('温度')
            .fontSize(19)
            .fontColor('#4B5563')
          Text(this.temp + '°C')
            .fontSize(30)
            .fontWeight(FontWeight.Bold)
            .fontColor('#1D4ED8')
        }
        .layoutWeight(1)
        .height(96)
        .padding(14)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#EFF6FF')
        .borderRadius(8)

        Column({ space: 6 }) {
          Text('湿度')
            .fontSize(19)
            .fontColor('#4B5563')
          Text(this.humi + '%')
            .fontSize(30)
            .fontWeight(FontWeight.Bold)
            .fontColor('#047857')
        }
        .layoutWeight(1)
        .height(96)
        .padding(14)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#ECFDF5')
        .borderRadius(8)
      }
      .width('100%')

      Row({ space: 12 }) {
        Column({ space: 6 }) {
          Text('光照')
            .fontSize(19)
            .fontColor('#4B5563')
          Text(this.lumi)
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .fontColor('#B45309')
        }
        .layoutWeight(1)
        .height(96)
        .padding(14)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#FFFBEB')
        .borderRadius(8)

        Column({ space: 6 }) {
          Text('距离')
            .fontSize(19)
            .fontColor('#4B5563')
          Text(this.dist)
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .fontColor('#B91C1C')
        }
        .layoutWeight(1)
        .height(96)
        .padding(14)
        .justifyContent(FlexAlign.Center)
        .backgroundColor('#FEF2F2')
        .borderRadius(8)
      }
      .width('100%')

      Row({ space: 12 }) {
        Column({ space: 6 }) {
          Text('灯光')
            .fontSize(19)
            .fontColor('#4B5563')
          Text(this.getLampText())
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.isLampOn() ? '#047857' : '#6B7280')
        }
        .layoutWeight(1)
        .height(92)
        .padding(14)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(Color.White)
        .border({ width: 1, color: '#E5E7EB', radius: 8 })

        Column({ space: 6 }) {
          Text('模式')
            .fontSize(19)
            .fontColor('#4B5563')
          Text(this.getModeText(this.ctlMode))
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .fontColor('#1D4ED8')
        }
        .layoutWeight(1)
        .height(92)
        .padding(14)
        .justifyContent(FlexAlign.Center)
        .backgroundColor(Color.White)
        .border({ width: 1, color: '#E5E7EB', radius: 8 })
      }
      .width('100%')
    }
    .width('100%')
  }

  @Builder
  DebugRows() {
    Row() {
      Text('Token长度:')
        .fontSize(14)
        .fontColor(Color.Gray)
        .width(90)
      Text(this.debugTokenLength)
        .fontSize(14)
        .fontColor('#333333')
        .flexGrow(1)
    }
    .width('100%')

    Row() {
      Text('响应码:')
        .fontSize(14)
        .fontColor(Color.Gray)
        .width(90)
      Text(this.debugResponseCode)
        .fontSize(14)
        .fontColor('#333333')
        .flexGrow(1)
    }
    .width('100%')

    Row() {
      Text('响应长度:')
        .fontSize(14)
        .fontColor(Color.Gray)
        .width(90)
      Text(this.debugResponseLength)
        .fontSize(14)
        .fontColor('#333333')
        .flexGrow(1)
    }
    .width('100%')

    Row() {
      Text('提取结果:')
        .fontSize(14)
        .fontColor(Color.Gray)
        .width(90)
      Text(this.debugExtracted)
        .fontSize(14)
        .fontColor('#333333')
        .flexGrow(1)
    }
    .width('100%')
  }

  @Builder
  AssistantPanel() {
    Column({ space: 14 }) {
      Text('文字助手')
        .fontSize(22)
        .fontWeight(FontWeight.Bold)
        .fontColor('#111827')
        .width('100%')

      Text(this.assistantReplyText)
        .fontSize(18)
        .fontColor('#1F2937')
        .width('100%')
        .padding(16)
        .backgroundColor('#F8FAFC')
        .borderRadius(8)

      if (this.assistantPendingActionName !== '') {
        Column({ space: 12 }) {
          Text(this.assistantPendingQuestion)
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor('#111827')
            .width('100%')
          Text('确认后才会通过后端下发设备命令。')
            .fontSize(16)
            .fontColor('#6B7280')
            .width('100%')
          Row({ space: 10 }) {
            Button(this.isAssistantConfirmLoading ? '执行中' : '确认执行')
              .height(52)
              .layoutWeight(1)
              .fontSize(18)
              .backgroundColor('#2563EB')
              .fontColor(Color.White)
              .enabled(!this.isAssistantConfirmLoading)
              .onClick(() => {
                this.confirmAssistantAction();
              })
            Button('取消')
              .height(52)
              .layoutWeight(1)
              .fontSize(18)
              .backgroundColor('#E5E7EB')
              .fontColor('#111827')
              .onClick(() => {
                this.cancelAssistantAction();
              })
          }
          .width('100%')
        }
        .width('100%')
        .padding(16)
        .backgroundColor('#FFF7E6')
        .borderRadius(8)
      }

      Row({ space: 10 }) {
        Button('查看状态')
          .height(50)
          .layoutWeight(1)
          .fontSize(17)
          .backgroundColor('#E5E7EB')
          .fontColor('#111827')
          .onClick(() => {
            this.sendAssistantMessage('查看当前状态');
          })
        Button('开灯')
          .height(50)
          .layoutWeight(1)
          .fontSize(17)
          .backgroundColor('#E5E7EB')
          .fontColor('#111827')
          .onClick(() => {
            this.sendAssistantMessage('开灯');
          })
        Button('关灯')
          .height(50)
          .layoutWeight(1)
          .fontSize(17)
          .backgroundColor('#E5E7EB')
          .fontColor('#111827')
          .onClick(() => {
            this.sendAssistantMessage('关灯');
          })
      }
      .width('100%')

      Row({ space: 8 }) {
        TextInput({ placeholder: '输入：现在家里怎么样？', text: this.assistantInput })
          .fontSize(18)
          .height(54)
          .layoutWeight(1)
          .padding({ left: 12, right: 12 })
          .border({ width: 1, color: '#CBD5E1', radius: 8 })
          .onChange((value: string) => {
            this.assistantInput = value;
          })
        Button(this.isAssistantChatLoading ? '发送中' : '发送')
          .width(88)
          .height(54)
          .fontSize(18)
          .backgroundColor('#2563EB')
          .fontColor(Color.White)
          .enabled(!this.isAssistantChatLoading && !this.isAssistantConfirmLoading)
          .onClick(() => {
            this.sendAssistantMessage();
          })
      }
      .width('100%')
    }
    .width('100%')
    .padding(18)
    .backgroundColor(Color.White)
    .border({ width: 1, color: '#E5E7EB', radius: 8 })
  }

  build() {
    Scroll() {
      Column({ space: 18 }) {
        Text('家中设备状态')
          .fontSize(30)
          .fontWeight(FontWeight.Bold)
          .fontColor('#111827')
          .width('100%')
          .margin({ top: 16 })

        Text(this.statusMessage)
          .fontSize(18)
          .fontColor('#4B5563')
          .width('100%')
          .padding(14)
          .backgroundColor('#F8FAFC')
          .borderRadius(8)

        this.DeviceDataRows()

        Column({ space: 14 }) {
          Text('常用操作')
            .fontSize(22)
            .fontWeight(FontWeight.Bold)
            .fontColor('#111827')
            .width('100%')

          Button(this.isLampOn() ? '关闭灯光' : '打开灯光')
            .fontSize(22)
            .fontWeight(FontWeight.Medium)
            .height(60)
            .backgroundColor(this.isLampOn() ? '#DC2626' : '#16A34A')
            .fontColor(Color.White)
            .width('100%')
            .enabled(!this.isLampLoading)
            .onClick(() => {
              this.controlLamp(this.isLampOn() ? 'OFF' : 'ON');
            })

          Row({ space: 10 }) {
            Button('自动')
              .height(56)
              .layoutWeight(1)
              .fontSize(18)
              .backgroundColor(this.ctlMode === 'AUTO' ? '#2563EB' : '#E5E7EB')
              .fontColor(this.ctlMode === 'AUTO' ? Color.White : '#111827')
              .onClick(() => {
                this.controlMode('AUTO');
              })
            Button('人工')
              .height(56)
              .layoutWeight(1)
              .fontSize(18)
              .backgroundColor(this.ctlMode === 'HUMAN' ? '#2563EB' : '#E5E7EB')
              .fontColor(this.ctlMode === 'HUMAN' ? Color.White : '#111827')
              .onClick(() => {
                this.controlMode('HUMAN');
              })
            Button('语音')
              .height(56)
              .layoutWeight(1)
              .fontSize(18)
              .backgroundColor(this.ctlMode === 'VOICE' ? '#2563EB' : '#E5E7EB')
              .fontColor(this.ctlMode === 'VOICE' ? Color.White : '#111827')
              .onClick(() => {
                this.controlMode('VOICE');
              })
          }
          .width('100%')

          Row({ space: 10 }) {
            Button('视频监控')
              .height(56)
              .layoutWeight(1)
              .fontSize(18)
              .fontWeight(FontWeight.Medium)
              .backgroundColor('#2563EB')
              .fontColor(Color.White)
              .onClick(() => {
                router.pushUrl({ url: 'pages/monitor' });
              })

            Button('本机摄像头')
              .height(56)
              .layoutWeight(1)
              .fontSize(18)
              .fontWeight(FontWeight.Medium)
              .backgroundColor('#374151')
              .fontColor(Color.White)
              .onClick(() => {
                router.pushUrl({ url: 'pages/PhoneCameraPage' });
              })
          }
          .width('100%')
        }
        .width('100%')
        .padding(18)
        .backgroundColor(Color.White)
        .border({ width: 1, color: '#E5E7EB', radius: 8 })

        this.AssistantPanel()
      }
      .width('100%')
      .padding({ left: 18, right: 18, bottom: 28 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F3F4F6')
  }
}
