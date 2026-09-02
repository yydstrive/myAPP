# 日程清单部署步骤

1. 将 `manifest.example.json` 复制为不会提交到 Git 的 `manifest.json`，并填写真实 DCloud AppID 和 Android 包名。
2. 在 HBuilderX 中打开本 `dayList` 目录。
3. 在项目树中右键 `uniCloud-aliyun`，关联自己的 uniCloud 服务空间。
4. 上传 `uniCloud-aliyun/database` 下的全部 DB Schema。
5. 上传部署 `uniCloud-aliyun/cloudfunctions/task-service`。如果出现依赖选项，选择云端安装依赖。
6. 选择“运行 → 运行到浏览器”，确认页面能连接云对象。
7. H5 测试完成后选择“发行 → 网站-PC Web或手机H5”，勾选把编译资源部署到前端网页托管。
8. 使用前端网页托管控制台显示的默认域名在手机浏览器访问。

不要提交 `manifest.json`、同步口令、Android keystore、证书或签名密码。
