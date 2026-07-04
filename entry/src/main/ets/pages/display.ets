@Entry
@Component
struct display {
  build() {
    Column({ space: 12 }) {
      Text('请使用主监控页面')
        .fontSize(24)
        .fontWeight(FontWeight.Bold)
        .fontColor('#111827')
      Text('如果看到这个页面，请返回后重新进入。')
        .fontSize(18)
        .fontColor('#4B5563')
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
    .alignItems(HorizontalAlign.Center)
    .backgroundColor(Color.White)
  }
}
