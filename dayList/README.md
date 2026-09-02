# dayList

个人日程清单，使用 uni-app（Vue 3）和 uniCloud 阿里云服务空间开发，可发行到 Web 和 Android App。

## 首次在新电脑运行

1. 将 `manifest.example.json` 复制为 `manifest.json`。
2. 在本机的 `manifest.json` 中填写真实 DCloud AppID 和 Android 包名；该文件不会提交到 Git。
3. 使用 HBuilderX 打开本目录，并把 `uniCloud-aliyun` 关联到自己的服务空间。
4. 按 [`DEPLOY.md`](./DEPLOY.md) 上传数据库 Schema、云对象和 Web 页面。

## 同步口令开关

`uniCloud-aliyun/cloudfunctions/task-service/config.js` 中的 `SYNC_SECRET_ENABLED` 是云端同步口令开关。调试时可设为 `false`，正式发布前应设为 `true` 并重新上传云对象。
