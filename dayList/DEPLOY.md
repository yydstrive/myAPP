# 日程清单部署与打包步骤

## 当前本地数据模式

`config/data-source.js` 中的 `REMOTE_SYNC_ENABLED` 当前为 `false`。在此模式下，任务的读取、添加、修改、完成、回收站和永久删除均只操作设备本地持久化存储，不调用 uniCloud。云对象和数据库代码仍完整保留。

本地数据保存在 App 的应用数据目录中，重启 App 或手机不会丢失；卸载 App、系统“清除数据”或更换手机不会自动迁移数据。

## Android 正式包

1. 在 HBuilderX 打开本 `dayList` 目录，确认 `manifest.json` 中应用名称为“日程清单”、包名为 `com.personal.daylist`，版本为 `1.0.2`（版本号 `102`）。
2. 选择“发行 → 原生 App-云打包”，只勾选 Android，启用“安心打包”，证书选择 DCloud 云端证书。
3. 后续升级继续使用同一 DCloud AppID、包名和云端证书；否则 Android 会将其视为不同签名，无法覆盖安装并保留本地数据。
4. 使用正式版打包；下载 APK 后先核验版本、签名和权限清单，再传到小米 14 安装。

当前权限配置会强制移除存储、设备信息、媒体读取和安装应用等非必要权限，只保留网络及网络状态权限，供以后手动同步使用。侧载应用即使签名有效，HyperOS 仍可能显示“来源未知”或安全扫描提示；有效 release 签名可以避免“未签名/签名损坏”，但不能替代应用商店信誉审核。

## 保留的 uniCloud 部署流程

1. 将 `manifest.example.json` 复制为不会提交到 Git 的 `manifest.json`，并填写真实 DCloud AppID 和 Android 包名。
2. 在 HBuilderX 中打开本 `dayList` 目录。
3. 在项目树中右键 `uniCloud-aliyun`，关联自己的 uniCloud 服务空间。
4. 上传 `uniCloud-aliyun/database` 下的全部 DB Schema。
5. 上传部署 `uniCloud-aliyun/cloudfunctions/task-service`。如果出现依赖选项，选择云端安装依赖。
6. 把 `config/data-source.js` 中的 `REMOTE_SYNC_ENABLED` 临时改为 `true`，选择“运行 → 运行到浏览器”，确认页面能连接云对象；检查后改回 `false`。
7. H5 测试完成后选择“发行 → 网站-PC Web或手机H5”，勾选把编译资源部署到前端网页托管。
8. 使用前端网页托管控制台显示的默认域名在手机浏览器访问。

不要提交 `manifest.json`、同步口令、Android keystore、证书或签名密码。
