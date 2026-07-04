import { prompt, router } from '@kit.ArkUI';
import Preferences from '@ohos.data.preferences';

@Entry
@Component
struct LoginPage {
  @State username: string = '';
  @State password: string = '';

  prefs: Preferences.Preferences | null = null;

  aboutToAppear() {
    this.initPrefs();
  }

  async initPrefs() {
    try {
      let ctx = getContext(this);
      this.prefs = await Preferences.getPreferences(ctx, 'login_info');
      this.loadAccount();
    } catch (e) {
      prompt.showToast({ message: '初始化失败' });
    }
  }

  async loadAccount() {
    if (!this.prefs) {
      return;
    }

    let user = await this.prefs.get('username', '');
    let pwd = await this.prefs.get('password', '');
    this.username = user as string;
    this.password = pwd as string;
  }

  async saveAccount() {
    if (!this.prefs) {
      return;
    }

    await this.prefs.put('username', this.username);
    await this.prefs.put('password', this.password);
    await this.prefs.flush();
  }

  build() {
    Column() {
      Blank()
        .height(64)

      Column({ space: 18 }) {
        Text('智能家居')
          .fontSize(32)
          .fontWeight(FontWeight.Bold)
          .fontColor('#1F2937')
          .width('100%')

        Text('请登录后查看家中设备状态')
          .fontSize(20)
          .fontColor('#4B5563')
          .width('100%')

        Column({ space: 14 }) {
          Text('账号')
            .fontSize(20)
            .fontWeight(FontWeight.Medium)
            .fontColor('#111827')
            .width('100%')

          TextInput({ placeholder: '请输入账号', text: this.username })
            .onChange((v: string) => {
              this.username = v;
            })
            .width('100%')
            .height(58)
            .fontSize(20)
            .padding({ left: 16, right: 16 })
            .backgroundColor(Color.White)
            .border({ width: 1, color: '#CBD5E1', radius: 8 })
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
        .margin({ top: 18 })

        Column({ space: 14 }) {
          Text('密码')
            .fontSize(20)
            .fontWeight(FontWeight.Medium)
            .fontColor('#111827')
            .width('100%')

          TextInput({ placeholder: '请输入密码', text: this.password })
            .type(InputType.Password)
            .onChange((v: string) => {
              this.password = v;
            })
            .width('100%')
            .height(58)
            .fontSize(20)
            .padding({ left: 16, right: 16 })
            .backgroundColor(Color.White)
            .border({ width: 1, color: '#CBD5E1', radius: 8 })
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)

        Button('登录')
          .width('100%')
          .height(60)
          .fontSize(22)
          .fontWeight(FontWeight.Medium)
          .backgroundColor('#2563EB')
          .fontColor(Color.White)
          .borderRadius(8)
          .margin({ top: 16 })
          .onClick(async () => {
            if (this.username && this.password) {
              await this.saveAccount();
              router.replaceUrl({ url: 'pages/DisplayPage' });
            } else {
              prompt.showToast({ message: '请填写账号和密码' });
            }
          })
      }
      .width('88%')
      .padding(24)
      .backgroundColor('#F8FAFC')
      .borderRadius(8)
    }
    .width('100%')
    .height('100%')
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(Color.White)
  }
}
