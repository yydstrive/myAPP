# dayList

个人日程清单，使用 uni-app（Vue 3）开发，可发行到 Web 和 Android App。当前默认使用设备本地持久化存储；uniCloud 代码完整保留，供以后增加手动同步功能。

## 数据源开关

`config/data-source.js` 中的 `REMOTE_SYNC_ENABLED` 是代码级数据源开关，不会显示在页面中：

- `false`（当前默认）：任务只保存在当前浏览器或 App 的本地存储中，日常使用不会调用 `task-service`。
- `true`：恢复使用已有的 uniCloud `task-service` 云对象。

首次进入本地模式时，会把本设备已有的 `daylist-task-cache-v1` 缓存迁移到独立的本地任务存储中，全程不会访问云端。App 卸载或系统“清除数据”会删除本地任务。

## 首次在新电脑运行

1. 将 `manifest.example.json` 复制为 `manifest.json`。
2. 在本机的 `manifest.json` 中填写真实 DCloud AppID 和 Android 包名；该文件不会提交到 Git。
3. 使用 HBuilderX 打开本目录。本地模式无需关联服务空间；需要云同步时再把 `uniCloud-aliyun` 关联到自己的服务空间。
4. 云端部署与 Android 打包步骤见 [`DEPLOY.md`](./DEPLOY.md)。

## 同步口令开关

`uniCloud-aliyun/cloudfunctions/task-service/config.js` 中的 `SYNC_SECRET_ENABLED` 只控制云端同步口令。它与 `config/data-source.js` 中控制是否使用云端的数据源开关相互独立。
