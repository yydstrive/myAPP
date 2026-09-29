# dayList Android 打包说明

本文记录已经在 Windows、HBuilderX 5.24 上跑通的 Android 安心云打包流程，供后续版本直接复用。

## 固定路径与配置

- HBuilderX：`E:\Official Software\HBuilderX`
- HBuilderX CLI：`E:\Official Software\HBuilderX\cli.exe`
- 项目目录：`E:\Codes\Codex\dayList\dayList`
- APK 输出目录：`E:\Codes\Codex\dayList\dayList\unpackage\release\apk`
- AppID：`__UNI__D1A8A80`
- Android 包名：`com.personal.daylist`
- 证书类型：DCloud 云端证书，即 `android.androidpacktype=3`
- 打包方式：安心打包，即 `safemode=true`
- 自定义基座、原生混淆、SourceMap 和广告：均关闭

云打包会向 DCloud 提交必要的打包资源。执行前应确认用户已经明确授权。

## 打包前检查

1. 同时更新 `manifest.json` 和 `manifest.example.json` 中的 `versionName`、`versionCode`。
2. 更新项目根目录的 `README.md` 和 `版本更新日志.md`。
3. 确认 `manifest.json` 的包名仍是 `com.personal.daylist`，不要切换证书类型。
4. 执行代码、JSON 与 `git diff --check` 校验。

## 已验证成功的命令

在同一个 PowerShell 会话中依次执行以下命令。`cli open`、等待、导入项目和 `cli pack` 不要拆成彼此独立的会话，否则可能提示“与主程序的连接已中断”。

```powershell
$hbuilderCli = 'E:\Official Software\HBuilderX\cli.exe'
$dayListProject = 'E:\Codes\Codex\dayList\dayList'

& $hbuilderCli open
Start-Sleep -Seconds 5
& $hbuilderCli project open --path $dayListProject
& $hbuilderCli pack `
  --project $dayListProject `
  --platform android `
  --iscustom false `
  --safemode true `
  --sourceMap false `
  --isconfusion false `
  --splashads false `
  --rpads false `
  --unimpads false `
  --android.packagename 'com.personal.daylist' `
  --android.androidpacktype 3
```

不要为了修复 CLI 连接而运行 `Stop-Process HBuilderX -Force`。它可能关闭用户正在使用的 HBuilderX 窗口并导致未保存内容丢失，也会触发安全审核拒绝。已有 HBuilderX 进程时，仍先在同一 PowerShell 会话执行一次 `cli open`，然后继续执行导入和打包命令即可。

## 输出文件命名

HBuilderX 成功后会生成类似下面的文件：

```text
__UNI__D1A8A80__YYYYMMDDHHMMSS.apk
```

保留这个原始文件，再复制一份作为正式发布文件：

```powershell
$generatedApk = 'E:\Codes\Codex\dayList\dayList\unpackage\release\apk\__UNI__D1A8A80__YYYYMMDDHHMMSS.apk'
$releaseApk = 'E:\Codes\Codex\dayList\dayList\unpackage\release\apk\dayList-X.Y.Z-release.apk'
Copy-Item -LiteralPath $generatedApk -Destination $releaseApk
```

## 打包后校验

HBuilderX 自带签名与 APK 解析工具：

```powershell
$java = (Get-Command java -ErrorAction Stop).Source
$apksigner = 'E:\Official Software\HBuilderX\plugins\app-safe-pack\apksigner.jar'
$apktool = 'E:\Official Software\HBuilderX\plugins\app-safe-pack\apktool.jar'
$releaseApk = 'E:\Codes\Codex\dayList\dayList\unpackage\release\apk\dayList-X.Y.Z-release.apk'

& $java -jar $apksigner verify --verbose --print-certs $releaseApk
Get-FileHash -LiteralPath $releaseApk -Algorithm SHA256

$verifyDir = Join-Path $env:TEMP ('daylist-apk-verify-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $verifyDir | Out-Null
& $java -jar $apktool d -f -s -o $verifyDir $releaseApk
Get-Content -LiteralPath (Join-Path $verifyDir 'apktool.yml') -TotalCount 25
Select-String -LiteralPath (Join-Path $verifyDir 'AndroidManifest.xml') -Pattern 'package=|versionCode|versionName'
```

验收标准：

- v1、v2 签名均为 `true`。
- 包名为 `com.personal.daylist`。
- APK 内 `versionName`、`versionCode` 与本次发布版本一致。
- 签名证书 SHA-256 指纹保持为 `8071c4c676fa2fbd57827f57b941cae6294664b7c19d5b132e660b3a34946291`，以确保可以覆盖安装旧版本。
- 将最终 APK 文件名和 SHA-256 写入 `版本更新日志.md`。

## 1.1.2 打包结果

- 自动生成文件：`__UNI__D1A8A80__20260930010938.apk`
- 正式文件：`dayList-1.1.2-release.apk`
- 文件大小：`17,554,384` 字节
- SHA-256：`440ae0d4883c7fef431c3f8c0f709e65f9ddf4beb37325d6358f957e723321e0`
- v1、v2 签名验证通过，签名证书与 1.1.1 一致。

## 注意事项

- HBuilderX 可能提示“缺少国内应用市场隐私配置”。个人安装或不在国内应用市场上架时不影响 APK 生成；如需上架，应先补齐隐私配置。
- App 云打包不会自动上传 `uniCloud-aliyun` 下的云对象、数据库 Schema 和索引；云端功能部署应另按项目根目录的 `DEPLOY.md` 执行。
- 本目录属于 `unpackage` 构建产物目录，默认不会被 Git 跟踪；清理 HBuilderX 构建产物前，应先备份本说明和需要保留的正式 APK。
