import socket from '@ohos.net.socket';
import image from '@ohos.multimedia.image';
import router from '@ohos.router';

interface SocketMessage {
  message: ArrayBuffer;
  remoteInfo: socket.SocketRemoteInfo;
}

@Entry
@Component
struct VideoStreamPage {
  @State ipAddress: string = '';
  @State port: string = '8080';
  @State isConnected: boolean = false;
  @State imageSrc: PixelMap | null = null;
  @State statusMessage: string = '未连接';
  @State frameCount: number = 0;
  @State currentFps: number = 0;
  @State bufferSizeKb: number = 0;
  @State lastFrameSizeKb: number = 0;
  @State isDecoding: boolean = false;
  @State packetCount: number = 0;
  @State logs: string[] = ['日志已启动'];

  private tcpSocket: socket.TCPSocket | null = null;
  private buffer: Uint8Array = new Uint8Array(0);
  private fpsTimer: number = 0;
  private lastFrameCount: number = 0;

  addLog(message: string) {
    const now = new Date();
    const timeText = this.pad2(now.getHours()) + ':' + this.pad2(now.getMinutes()) + ':' + this.pad2(now.getSeconds());
    const nextLogs = [timeText + ' ' + message].concat(this.logs);
    if (nextLogs.length > 40) {
      this.logs = nextLogs.slice(0, 40);
    } else {
      this.logs = nextLogs;
    }
  }

  pad2(value: number): string {
    return value < 10 ? '0' + value : String(value);
  }

  aboutToDisappear() {
    this.disconnect();
  }

  async connectToServer() {
    if (this.isConnected) {
      return;
    }

    if (this.ipAddress.trim().length === 0) {
      this.statusMessage = '请输入摄像头 IP 地址';
      this.addLog('连接取消: 未输入 IP');
      return;
    }

    try {
      this.statusMessage = '正在连接...';
      this.addLog('开始连接 ' + this.ipAddress.trim() + ':' + this.port);
      this.tcpSocket = socket.constructTCPSocketInstance();

      const connectOptions: socket.TCPConnectOptions = {
        address: {
          address: this.ipAddress.trim(),
          port: Number(this.port),
          family: 1
        },
        timeout: 10000
      };

      await this.tcpSocket.connect(connectOptions);
      this.isConnected = true;
      this.statusMessage = '已连接，等待视频画面';
      this.addLog('连接成功');
      this.startFpsTimer();
      this.startReceivingData();
    } catch (error) {
      console.error('Camera socket connect failed:', error);
      this.isConnected = false;
      this.statusMessage = '连接失败';
      this.addLog('连接失败: ' + JSON.stringify(error));
    }
  }

  startReceivingData() {
    if (!this.tcpSocket) {
      return;
    }

    this.tcpSocket.on('message', (value: SocketMessage) => {
      this.processReceivedData(value.message);
    });

    this.tcpSocket.on('error', (err: Error) => {
      console.error('Camera socket error:', err);
      this.statusMessage = '连接异常';
      this.addLog('Socket 异常: ' + JSON.stringify(err));
      this.disconnect();
    });

    this.tcpSocket.on('close', () => {
      console.info('Camera socket closed');
      this.addLog('Socket 已关闭');
      this.disconnect();
    });
  }

  async processReceivedData(data: ArrayBuffer) {
    try {
      this.packetCount++;
      const newData = new Uint8Array(data);
      const tempBuffer = new Uint8Array(this.buffer.length + newData.length);
      tempBuffer.set(this.buffer);
      tempBuffer.set(newData, this.buffer.length);
      this.buffer = tempBuffer;
      this.bufferSizeKb = Math.round(this.buffer.length / 1024);

      const startMarker = this.findJpegStart(this.buffer);
      if (startMarker === -1) {
        if (this.buffer.length > 1024 * 512) {
          this.buffer = new Uint8Array(0);
          this.bufferSizeKb = 0;
          this.addLog('缓冲超过 512KB 且未找到 JPEG 开始标记，已清空');
        }
        return;
      }

      const endMarker = this.findJpegEnd(this.buffer, startMarker);
      if (endMarker === -1) {
        return;
      }

      const jpegData = this.buffer.slice(startMarker, endMarker + 2);
      this.lastFrameSizeKb = Math.round(jpegData.length / 1024);
      await this.decodeAndDisplayImage(jpegData);
      this.buffer = this.buffer.slice(endMarker + 2);
      this.bufferSizeKb = Math.round(this.buffer.length / 1024);
      if (this.frameCount > 0 && this.frameCount % 10 === 0) {
        this.addLog('已显示 ' + this.frameCount + ' 帧，最近帧 ' + this.lastFrameSizeKb + 'KB，缓冲 ' +
          this.bufferSizeKb + 'KB');
      }
    } catch (error) {
      console.error('Camera frame process failed:', error);
      this.statusMessage = '视频帧处理失败';
      this.addLog('视频帧处理失败: ' + JSON.stringify(error));
    }
  }

  findJpegStart(buffer: Uint8Array): number {
    for (let index = 0; index < buffer.length - 1; index++) {
      if (buffer[index] === 0xFF && buffer[index + 1] === 0xD8) {
        return index;
      }
    }
    return -1;
  }

  findJpegEnd(buffer: Uint8Array, startIndex: number): number {
    for (let index = startIndex + 2; index < buffer.length - 1; index++) {
      if (buffer[index] === 0xFF && buffer[index + 1] === 0xD9) {
        return index;
      }
    }
    return -1;
  }

  async decodeAndDisplayImage(jpegData: Uint8Array) {
    try {
      this.isDecoding = true;
      const imageSource = image.createImageSource(jpegData.buffer);
      const decodingOptions: image.DecodingOptions = {
        desiredSize: {
          height: 480,
          width: 640
        },
        desiredPixelFormat: 3,
        desiredRegion: {
          size: {
            height: 480,
            width: 640
          },
          x: 0,
          y: 0
        }
      };

      const pixelMap: PixelMap = await imageSource.createPixelMap(decodingOptions);
      this.imageSrc = pixelMap;
      this.frameCount++;
    } catch (error) {
      console.error('Camera image decode failed:', error);
      this.statusMessage = '图像解码失败';
      this.addLog('图像解码失败: ' + JSON.stringify(error));
    } finally {
      this.isDecoding = false;
    }
  }

  startFpsTimer() {
    this.stopFpsTimer();
    this.lastFrameCount = this.frameCount;
    this.currentFps = 0;
    this.fpsTimer = setInterval(() => {
      const fps = this.frameCount - this.lastFrameCount;
      this.lastFrameCount = this.frameCount;
      this.currentFps = fps;
      if (this.isConnected) {
        this.statusMessage = '接收中，FPS ' + this.currentFps + '，总帧数 ' + this.frameCount +
          '，缓冲 ' + this.bufferSizeKb + 'KB';
      }
    }, 1000);
  }

  stopFpsTimer() {
    if (this.fpsTimer !== 0) {
      clearInterval(this.fpsTimer);
      this.fpsTimer = 0;
    }
  }

  disconnect() {
    this.stopFpsTimer();
    if (this.tcpSocket) {
      this.addLog('断开连接');
      this.tcpSocket.off('message');
      this.tcpSocket.off('error');
      this.tcpSocket.off('close');
      this.tcpSocket.close();
      this.tcpSocket = null;
    }
    this.isConnected = false;
    this.buffer = new Uint8Array(0);
    this.currentFps = 0;
    this.bufferSizeKb = 0;
    this.lastFrameSizeKb = 0;
    this.isDecoding = false;
    this.lastFrameCount = this.frameCount;
    if (this.statusMessage !== '连接失败' && this.statusMessage !== '请输入摄像头 IP 地址') {
      this.statusMessage = '未连接';
    }
  }

  goBack() {
    this.disconnect();
    router.back();
  }

  build() {
    Scroll() {
      Column({ space: 18 }) {
        Row() {
          Button('返回')
            .width(72)
            .height(48)
            .backgroundColor('#E5E7EB')
            .fontColor('#111827')
            .fontSize(18)
            .onClick(() => {
              this.goBack();
            })

          Text('视频监控')
            .fontSize(28)
            .fontWeight(FontWeight.Bold)
            .fontColor('#111827')
            .textAlign(TextAlign.Center)
            .flexGrow(1)

          Blank()
            .width(72)
        }
        .width('100%')
        .margin({ top: 12 })

        Text(this.statusMessage)
          .fontSize(18)
          .fontColor(this.isConnected ? '#047857' : '#4B5563')
          .width('100%')
          .padding(14)
          .backgroundColor('#F8FAFC')
          .borderRadius(8)

        Column({ space: 14 }) {
          Text('摄像头 IP 地址')
            .fontSize(20)
            .fontWeight(FontWeight.Medium)
            .fontColor('#111827')
            .width('100%')

          TextInput({ placeholder: '例如 192.168.43.98', text: this.ipAddress })
            .width('100%')
            .height(56)
            .fontSize(18)
            .border({ width: 1, color: '#CBD5E1', radius: 8 })
            .padding({ left: 12, right: 12 })
            .enabled(!this.isConnected)
            .onChange((value: string) => {
              this.ipAddress = value;
            })

          Text('端口号')
            .fontSize(20)
            .fontWeight(FontWeight.Medium)
            .fontColor('#111827')
            .width('100%')
            .margin({ top: 4 })

          TextInput({ placeholder: '8080', text: this.port })
            .width('100%')
            .height(56)
            .fontSize(18)
            .type(InputType.Number)
            .border({ width: 1, color: '#CBD5E1', radius: 8 })
            .padding({ left: 12, right: 12 })
            .enabled(!this.isConnected)
            .onChange((value: string) => {
              this.port = value;
            })
        }
        .width('100%')
        .padding(18)
        .alignItems(HorizontalAlign.Start)
        .backgroundColor(Color.White)
        .border({ width: 1, color: '#E5E7EB', radius: 8 })

        Row({ space: 12 }) {
          Button(this.isConnected ? '断开连接' : '开始连接')
            .height(58)
            .layoutWeight(1)
            .fontSize(20)
            .backgroundColor(this.isConnected ? '#DC2626' : '#2563EB')
            .fontColor(Color.White)
            .onClick(() => {
              if (this.isConnected) {
                this.disconnect();
              } else {
                this.connectToServer();
              }
            })

          Button('清空画面')
            .height(58)
            .layoutWeight(1)
            .fontSize(20)
            .backgroundColor('#374151')
            .fontColor(Color.White)
            .onClick(() => {
              this.imageSrc = null;
              this.frameCount = 0;
              this.currentFps = 0;
              this.bufferSizeKb = 0;
              this.lastFrameSizeKb = 0;
              this.packetCount = 0;
              this.lastFrameCount = 0;
              this.addLog('已清空图像和统计');
            })
        }
        .width('100%')

        Stack({ alignContent: Alignment.Center }) {
          if (this.imageSrc) {
            Image(this.imageSrc)
              .width('100%')
              .height('100%')
              .objectFit(ImageFit.Contain)
          } else {
            Column({ space: 10 }) {
              Text('暂无图像')
                .fontSize(24)
                .fontWeight(FontWeight.Medium)
                .fontColor('#4B5563')
              Text('输入摄像头地址后点击开始连接')
                .fontSize(18)
                .fontColor('#6B7280')
            }
          }
        }
        .width('100%')
        .height(360)
        .border({ width: 1, color: '#CBD5E1', radius: 8 })
        .backgroundColor(Color.White)

        Column({ space: 8 }) {
          Text('连接信息')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor('#111827')
          Text('FPS ' + this.currentFps + ' | 缓冲 ' + this.bufferSizeKb + 'KB | 最近帧 ' +
            this.lastFrameSizeKb + 'KB')
            .fontSize(15)
            .fontColor('#6B7280')
            .width('100%')
          Text('状态: ' + (this.isDecoding ? '解码中' : '空闲') + ' | 数据包 ' + this.packetCount)
            .fontSize(15)
            .fontColor('#6B7280')
            .width('100%')
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding(14)
        .backgroundColor(Color.White)
        .border({ width: 1, color: '#E5E7EB', radius: 8 })

        Column({ space: 6 }) {
          Text('说明')
            .fontSize(18)
            .fontWeight(FontWeight.Medium)
            .fontColor('#111827')
          Text('1. 请确保手机和 ESP32 摄像头在同一网络。')
            .fontSize(16)
            .fontColor('#6B7280')
          Text('2. 默认端口为 8080，可按实际固件修改。')
            .fontSize(16)
            .fontColor('#6B7280')
          Text('3. 日志信息仅用于排查连接问题。')
            .fontSize(16)
            .fontColor('#6B7280')
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .padding(14)
        .backgroundColor(Color.White)
        .border({ width: 1, color: '#E5E7EB', radius: 8 })
        .margin({ bottom: 24 })
      }
      .width('100%')
      .padding({ left: 18, right: 18 })
      .alignItems(HorizontalAlign.Center)
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F3F4F6')
  }
}
