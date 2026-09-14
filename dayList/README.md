# dayList

个人日程与周期管理应用，使用 uni-app（Vue 3）开发，可发行到 Web 和 Android App。底部提供两个互相独立的功能模块：

- **日程**：原有日程清单的全部页面和功能，包括日期任务、优先级、搜索、分类列表、逾期统计及回收站。
- **周期**：独立管理周期项目，主页支持周视图和月视图、今日快速打卡以及上次与预计下次日期；详情页提供月历补签、打卡备注、取消打卡、全部历史、单次间隔和平均间隔，并可修改已有项目设置。项目可设置按天或按月的可选周期间隔，并支持停用、恢复和永久删除。

两个模块共用视觉基调和底部导航，但业务组件、数据服务及本地存储完全分开。长按底部的“日程”或“周期”可将其设置为下次打开 App 时优先显示的首页。当前默认使用设备本地持久化存储；日程模块的 uniCloud 代码完整保留，供以后增加手动同步功能。

## 代码边界

- `pages/schedule/`：日程入口页与日程任务详情页。
- `modules/schedule/`：只属于日程的组件、日期工具和数据服务。
- `pages/cycle/`：周期入口页与周期项目详情页。
- `modules/cycle/`：只属于周期的编辑组件、日期工具和数据服务；使用 `daylist-cycle-items-v1`，不读取日程数据。
- `shared/`：仅包含底部模块导航、启动模块偏好和通用轻提示等无业务数据的公共能力。

这个边界允许日后将任一模块迁移到独立 App 时，连同对应的 `pages` 与 `modules` 目录一起拆出，不需要清理另一模块的业务依赖。

## 数据源开关

`config/data-source.js` 中的 `REMOTE_SYNC_ENABLED` 是日程模块的代码级数据源开关，不会显示在页面中：

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
