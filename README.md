# myAPP

个人 H5 与 App 的合集仓库。每个应用使用一个独立的一级目录，新应用与 `dayList` 同级放置。

```text
myAPP/
├── dayList/       # 日程清单
├── future-app/    # 后续应用示例
└── README.md
```

## 配置约定

- `dayList/manifest.json` 保留在本机并由 Git 忽略，其中可填写真实 DCloud AppID。
- 仓库只提交不含真实值的 `manifest.example.json`；克隆后复制为 `manifest.json` 并填写自己的 AppID。
- `.env`、Android/iOS 签名材料、HBuilderX 本地状态和编译产物也统一忽略，避免未来应用误传隐私配置。

## 应用

- [`dayList`](./dayList/)：按日期管理任务的个人日程清单，支持 Web 与 Android App。
