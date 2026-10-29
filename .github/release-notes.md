## 安装说明（中文）

Roomtone Lynx 需要连接 [Roomtone 服务端](https://github.com/leonzy/roomtone)。按平台选择安装包；测试包下载见 Actions，正式版本见 Release。

| 平台 | 制品 | 安装方式 |
| --- | --- | --- |
| Android | `roomtone-lynx-android.apk` | 正式包使用发布签名；测试包为 `roomtone-lynx-android-test.apk`，使用测试签名。 |
| iOS | `roomtone-lynx-ios-nosign.ipa` | 使用自己的证书和适用于目标设备的 profile 重签。 |
| HarmonyOS | `roomtone-lynx-harmony.hap` | 正式包使用设备授权签名；`roomtone-lynx-harmony-unsigned.hap` 为未签名测试包，需自行签名。 |
| Web 独立部署 | `roomtone-lynx-web-standalone.tar.gz` | 解压到静态服务器，填写 Roomtone API 地址。 |
| Web 同源部署 | `roomtone-lynx-web-embedded.tar.gz` | 解压并配置同源静态服务；不自动替换服务器内嵌前端。 |

[完整安装指南](https://github.com/leonzy/roomtone-player-lynx/blob/main/README.md#安装与下载)。测试包不进入正式 Release 或自动更新通道。

## Installation (English)

Connect Roomtone Lynx to a running [Roomtone server](https://github.com/leonzy/roomtone). Test packages are available as Actions artifacts; signed releases are published separately.

| Platform | Asset | Installation |
| --- | --- | --- |
| Android | `roomtone-lynx-android.apk` | Releases use a release key; `roomtone-lynx-android-test.apk` uses a test key. |
| iOS | `roomtone-lynx-ios-nosign.ipa` | Re-sign with your own certificate and a profile authorizing the target device. |
| HarmonyOS | `roomtone-lynx-harmony.hap` | Releases require device-authorized signing; re-sign `roomtone-lynx-harmony-unsigned.hap` before installation. |
| Web standalone | `roomtone-lynx-web-standalone.tar.gz` | Extract to a static host, then configure the Roomtone API address. |
| Web same origin | `roomtone-lynx-web-embedded.tar.gz` | Configure same-origin hosting; it does not replace the backend's embedded frontend automatically. |

[Full installation guide](https://github.com/leonzy/roomtone-player-lynx/blob/main/README.en.md#installation-and-downloads). Test packages are excluded from formal Releases and automatic updates.
