# dsh-ui-skin-lab

DeepSeek Harness（DSH）的平台外观层：把界面变成**风格化、可私人定制**的样子。

两套预设（极简 / 像素）、三个旋钮（主色 / 圆角 / 动效）、多套方案与配置导出。

- **只改样式**：不改 DSH 组件源码、不碰 `app.asar`；卸载即还原。
- **值走官方通道**：`ctx.theme.overrideTokens()` 写成 body 内联样式，自动跟随浅色 / 深色。
- **一套皮肤 + 两个预设**：接 `window.__dshSkinHub` 注册表，可与其他皮肤共存互斥。

## 包

| 包 | 作用 |
|---|---|
| `packages/dsh-ui-skin-lab` | 主皮肤：minimal / pixel 两预设 + 主色 / 圆角 / 动效 |
| `packages/dsh-ui-skin-plain` | 素色基准皮肤（只为验证多皮肤框架，不做视觉） |

## 安装

在 DSH 里用 `plugin_manager`：

```
install_bundle  target: <仓库根>/packages/dsh-ui-skin-lab
```

分发包也可以：`cd packages/dsh-ui-skin-lab && pnpm pack`，再把 `install_bundle` 指向产出的 `.tgz`。
**装完要重启 DSH**——换包不会热重载（见 `HANDOVER.md` §3.12）。

## 使用

设置 →「外观」：皮肤 / 风格 / 主色 / 圆角 / 动效 / 方案 / 导出导入 / 停用。

控制台：`__dsuSkinLab.select('pixel')`、`.setBrand('#be185d')`、`.setRadius('square')`、
`.setMotion(false)`、`.saveScheme('night')`。

## 兼容

- DSH `>=0.2.0-rc.2 <0.3.0-0`
- 在 `0.2.2-rc.1` 上验证：十二项自检全绿、结构锚点全在、卸载/重装/回默认全过

## 开发

```bash
NODE=node
"$NODE" tests/check-tokens.mjs && "$NODE" tests/check-contrast.mjs && ...
```

完整十二项、目录结构、HMR 触发方式见 `packages/dsh-ui-skin-lab/README.md` 与仓库根的 `HANDOVER.md`。

## 文档

| 文件 | 内容 |
|---|---|
| `HANDOVER.md` | 交接文档：状态、坑、文件地图、命令 —— **先读这个** |
| `ARCHITECTURE.md` | 分层模型、ADR-001~010、组件消费矩阵、实测记录 |
| `DESIGN.md` | 两套预设的视觉规范（含动效与图标） |
| `UPGRADE-BASELINE.md` | DSH 升级前后快照与验证结果 |

## 许可

MIT
