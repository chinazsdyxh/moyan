import abilityAccessCtrl from '@ohos.abilityAccessCtrl';
import type { Permissions } from '@ohos.abilityAccessCtrl';
import common from '@ohos.app.ability.common';
import camera from '@ohos.multimedia.camera';
import router from '@ohos.router';

const CAMERA_PERMISSION: Permissions = 'ohos.permission.CAMERA';

@Entry
@Component
struct PhoneCameraPage {
  @State statusMessage: string = '等待预览组件';
  @State isPreviewing: boolean = false;
  @State isMirrorCorrected: boolean = true;
  @State cameraInfo: string = '--';
  @State lastError: string = '--';

  private xComponentController: XComponentController = new XComponentController();
  private surfaceId: string = '';
  private cameraInput: camera.CameraInput | null = null;
  private previewOutput: camera.PreviewOutput | null = null;
  private captureSession: camera.Session | null = null;

  aboutToDisappear(): void {
    this.releaseCamera();
  }

  private getErrorMessage(error: Error): string {
    if (error.message.length > 0) {
      return error.message;
    }
    return JSON.stringify(error);
  }

  private async requestCameraPermission(): Promise<boolean> {
    try {
      const atManager = abilityAccessCtrl.createAtManager();
      const context = getContext(this) as common.UIAbilityContext;
      const result = await atManager.requestPermissionsFromUser(context, [CAMERA_PERMISSION]);
      const granted = result.authResults.length > 0 &&
        result.authResults[0] === abilityAccessCtrl.GrantStatus.PERMISSION_GRANTED;
      if (!granted) {
        this.statusMessage = '相机权限未授予';
        this.lastError = `权限结果: ${result.authResults.join(',')}`;
      }
      return granted;
    } catch (error) {
      const err = error as Error;
      this.statusMessage = '请求相机权限失败';
      this.lastError = this.getErrorMessage(err);
      return false;
    }
  }

  private pickBackCamera(cameras: Array<camera.CameraDevice>): camera.CameraDevice {
    for (let i = 0; i < cameras.length; i++) {
      if (cameras[i].cameraPosition === camera.CameraPosition.CAMERA_POSITION_BACK) {
        return cameras[i];
      }
    }
    return cameras[0];
  }

  private pickSceneMode(manager: camera.CameraManager, device: camera.CameraDevice): camera.SceneMode {
    const modes = manager.getSupportedSceneModes(device);
    for (let i = 0; i < modes.length; i++) {
      if (modes[i] === camera.SceneMode.NORMAL_PHOTO) {
        return modes[i];
      }
    }
    return modes[0];
  }

  private async startPreview(): Promise<void> {
    if (this.isPreviewing) {
      return;
    }

    if (this.surfaceId.length === 0) {
      this.surfaceId = this.xComponentController.getXComponentSurfaceId();
    }
    if (this.surfaceId.length === 0) {
      this.statusMessage = '预览 Surface 未就绪';
      return;
    }

    const hasPermission = await this.requestCameraPermission();
    if (!hasPermission) {
      return;
    }

    await this.releaseCamera();

    try {
      this.statusMessage = '正在打开摄像头';
      const context = getContext(this) as common.UIAbilityContext;
      const manager = camera.getCameraManager(context);
      const cameras = manager.getSupportedCameras();
      if (cameras.length === 0) {
        this.statusMessage = '没有检测到可用摄像头';
        return;
      }

      const device = this.pickBackCamera(cameras);
      const mode = this.pickSceneMode(manager, device);
      const capability = manager.getSupportedOutputCapability(device, mode);
      if (capability.previewProfiles.length === 0) {
        this.statusMessage = '摄像头不支持预览输出';
        return;
      }

      this.cameraInput = manager.createCameraInput(device);
      await this.cameraInput.open();

      this.previewOutput = manager.createPreviewOutput(capability.previewProfiles[0], this.surfaceId);
      this.captureSession = manager.createSession<camera.Session>(mode);
      this.captureSession.beginConfig();
      this.captureSession.addInput(this.cameraInput);
      this.captureSession.addOutput(this.previewOutput);
      await this.captureSession.commitConfig();
      await this.captureSession.start();

      this.isPreviewing = true;
      this.statusMessage = '本机摄像头预览中';
      this.cameraInfo =
        `${device.cameraId}, mode ${mode}, ${capability.previewProfiles[0].size.width}x${capability.previewProfiles[0].size.height}`;
      this.lastError = '--';
    } catch (error) {
      const err = error as Error;
      this.statusMessage = '启动摄像头失败';
      this.lastError = this.getErrorMessage(err);
      await this.releaseCamera();
    }
  }

  private async releaseCamera(): Promise<void> {
    try {
      if (this.captureSession !== null) {
        await this.captureSession.stop();
      }
    } catch (error) {
      const err = error as Error;
      this.lastError = this.getErrorMessage(err);
    }

    try {
      if (this.captureSession !== null) {
        await this.captureSession.release();
      }
    } catch (error) {
      const err = error as Error;
      this.lastError = this.getErrorMessage(err);
    }

    try {
      if (this.cameraInput !== null) {
        await this.cameraInput.close();
      }
    } catch (error) {
      const err = error as Error;
      this.lastError = this.getErrorMessage(err);
    }

    try {
      if (this.previewOutput !== null) {
        await this.previewOutput.release();
      }
    } catch (error) {
      const err = error as Error;
      this.lastError = this.getErrorMessage(err);
    }

    this.captureSession = null;
    this.cameraInput = null;
    this.previewOutput = null;
    this.isPreviewing = false;
    if (this.statusMessage === '本机摄像头预览中') {
      this.statusMessage = '预览已停止';
    }
  }

  build() {
    Column({ space: 18 }) {
      Row() {
        Button('返回')
          .fontSize(18)
          .height(48)
          .width(72)
          .backgroundColor('#E5E7EB')
          .fontColor('#111827')
          .onClick(() => {
            router.back();
          })
        Text('本机摄像头')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor('#111827')
          .layoutWeight(1)
          .textAlign(TextAlign.Center)
        Blank()
          .width(72)
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 14 })

      XComponent({
        id: 'phoneCameraPreview',
        type: XComponentType.SURFACE,
        controller: this.xComponentController
      })
        .width('100%')
        .height(380)
        .backgroundColor(Color.Black)
        .scale({ x: this.isMirrorCorrected ? -1 : 1, y: 1 })
        .onLoad(() => {
          this.surfaceId = this.xComponentController.getXComponentSurfaceId();
          if (this.surfaceId.length > 0) {
            this.statusMessage = '预览组件已就绪';
          }
        })
        .onDestroy(() => {
          this.releaseCamera();
        })

      Text(this.statusMessage)
        .fontSize(20)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.isPreviewing ? '#047857' : '#4B5563')
        .width('92%')
        .padding(14)
        .textAlign(TextAlign.Center)
        .backgroundColor('#F8FAFC')
        .borderRadius(8)

      Row({ space: 12 }) {
        Button(this.isPreviewing ? '停止预览' : '开启预览')
          .fontSize(20)
          .fontWeight(FontWeight.Medium)
          .height(58)
          .layoutWeight(1)
          .backgroundColor(this.isPreviewing ? '#DC2626' : '#16A34A')
          .fontColor(Color.White)
          .onClick(() => {
            if (this.isPreviewing) {
              this.releaseCamera();
            } else {
              this.startPreview();
            }
          })

        Button(this.isMirrorCorrected ? '关闭镜像' : '开启镜像')
          .fontSize(20)
          .height(58)
          .layoutWeight(1)
          .backgroundColor('#E5E7EB')
          .fontColor('#111827')
          .onClick(() => {
            this.isMirrorCorrected = !this.isMirrorCorrected;
          })
      }
      .justifyContent(FlexAlign.Center)
      .width('92%')

      Column({ space: 10 }) {
        Text(`摄像头: ${this.cameraInfo}`)
          .fontSize(16)
          .fontColor('#4B5563')
          .width('100%')
        Text(`错误: ${this.lastError}`)
          .fontSize(16)
          .fontColor('#6B7280')
          .width('100%')
      }
      .width('92%')
      .padding(14)
      .backgroundColor(Color.White)
      .border({ width: 1, color: '#E5E7EB', radius: 8 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F3F4F6')
  }
}
