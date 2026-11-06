# DSH 升级前基线（2026-11-06 07:2x）

> 用途：哥哥要升级 DSH 桌面版。升级前先把「当前版本长什么样」拍成快照，
> 升级后照着 §5 跑一遍、跟 §3 对照，才能判断「崩没崩」。
>
> 所有数字都是**实测**，来源标在每行；推断会单独写「（推断）」。

---

## 1. 版本快照（升级前）

| 项 | 实测值 | 来源 |
|---|---|---|
| 安装 exe | `<DSH 安装目录>/DeepSeek Harness.exe` | 进程路径 |
| exe FileVersion | `0.2.1-rc.5` | `VersionInfo.FileVersion` |
| exe ProductVersion | `0.2.1.0` | 同上 |
| exe / app.asar mtime | `2026-10-29 22:02:52` | `stat` |
| asar 内 `@deepseek-ai/dsh-desktop-runtime` | `0.2.1-rc.5` | asar-peek 导出 `dsh/package.json` |
| runtime.json | `desktopVersion 0.2.1-rc.5` / node 24.21.0 / pnpm 11.28.5 / python 3.12.14 | `dsh-runtimes/dsh-primary-runtime/runtime.json` |
| payloadDigest | `e2cef445...` | 同上 |
| DSH_HOME | `$DSH_HOME`（`$DSH_HOME` 是指向它的 junction） | `Get-Item LinkType` |
| 进程启动 | 2026-11-06 07:06:01～21，共 7 个进程 | `Get-Process StartTime` |
| Web GUI | `http://127.0.0.1:50034` | 环境变量 `DSH_WEB_URL` |

**升级前结论**：exe/asar 的 mtime 停在 10-29，说明安装文件**还没被更新覆盖**；
页面左下角的「新版本」是**提示可更新**，不是已更新。升级动作在哥哥手里。

---

## 2. 架构依赖面（升级可能断的五个面）

### 2.1 官方 DOM 锚点（`selectors.json`，15 条）

| 类别 | 条数 | 明细 |
|---|---|---|
| present（页面常驻，命中 0 = 官方 DOM 变了） | 9 | `[data-slot]`、`[data-slot="sidebar"]`、`[class*="sidebarCol"]`、`header[class*="header"]`、`[data-slot="conversation.header"]`、`[data-composer-card]`、`[data-chat-flow-kind]`、`button`、`[role="tab"]` |
| conditional（只在特定状态渲染） | 5 | `.md-code-block`、`[role="menu"]`、`[role="dialog"]`、`[role="menuitem"]`、`[class*="bubble"]` |
| pseudo（不统计） | 1 | `::-webkit-scrollbar` |

`risk=medium` 的 4 条（sidebar-col / header / markdown-code-block / user-bubble）都有 fallback 或限定条件。

### 2.2 官方 token 层

- 白名单 `tests/official-tokens.json`：**419 个**官方 token 名（updatedAt 2026-11-05）。
- 皮肤覆盖的 103/104 个都必须在这 419 个里（`check-tokens` 强制）。
- 官方新增/改名 token → `check-tokens` 会红；皮肤引用了白名单外的名字也会红。

### 2.3 官方插件 API（Host 侧）

`lib/index.js` 的 `inject = ['webServer', 'connection', 'clientModules']`：

| API | 用途 | 断了会怎样 |
|---|---|---|
| `ctx.clientModules.clientPath()` / `.graph()` / `.fetchBundle()` | 诊断：包有没有进启动图、bundle 能不能取 | 只丢诊断日志，皮肤仍可能工作 |
| `ctx.webServer.register({ kind:'prefix', path, handler })` | 把 `tokens.css` 发给浏览器 | 样式取不到 → 组件结构层失效，token 层仍生效 |
| `ctx.connection.requestRejection(req)` | 同源校验 | 路由返回 400 |

### 2.4 官方插件 API（Client 侧）

| API | 用途 | 断了会怎样 |
|---|---|---|
| `ctx.theme.overrideTokens(source, layer)` | token 值写进 body 内联样式 | 颜色/字体/圆角全失效（皮肤「没颜色」） |
| `ctx.inject(['slots'], cb)` + `slots.inject/register` | 设置行注册 | 设置页没有皮肤那一行，但皮肤本身还在 |
| `ctx.get('theme')` / `require('react')` | 同设置行 | 同上 |

### 2.5 第三方改动点

- `dsh-whale-sense`：32 处 `var(--dsw-*, 原值)` 引用（实测 grep 计数），依赖 15 个官方 token。
  **它是第三方包，上游更新会覆盖这层变量化**——但 DSH 平台升级不会动它。
- 两套皮肤包都是 profile 里的 `link:`，指向 `<repo>/packages\*`，升级不覆盖。

### 2.6 兼容范围

`skin.json` 写的是 `>=0.2.0-rc.2 <0.3.0-0`。

**实测（grep）**：这个字段**只被记录进 debug.log，不参与加载判断**——
`lib/index.js` 只检查字段存在，不比对版本。所以即使 DSH 升到 0.3.x，
皮肤也不会因此被拒绝加载；但这个值届时需要更新，否则清单说的和事实不符。

---

## 3. 基线结果（升级前实测，2026-11-06 07:2x）

| 检查 | 结果 |
|---|---|
| 十三项自检 | **13/13 全绿**（每一行 PASS，无 FAIL/SKIP） |
| `audit.mjs`（上一轮核查脚本） | 全绿（包完整性 / 无绝对路径 / 日志无 error / 无探针残留 / hub 两份一致 / 文档数字） |
| 结构基线回传 | 最近一条 `2026-11-05T23:06:23Z`（北京 11-06 07:06），**9 个 present 锚点全在** |
| 数量对照 | `[data-slot]` 476→308、`[data-chat-flow-kind]` 259→98、`button` 294→225——全是**会话内容不同**导致，不是失败 |
| boot 记录 | `graph-ids(86)`、`boot clientPath=...`、`bundle status=200 len=66199`、`manifest ok` |
| 日志健康 | `debug.log` 无 error/failed 行；无 `tokenErr` / `settingsErr` 回传 |
| patch-guard | 11 条覆盖，0 处警告（`patch-check.log` 23:17Z 最后一条） |
| 仓库状态 | ui `195ff61` 干净；whale-sense `f9ee971` 干净 |

---

## 3.1 升级后验证结果（2026-11-06 07:25，DSH 0.2.2-rc.1）

### 版本变化（实测）

| 项 | 升级前 | 升级后 |
|---|---|---|
| exe FileVersion | 0.2.1-rc.5 | **0.2.2-rc.1**（ProductVersion 0.2.2.0） |
| exe / app.asar mtime | 2026-10-29 22:02 | **2026-11-04 17:30**（安装包自带时间） |
| asar 内 `dsh-desktop-runtime` | 0.2.1-rc.5 | **0.2.2-rc.1** |
| 进程 | 07:06 启动 | 07:25 启动，Web GUI 换到 52255 |
| `runtime.json` 的 desktopVersion | 0.2.1-rc.5 | **仍写 0.2.1-rc.5**（runtime 没跟着升，不影响运行） |

### 更新内容（asar 包差异 + 新包 README）

**新增 4 个客户端包**（graph-ids 86 → 89，实测 diff）：

| 包 | 功能（README 摘要） |
|---|---|
| `@deepseek-ai/dsh-client-ui-context-menu` | 右键菜单服务 `ctx.contextMenus`：贡献项不导入 React，`useContextMenu()` 展开 `getTriggerProps` |
| `@deepseek-ai/dsh-message-quotes` | 选区引用 + Markdown blockquote 渲染 |
| `@deepseek-ai/dsh-client-ui-file-actions` | 下载 / 另存为保持原始编码；图片复制为 PNG |
| `@deepseek-ai/dsh-client-ui-file-drag` | 会话/侧栏原图拖回输入框，桌面端拖到其他应用 |

**消失 1 个**：`@deepseek-ai/dsh-client-ui-deepseek-model-label-1017`（大概率并入 model-selection，未深查）。
**batch 变化**：`application` 批次从 28 条变 31 条（对应新增包）。

**官方 CSS 引用 token：122 → 138（+16，无消失）**。新增引用里
`--dsw-radius-xl` / `--dsw-specific-bubble` / `--dsw-alias-bg-skeleton` 都已在
PRESET_TOKENS / SHARED_TOKENS 覆盖内（grep 实测）；其余 13 个是 `--dsh-*` 布局/动画局部变量。

### 崩没崩：没崩（实测）

| 项 | 结果 |
|---|---|
| 十三项自检 | **13/13 全绿** |
| `audit.mjs` | 全绿 |
| 结构基线 | 新回传 `23:25:22Z`，**9 个 present 锚点全在**；数量漂移（`[data-slot]` 476→209 等）仍是内容相关 |
| boot 日志 | `boot clientPath=...`、`graph-ids(89)`、`bundle status=200 len=66199`、`manifest ok` 全正常；无 error/failed/tokenErr/settingsErr |
| 真机页面 | 正常渲染，皮肤在（截图 07:27，浅色 minimal 观感，侧栏/气泡/输入框无破相） |
| `skin.json` 兼容范围 | `>=0.2.0-rc.2 <0.3.0-0`，0.2.2-rc.1 **在范围内** |

### 遗留观察点（不阻塞）

1. **新 UI 逐个核对未做**：右键菜单、引用浮层、拖放遮罩是这三版新加的可视元素。
   `[role="menu"]` 在新 index CSS 里仍有（1 处），若右键菜单也用这个 role，皮肤的菜单规则会自动命中；
   但**没逐个真机点过**。
2. `runtime.json` 的 `desktopVersion` 没跟着升——只是元数据，不影响运行；等 runtime 更新会自己修。
3. Host 层仍无单测（见 §7）。

---

## 4. 升级后验证清单（按顺序跑）

哥哥更新并重启 DSH 之后：

```bash
NODE=node
cd <repo>

# 0. 确认版本真的变了
#    看 <DSH 安装目录>/DeepSeek Harness.exe 的 FileVersion / app.asar mtime

# 1. 页面有没有跑过探针（重启后看 debug.log 最新 boot 段）
tail -30 packages/dsh-ui-skin-lab/debug.log | grep -a "boot\|graph-ids\|manifest\|bundle status"

# 2. 十三项
for t in check-tokens check-contrast check-selectors client-smoke skin-conflict check-sense-contrast check-input-guard check-motion check-skins check-layout check-structure check-config check-skin-manifest; do
  echo "=== $t ==="; "$NODE" tests/$t.mjs 2>&1 | tail -3
done

# 3. 核查脚本
"$NODE" <工作区>/.tmp/audit.mjs

# 4. 真机截图（皮肤在不在、设置页开不开、陪看面板）
```

然后逐条对照 §5。

---

## 5. 判定标准

| 现象 | 判定 |
|---|---|
| 页面能开 + 皮肤还在 + boot 无 error | **不崩** |
| `check-tokens` 红（白名单外的 token / 缺 token） | 官方 token 变了 → 更新白名单后重跑 |
| `check-structure` 红（present 锚点命中 0） | 官方 DOM 变了 → 改 `selectors.json` + `tokens.css` 对应段 |
| `client-smoke` / `skin-conflict` 红 | 插件 API 或行为变了 → 看具体断言 |
| debug.log 新 boot 行有 `boot error=` / `bundle error=` | 插件加载失败 → 先修，皮肤全灭 |
| 页面能开但皮肤没颜色 | `overrideTokens` 或主题 API 变了 → 查 `theme` 服务 |
| 设置页没有皮肤行 | `slots` 注册变了 → 查 `ctx.inject(['slots'])` |

**数量漂移不算失败**（baselineHits 只做对照，`check-structure` 只对 present=0 判失败）。

---

## 6. 回退

- **插件层回退**：禁用插件 → `html[data-dsu-skin]` 消失 → 所有样式失效；`apply` 的 cleanup 再兜一层。
  不需要恢复备份（ARCHITECTURE §7）。
- **DSH 版本回退**：updater 只保留 `dsh-primary-runtime.previous`（node/pnpm/python），
  **不保留旧版 DSH 本体**。真要退回 0.2.1-rc.5 需要旧安装包。
  升级前已知：安装目录 `<DSH 安装目录>`，版本 0.2.1-rc.5（（推断）可从官方下载页按版本取）。

---

## 7. 这次没覆盖到的（升级后可能需要补）

1. **Host 层没有测试**（`lib/index.js` 136 行）：路由、诊断日志、同源校验都没被单测覆盖。
   升级后若路由失效，只能看 debug.log 判断。
2. **`prefers-reduced-motion` 真机未验**（只验了查询语法被识别）。
3. **「卸载一套皮肤 → 回默认」只有单元覆盖**，没真机卸过包。
4. 陪看面板展开时横向盖侧栏 271/280px（不是皮肤造成的，属 whale-sense 定位）。

---

## 8. 记录位置

- 本文：`<repo>/UPGRADE-BASELINE.md`
- 升级后验证结果：追加到本文 §3 下面，或写进 `HANDOVER.md` §3.12
- 相关：`ARCHITECTURE.md` §7（升级与回退）、`HANDOVER.md` §3.11（变异覆盖）
