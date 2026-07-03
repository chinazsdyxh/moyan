import { prompt, router } from "@kit.ArkUI";
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

  // 初始化本地存储
  async initPrefs() {
    try {
      let ctx = getContext(this);
      this.prefs = await Preferences.getPreferences(ctx, 'login_info');
      this.loadAccount();
    } catch (e) {
      prompt.showToast({ message: '初始化失败' });
    }
  }

  // 加载保存的账号
  async loadAccount() {
    if (!this.prefs) return;

    let user = await this.prefs.get('username', '');
    let pwd = await this.prefs.get('password', '');
    this.username = user as string;
    this.password = pwd as string;
  }

  // 保存账号到本地
  async saveAccount() {
    if (!this.prefs) return;

    await this.prefs.put('username', this.username);
    await this.prefs.put('password', this.password);
    await this.prefs.flush(); // 记得flush，不然可能没保存
  }

  build() {
    Column({ space: 15 }) {
      Text("登录")
        .fontSize(20)
        .fontWeight(500)

      // 用户名输入
      TextInput({ placeholder: '用户名', text: this.username })
        .onChange((v) => this.username = v)
        .width('100%')
        .padding(10)
        .border({ width: 1, color: '#ccc', radius: 4 })

      // 密码输入
      TextInput({ placeholder: '密码', text: this.password })
        .type(InputType.Password)
        .onChange((v) => this.password = v)
        .width('100%')
        .padding(10)
        .border({ width: 1, color: '#ccc', radius: 4 })

      // 登录按钮
      Button("登录")
        .width('100%')
        .height(40)
        .onClick(async () => {
          if (this.username && this.password) {
            await this.saveAccount();
            router.replaceUrl({ url: 'pages/DisplayPage' }); // 补充路径，跳转到首页
          } else {
            prompt.showToast({ message: '请输入完整' });
          }
        })

    }
    .width('80%')
    .padding(20)
  }
}
