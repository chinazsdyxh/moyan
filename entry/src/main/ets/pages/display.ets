@Entry
@Component
struct display {
  build() {
    Column() {
      Text('请使用 DisplayPage 页面')
        .fontSize(18)
    }
    .width('100%')
    .height('100%')
    .justifyContent(FlexAlign.Center)
  }
}
