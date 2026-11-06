# dsh-ui-skin-lab

DSH 平台外观实验室。两套预设：**极简（minimal）** 与 **像素（pixel）**，外加主色 / 圆角 / 动效三个旋钮。

- **只改样式**：不动组件、不加功能、不改行为。
- **值走官方通道**：`ctx.theme.overrideTokens()`，官方 presenter 写成 `body` 内联样式，
  优先级最高、自动跟随浅色/深色、卸载时自动撤回。
- **卸载即还原**：组件规则全部以 `html[data-dsu-skin]` 开头，属性一撤就失效。
- **加预设只加数据**：token 表在 `lib/client.js` 的 `PRESET_TOKENS`，组件规则在 `tokens.css`。

## 能力

| 能力 | 入口 | 存储 |
|---|---|---|
| 两套预设 | 设置页 / `__dsuSkinLab.select(id)` | `dsh-ui-skin-lab.preset` |
| 主色（6 色 + 跟随预设） | 设置页 / `.setBrand('#be185d')` | `dsh-ui-skin-lab.brand` |
| 圆角（直角/跟随/圆润） | 设置页 / `.setRadius('square')` | `dsh-ui-skin-lab.radius` |
| 动效开关 | 设置页 / `.setMotion(false)` | `dsh-ui-skin-lab.motion` |
| 停用自己（让位给别的皮肤） | 设置页 / `.disable()` | `dsh-ui-skin-lab.enabled` |
| 多套方案 | 设置页「方案」/ `.saveScheme(name)` / `.applyScheme(name)` | `dsh-ui-skin-lab.schemes` |
| 导出 / 导入配置 | 设置页按钮 / `.config` / `.importConfig(json)` | 走剪贴板 |

**正文字号不归皮肤管**（2026-11-06）：官方「通用 → 字体大小」更细（正文 10–22 步进、
代码/终端字号、三行字体族、快捷键、Host 持久化）。皮肤的字号旋钮已删除——它会覆盖官方设置。
字体族同理：用户在官方设了字体，皮肤自动让位。

**设置入口**：独立「外观」分区（注册 `settings.section`，id `skin`，在「模型」和「插件」之间），
不再是「通用」里的一行。

**多皮肤**（M5，2026-11-05）：同一时间只有一套皮肤上色，靠注册表 `window.__dshSkinHub` 选。
没选过 = 本包默认生效；选中别套则本包让位。第三方皮肤（`data-dsh-maid-atelier` 这类不走 hub 的）
仍按 `window.__dshSkinLock` 让位。详见 `ui/ARCHITECTURE.md` ADR-006 / ADR-007。

**与陪看插件（whale-sense）的关系：只有单向**。它读本皮肤的 `html[data-dsu-skin]` 和 `--dsw-*` 变量
自己做适配（像素形态、图标三态），**本包不感知它的存在**——包里 `grep -i sense` 为空。
这条边界是 2026-11-06 拆包时定的，别在包里加回任何具体客户的名字。

## 结构

| 文件 | 职责 |
|---|---|
| `lib/client.js` | token 值（`PRESET_TOKENS` / `SHARED_TOKENS` / `BRAND_PALETTE` / `RADIUS_SETS`）+ 装载/切换/清理/互斥 |
| `lib/index.js` | Host：只把 `tokens.css` 发出去（组件层用）+ 诊断日志 |
| `tokens.css` | 组件级结构覆盖：形态变量层、侧栏、头部、输入框、滚动条、代码块、交互组件、动效开关 |
| `selectors.json` | 所有依赖官方 DOM 的选择器登记表（含 risk、fallback、expect、实测基线） |
| `skin.json` | 皮肤清单：id / wiring.id / bodyAttr / 兼容版本 / multiSkin 协议。Host 启动时读一遍校验，不是死文件 |

token 值为什么放在 `client.js` 而不是单独的数据文件：Host 侧 `lib/index.js` 没有热重载
（改代码要禁用再启用，且本插件的行不在 profile patch 里，连改配置都不触发），
而 token 值会频繁调整——放进 client 才能跟 HMR 一起即时生效。

## 安装

在**本仓库根目录**执行（`install_bundle` 的 target 指向包目录）：

```bash
plugin_manager({ action: 'install_bundle', target: '<仓库根>/packages/dsh-ui-skin-lab' })
```

Windows 示例：仓库根是 `<repo>`，则 target 为 `<repo>/packages\dsh-ui-skin-lab`。
换机器时：克隆整个 UI 仓库 → 用新路径执行同一条命令 → 重启 DSH。**别手写 profile 的
`package.json` / `cordis.patch.yml`**。

**配套的素色基准皮肤**在 `packages/dsh-ui-skin-plain`（板块 B 要求的第二套，只验多皮肤框架）。
两套都装上之后，设置页「皮肤」那行会把它们列出来：选中哪套哪套生效，没选过就是本包。

## 自检

```bash
NODE=node
"$NODE" tests/check-tokens.mjs         # 14 个必需 token + 名字必须在官方白名单 + SHARED_TOKENS 校验
"$NODE" tests/check-contrast.mjs       # WCAG：正文/次要 ≥4.5，品牌 ≥3，次要文字在层 2/层 3 上 ≥4.5
"$NODE" tests/check-selectors.mjs      # 前缀纪律 + 选择器登记 + !important 必须在 force 里
"$NODE" tests/client-smoke.mjs         # 假 DOM 跑 apply：token 推送、旋钮覆写层、设置行、动效属性、cleanup
"$NODE" tests/skin-conflict.mjs        # M5 互斥：协议锁 / 特征标记 / 开关 / 停用清场（26 条）
"$NODE" tests/check-input-guard.mjs    # 脏 localStorage 值不许写进 token 层
"$NODE" tests/check-motion.mjs         # 系统级 prefers-reduced-motion 降级 + 手动开关 + pixel 硬切
"$NODE" tests/check-skins.mjs          # 多皮肤：两套同装 / 切换 / 让位顺序 / 卸载
"$NODE" tests/check-layout.mjs         # 交互组件只许写不占布局的属性
"$NODE" tests/check-structure.mjs      # 结构锚点基线（没回传会 SKIP）
"$NODE" tests/check-config.mjs         # 配置导出/导入/方案（往返一致、脏值拒绝）
"$NODE" tests/check-skin-manifest.mjs  # 皮肤清单与代码一致（含 dshCompatibility 与 peerDeps 对齐）
```

改完 `tokens.css` 要 `printf ' ' >> packages/dsh-ui-skin-lab/lib/client.js` 触发 HMR 才会生效。

## 文档

- 仓库根的 `HANDOVER.md`：交接文档（状态、坑、文件地图、命令）——**先读这个**。
- 仓库根的 `ARCHITECTURE.md`：分层、决策记录（ADR）、§4.1 组件消费矩阵、实测记录。
- 仓库根的 `DESIGN.md`：两套预设的视觉方向与数值。
