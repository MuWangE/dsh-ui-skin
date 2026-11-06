# UI 项目交接文档

> 2026-11-05 晚。写给下一棒：这份文档假设你**没看过任何对话**，也没读过别的文件。
> 项目根：`<repo>`（git，最新提交见 `git log --oneline -1`）。
> **关于文中的 commit hash**：2026-11-06 发布时重建了历史（脱敏），文中早于 `f437cc0` 的 ui 仓库 hash
> 都在本地 `archive` 分支（**未推送**），`git checkout archive` 可查；发布仓库从 `f437cc0` 起。
> whale-sense 的 hash（`202b3bf` / `247a3bd` 等）不受影响，它的仓库历史完整。

---

## 0. 三十秒上手

```bash
# 路径按本机替换：<repo> = 本仓库根，$DSH_HOME = DSH 的 home 目录
NODE=node
cd <repo>

git status                    # 有未提交改动就说明上一棒没收尾
"$NODE" tests/check-tokens.mjs && "$NODE" tests/check-contrast.mjs \
  && "$NODE" tests/check-selectors.mjs && "$NODE" tests/client-smoke.mjs \
  && "$NODE" tests/skin-conflict.mjs \
  && "$NODE" tests/check-input-guard.mjs && "$NODE" tests/check-motion.mjs \
  && "$NODE" tests/check-skins.mjs && "$NODE" tests/check-layout.mjs \
  && "$NODE" tests/check-structure.mjs \
  && "$NODE" tests/check-config.mjs \
  && "$NODE" tests/check-skin-manifest.mjs

printf ' ' >> packages/dsh-ui-skin-lab/lib/client.js   # 触发 HMR，让页面拿到最新代码
tail -5 packages/dsh-ui-skin-lab/debug.log            # 看页面侧有没有报错
```

**别急着改代码**：先读 §4（坑），那里每一条都是踩过的。

---

## 1. 这是什么

把 DSH 做成**风格化、可私人定制**的平台 UI。不是换壁纸——是统一的设计语言：配色、字体、圆角、间距、阴影、滚动条。

哥哥定的方向：

| 项 | 决定 |
|---|---|
| 风格 | 两套实验：**极简**（minimal，深色高对比 Linear 式）与**像素**（pixel，16-bit） |
| 深度 | **整套形态重绘**，不是只换色 |
| 组织 | **一套皮肤 + 两个预设**；M4 之后再考虑拆成独立皮肤包 |
| 中文字体 | **不打包像素字库**，中文用系统字体 |
| 节奏 | 稳着做；做的时候**多问他，一起拿主意** |

板块（原始规划在 `<repo>-PROJECT.md`）：A 设计地基 / B 皮肤框架 / C 外壳页面 / D 陪看插件 UI / E 私人定制控制台 / F 工程验证。

---

## 2. 现在的状态

### 2.1 里程碑

| 里程碑 | 状态 | 提交 |
|---|---|---|
| M1 地基（目录/架构/规范/包/自检） | ✅ 完成 | `2e80965` |
| M3 第一刀（像素风可见） | ✅ 完成 | `a4a063d` |
| M3 修 bug（token 挂 body + HMR 清场） | ✅ 完成 | `5ba7ebb` |
| M3 架构改造（走官方 overrideTokens） | ✅ 完成 | `4202b42` |
| M3 深色/浅色层次调优 | ✅ 完成 | `b5e02ad`、`6c8bb07` |
| 项目复核（清死代码、校正文档） | ✅ 完成 | `00c3c0b` |
| token 扩到 103 | ✅ 完成 | `6ebc5d2` |
| 组件细节（头部隔线） | ✅ 完成 | `c31a008` |
| **M4 设置页（预设切换 UI）** | ✅ 完成并肉眼验证 | `15410b7` |
| M2 陪看 UI | ✅ 完成（whale-sense 全接皮肤；whale-widget 刻意不接） | `54a59e9` |
| M5 多皮肤互斥 | ✅ 完成（让位协议 + 开关） | 见 §3.6 |
| E 板块四旋钮（主色/字号/圆角/动效） | ✅ 完成并验证 | 见 §3.8 |
| **E：字号让位官方 + 字体族礼让** | ✅ 完成（2026-11-06，十三项全绿） | 见 §3.8 |
| **E：独立「外观」设置页（settings.section）** | ✅ 完成（2026-11-06，真机探针验证） | 见 §3.8 |
| **D：折叠图标按 DESIGN §7 重画** | ✅ 完成（2026-11-06，whale-sense `202b3bf`，探针实测） | 见 §3.5 |
| **整体核查（七项测试 / 24 组组合 / 变异验证）** | ✅ 完成 | `0bcb314` |
| **M5 动效闭包（系统级降级 + 第八项测试）** | ✅ 完成（2026-11-05） | 见 §3.8 |
| **M5 多皮肤（hub 注册表 + 素色基准皮肤）** | ✅ 切换 + 卸载/重装全部真机验过（2026-11-06） | 见 §3.6.2 |
| **M5 交互组件形态（气泡/按钮/tab/菜单/对话框）** | ⚠️ 主体完成；对话框与菜单未真机验 | 见 §3.7 |
| **M5 结构基线（升级不崩的保命绳）** | ✅ 完成（2026-11-05） | `ARCHITECTURE.md` §7 |
| **B 板块收尾（skin.json 清单）** | ✅ 完成（2026-11-05） | 见 §3.6.1 |
| **E 板块收尾（配置导出/导入 + 多套方案）** | ✅ 真机闭环（2026-11-05） | 见 §3.8 |
| **E：陪看图标旋钮（三形态）** | ✅ 真机+变异验证（2026-11-05）；**2026-11-06 拆包后归 whale-sense** | 见 §3.5 |
| **DSH 升级验证（0.2.1-rc.5 → 0.2.2-rc.1）** | ✅ 通过（2026-11-06） | 见 `UPGRADE-BASELINE.md` §3.1 |
| **F：可分发（tarball 本机模拟真装）** | ✅ 完成（2026-11-06，重启后实证） | 见 §3.12 |
| **pixel 全局硬切（DESIGN §6 的 0ms）** | ✅ 完成并验收（2026-11-06） | 见 §3.8 |

### 2.2 M3 的结论：形态重绘可行，且已到「最小完整集」

- **token 覆盖**：minimal **103** 个（40 个预设值 + 63 条 `SHARED_TOKENS` 派生）、
  pixel **104** 个（41 + 63）。不同预设数量可以不同，别拿一个数套两个预设。
- **组件覆盖**只剩结构性部分：侧栏、会话头部、输入框卡片、滚动条、头部底部分隔线。
- **四宫格（两预设 × 浅深）全部肉眼验证通过**，深色和浅色各修过一次层次问题。
- 四项自检全绿。

覆盖率判断依据（做过的差距分析）：官方 118 个 alias+specific token 里，86 个未覆盖中——
22 个硬编码、53 个走 `--dsw-static-*` 色板（必须显式改写，否则组件留着官方灰）、5 个本来就是别名会自动跟随。
剩下 **19 个是刻意不改的语义色**：文件对比红绿（6）、遮罩黑（5）、引导页（4）、`brand-primary-new-colorprimary-new-color` 这类官方遗留名（2）、代码 diff（2）。

### 2.3 M4 设置页：已完成并肉眼验证

> ⚠️ **时点记录**：本节写于 2026-11-05，M4 当时挂在设置页「通用」分区。
> 2026-11-06 已整体迁到独立的「外观」分区（`settings.section`，id `skin`），**当前实况见 §3.8**，别照本节找入口。

**做了什么**：把预设切换从「浏览器控制台 `__dsuSkinLab.select()`」搬进 DSH 设置页「通用」分区。

1. `factory: (require)` 能拿到 `require('react')`（实测返回 `default,Children,Component,Fragment...`）和 `require('@deepseek-ai/dsh-client-store').defineStore`。
2. **⚠️ 关键坑：`ctx.slots` 不能直接读。** 直接 `ctx.slots` 拿到 `undefined`（实测探针：`settingsRow=skipped|react=true|store=true|slots=false`），
   必须像 theme 一样用 `ctx.inject(['slots'], (scope) => { const slots = scope.slots; ... })` 申请。
   而且**读 `ctx.slots.xxx` 的时机也要包 try**——cordis 的 Context 是 Proxy。
3. 按官方写法注册（照抄 `dsh-client-ui-theme/lib/client.js`）：
   ```js
   slots.inject('settings.general.item', () =>
     slots.register({
       name: 'settings.general.item',
       id: 'dsu-skin-preset',
       order: 12,
       store,
       inject: (actions) => { bound = actions; return { setPreset(id) {...} }; },
     }, Row));
   ```
   组件签名是 `({ useStore, setPreset })`（官方 AppearanceRow 是 `{ t, setTheme, useStore }`）。
4. 抽出了 `applyPreset(id)` 作为切换唯一入口，控制台和设置页共用。
5. `client-smoke.mjs` 已加 7 条设置行断言（模拟 `ctx.inject` 分派 theme/slots + fake require），全绿。
6. 实测探针已确认：`settingsRow=registered`。

**还没验证的**：设置页里的那一行长什么样（需要打开 DSH 设置 → 通用 看一眼）。
如果样式不对，改 `installSettingsRow` 上面那段 `settingsStyle.textContent` 里的 `.dsu-skin-*` 规则。

**诊断命令**：
```bash
grep -a "settingsRow\|settingsErr" packages/dsh-ui-skin-lab/debug.log | tail -3
```
- `settingsRow=skipped|react=..|store=..` → React 或 store 没拿到；
- `settingsRow=no-slots-api` → 注入了 slots 但 scope 里没有；
- `settingsErr=` → 注册时抛错，看信息。

---

## 3. 架构：值走 token，结构走 CSS

### 3.1 两层数据

```
┌─ token 值（颜色/圆角/字体） ────────────────────────────┐
│  lib/client.js 的 PRESET_TOKENS  每预设 { light, dark }  │
│  lib/client.js 的 SHARED_TOKENS  63 条派生规则，两预设共用 │
│      ↓ ctx.theme.overrideTokens('dsh-ui-skin-lab', layer) │
│  官方 ThemePresenter → body.style.setProperty(...)        │
└──────────────────────────────────────────────────────────┘

┌─ 组件结构（哪个元素加边框） ─────────────────────────────┐
│  tokens.css  →  Host 路由 /dsu-skin/tokens.css            │
│             →  client fetch 后注入 <style data-dsu="skin-lab"> │
└──────────────────────────────────────────────────────────┘
```

**分工判断标准**：能不能用一个 CSS 变量表达？能 → 进 token；不能（比如「这个元素要有 2px 右边框」）→ 进 tokens.css。

### 3.2 为什么 token 值在 JS 里而不在 CSS/JSON

Host 侧 `lib/index.js` 没有热重载（见 §4.3），而且本插件的行不在 profile 的 patch 里，连「改配置触发 HMR」都走不通。
token 值要频繁调整，只能内联进 `lib/client.js` 跟 HMR 一起走。

代价：加一种风格要改 JS（原来设想是「加一个文件」）。已在 `ARCHITECTURE.md` 第 4 节记明。

### 3.3 SHARED_TOKENS 的作用

官方很多组件读的是 `--dsw-static-*` 色板（不随主题变）。要是不改写，换预设时按钮、滚动条、浮层会留着官方灰。

但不用每个预设写四遍值，写成派生即可，深浅自动跟随：

```js
'--dsw-alias-button-elevated-fill': 'var(--dsw-alias-bg-layer-1)',
'--dsw-alias-scrollbar-bg-l2':      'var(--dsw-alias-border-l3)',
'--dsw-alias-toast-bg':             'var(--dsw-alias-label-primary)',
'--dsw-alias-button-primary-hover': 'color-mix(in srgb, var(--dsw-alias-brand-primary) 82%, var(--dsw-alias-bg-base))',
```

合并顺序在 `syncTokens()`：先铺 `SHARED_TOKENS`，再用预设自己的值盖上去（预设优先）。

**注意**：`color-mix()` 和 `var()` 在 body 内联样式里能被正常解析（Chromium 支持），实测没有断链。

### 3.4 卸载行为

`cleanup` 会：撤 token 层（`disposeTokens()`）→ 删所有 `data-dsu` 为 `skin-lab` / `skin-lab-settings` 的 `<style>` → 移除 `html` 上的 `data-dsu-skin` / `data-dsu-degraded` → 删 `window.__dsuSkinLab`。

### 3.5 陪看插件（whale-sense）

**2026-11-06 拆包（这是现状；下面从「whale-sense 的 CSS 原本…」起是历史记录）**：

UI 插件现在**一个 `sense` 字都没有**（`grep -i sense` 在 `lib/` 和 `tokens.css` 里为空）。两边只剩单向：

```
whale-sense  ──读──▶  html[data-dsu-skin]（皮肤状态）＋ var(--dsw-*)
UI 插件      ──不感知──▶  whale-sense
```

- whale-sense 自己消费 `--dsw-*`（`var(--dsw-*, 原值)`，35 处，全有兜底）；
- **形态适配搬到 whale-sense 自己的 CSS**：读 `html[data-dsu-skin="pixel"]` 加 2px 硬边、硬阴影、方角
  （原来在 UI 的 `tokens.css` 第 3 节，已删）；
- **折叠图标三态自持**：`localStorage['dsh-whale-sense.senseIcon']`，默认 `auto`——
  装了皮肤 → 细线眼（pixel 下 CSS 自动换像素眼），没装 → 行楷「看」；
  属性 `data-dsh-sense-icon`（**不再是 `data-dsu-*`**），`MutationObserver` 跟皮肤切换；
- 暴露 `window.__dshWhaleSense = { icon, icons, setIcon }`；**UI 设置页不再有「陪看图标」一行**。

**为什么这么拆**：UI 插件要能独立发布，就不能知道某个具体客户的名字。它只提供「皮肤状态挂在
`<html>` 上」这个协议，谁来读它不管。

**设计教训（仍然有效）**：底部小字/状态点只能用 `label-secondary`（`label-tertiary` 只有 2.80~3.84:1）；
minimal 浅色按钮文字 4.44:1 与官方同组合不动；眼睛 SVG 三色拆成类（presentation attribute 不认 `var()`）；
阴影走 `--dsh-sense-shadow(-sm)`，别换 `--dsw-shadow-lv*`；深色下 28% 硬阴影只有 1.14:1，层次靠 2px 边框；
悬停别用 `--dsw-alias-interactive-bg-hover`（浅色 1.01:1）。

**对比度保护已内化**：原来的 `tests/check-sense-contrast.mjs`（跨包读陪看 CSS）已删，
改成 `check-contrast` 里通用的「次要文字 × 层 2 / 层 3 ≥ 4.5」——皮肤改配色时，任何浮层消费方都被保护。

---

> 以下为 2026-11-05 第一次接入的历史记录，代码位置已变，**别照着改**。

whale-sense 的 CSS 原本 15 处硬编码色，圆角、字体也写死，**不消费 `--dsw-*`**，所以 token 层管不到它。

2026-11-05 起实验：把它的 `lib/client.js` 改成 `var(--dsw-*, 原值)`。
- 30 处 `var()`、15 个 token，全部在 `tests/official-tokens.json` 白名单内，**每个都有原值兜底**（没装皮肤时观感不变）。
- **坑 1：底部小字和状态点只能用 `label-secondary`，别用 `label-tertiary`。** tertiary 在四组配色下只有 **2.80~3.84:1**（WCAG 正文要 4.5），比改动前的 5.72:1 是退步；secondary 是 5.05~6.14:1，四组全过。这是核验时算出来的，肉眼看不出来。
- **坑 2：minimal 浅色的按钮文字是 4.44:1**（白字 on 品牌色 `#3b6ef5`），比 4.5 差 0.06。和 DSH 官方原生按钮同一组合，不为 0.06 动整套主色，记着就行。
- 真身：`<whale-sense 仓库>`（profile 的 `node_modules/dsh-whale-sense` 是软链）。
- **它是第三方包，上游更新会覆盖 `lib/client.js`**，升级后要重做这层变量化。改动已提交在本地仓库 `247a3bd`（变量化）+ `6ef28ac`（对比度修正），冲突时按这两个提交重放。
- 备份 `lib/client.js.bak-20261105190859`；撤销这次变量化：`git checkout b7b2ede -- lib/client.js`（回到改动前）。
- 眼睛 SVG 的三色拆成 `.dsh-sense-eye / -pupil / -glint` 类——presentation attribute 不认 `var()`。
- **折叠图标已换成行楷「看」字（2026-11-05，`dsh-whale-sense` 提交 `67c242d`）**：哥哥定的临时方案。
  `chip.innerHTML` 从 SVG 眼睛换成 `<span class="dsh-sense-kanji">看</span>`，字体栈
  `STXingkai`（Windows 自带华文行楷）→ 华文楷体 → KaiTi → serif；26px，颜色跟 `--dsw-alias-brand-primary`。
  实测 computed font-family 命中 STXingkai、字号 26px、颜色随当前琥珀主色，SVG 已移除。
  **原始眼睛 SVG 仍在 git 历史里**，要退回直接 checkout 那个文件。
  ⚠️ ~~这是「暂时」：DESIGN §7 的图标规范还没应用~~ → **2026-11-06 已按 §7 重画**
  （`dsh-whale-sense` 提交 `202b3bf`）：眼睛有两套 SVG——细线（minimal / 没装皮肤，20px、1.5px 描边、允许曲线）
  与像素（pixel 预设，20px、2px 只走横竖、`shape-rendering: crispEdges`、八角形眼框 + 4×4 瞳孔 + 2×2 高光）；
  dot 方块 16px、边框 4px（落在 2px 网格）；行楷「看」保留为书法选项（字体渲染，不做像素化）。
  唯一保留的硬编码仍是眼睛高光 `#fff`（光是光，不随主题变）。
  探针实测（pixel + eye）：细线眼睛 `display:none`、像素眼睛 `display:block`、`getBoundingClientRect().width = 20`、
  `shape-rendering = crispedges`。
- 阴影走自定义口子 `--dsh-sense-shadow(-sm)`，默认保持原值。**别换成 `--dsw-shadow-lv*`**：官方 lv1/2/3 是 `0 2px 4px`、`0 4px 12px`、`0 0 1px` 那种菜单级轻阴影，浮层会飘不起来。
- 折叠小眼睛圆角也留了口子 `--dsh-sense-chip-radius`，默认 `50%`。
- 实测（浅色）：minimal → 浅灰底 + 16px 圆角 + 系统字；pixel → 淡紫底 + 直角 + 等宽字，按钮同步变直角。
- **四宫格已全部肉眼验证**（两预设 × 浅深）：颜色、圆角、字体、按钮都跟随。

**阶段二（`tokens.css` 第 3 节）**：whale-sense 自己的变量管不到「形态」，由皮肤补：

```css
html[data-dsu-skin="pixel"] .dsh-sense-panel,
html[data-dsu-skin="pixel"] .dsh-sense-chip,
html[data-dsu-skin="pixel"] .dsh-sense-say { border-width: 2px; --dsh-sense-shadow: 4px 4px 0 rgba(0,0,0,.28); }
```

- 面板 / 小眼睛 / 字幕：2px 硬边、`4px 4px 0 rgba(0,0,0,.28)` 硬阴影（**对齐输入框卡片的值**，`tokens.css:53`）。
- 折叠的小眼睛：`--dsh-sense-chip-radius: 0`，从圆变方。
- 主按钮：2px `bg-base` 反色描边 + 硬阴影，`:active` 位移 2px。描边**别用 `label-primary`**——它在浅色下是深、深色下是浅，正好和按钮底色同向，对比拉不开；`bg-base` 是按钮底色的反色（浅色=白边、深色=黑边）。
- **已知**：黑色 28% 硬阴影在深色下对比只有 **1.14:1**（`#2a2438` 叠成 `#1e1a28`），基本不可见；浅色下 1.92:1，看得见且不脏。所以深色的层次靠 2px 边框撑。要调就把 `.dsh-sense-*` 和输入框卡片一起调，别只改一处。
- 选择器是插件自己的类名（`.dsh-sense-*`），不是官方 `data-*`，不用登记 `selectors.json`；但仍受「必须以 `html[data-dsu-skin` 开头」的约束。
- 未验证：字幕压在输入框上（`bottom: 76px` 是它原来的定位，不是皮肤造成的）。
- **悬停（2026-11-05 补）**：`.dsh-sense-chip:hover` 从 `interactive-bg-hover`（`#ffffff14`，约 8% 白，浅色下 1.01:1 等于没反应）改成 `color-mix(brand-primary 22%, transparent)` + `border-color: brand-primary`。实测对比 1.29~1.48:1，加边框变色后够明显。**别再用 `--dsw-alias-interactive-bg-hover`**，它在浅色底下是 1.01:1。

**whale-widget（右下角角色）刻意不接皮肤**：它是立绘 + 音效 + 气泡的角色装饰（1.1MB 贴图、4926 行），不是平台 UI 语言的一部分；让鲸鱼娘跟着 minimal / pixel 变形会丢掉角色本身，那 48 处硬编码色属于角色设计。如果哪天想让「气泡」跟皮肤走，单独做，别动立绘。

### 3.6 多皮肤（M5，2026-11-05 重做）

**两件事要分开看**：

**1. 同族皮肤之间**：用注册表 `window.__dshSkinHub` 选，谁上色由用户选中的那套决定。

- `register({ id, label, hint })` 登记一套；`list()` 给设置页列出；`subscribe(fn)` 变更通知；
- `active()` / `setActive(id)`：选中状态存 `localStorage['dsh-ui-skin.active']`，
  **没选过 = 默认皮肤**（`dsh-ui-skin-lab`），所以老用户升级后观感不变；
- 现有两套：`dsh-ui-skin-lab`（内部还有极简/像素两套**风格**）与 `dsh-ui-skin-plain`
  （素色基准，板块 B 原始定义要求的「第二套」，只把品牌色换中性灰）。

**2. 第三方皮肤**（maid-atelier 这类不走 hub 的）：仍然让位，判据两道——

1. **协议**：`window.__dshSkinLock.owner` 存在且**不在 hub 名单里**；
2. **特征**：`FOREIGN_MARKERS`（当前 `data-dsh-maid-atelier`），查 `html` 和 `body`。

> ⚠️ **锁的语义变了**：`__dshSkinLock` 现在是「**第三方让位信号**」，不再是「谁先占谁赢」。
> 同族皮肤互相占锁**不算**冲突，否则切到素色时会被 lab 挡回去（第一版就这么栽的，`check-skins` 当场红）。

让位 = 不打属性、不推 token、不注样式、交还锁；设置行保留。
**只撤自己的属性**：hub 通知按注册顺序派发，让位方无脑 `removeAttribute` 会抹掉先上色那套刚打的标记。

开关：设置页底部「停用 / 启用我的皮肤」，状态存 `localStorage['dsh-ui-skin-lab.enabled']`（只有 `'off'` 算关）。
停用会把 token 层、样式、属性、皮肤锁全撤掉，但设置行留着。

控制台 API：`__dsuSkinLab.enabled` / `.blockedBy` / `.status()` / `.enable()` / `.disable()` /
`.skins` / `.activeSkin` / `.setSkin(id)`。

**设置页两层**（2026-11-05 哥哥选的 A 方案）：
「皮肤」列出 hub 里全部已装皮肤 →「风格」只在本包被选中时可选 minimal / pixel（素色没有风格，按钮灰掉）。

**真机验证（2026-11-05 19:36，旧版互斥）**：设置页点「停用我的皮肤」→ 页面整套回 DSH 原生浅色、设置行保留、
状态变「已手动停用」、方块变灰 disabled、whale-sense 跟着回到白底黑按钮；点「启用我的皮肤」→ pixel 整套恢复、
陪看面板回到紫硬边。闭环成立。

**真机验证（多皮肤，2026-11-05 20:59，实测）**：
- 装包：`plugin_manager install_bundle` 装 `dsh-ui-skin-plain` 后**不需要重启**——DSH 动态应用了 bundle，
  页面里 `__dshSkinHub.list()` 立刻就是 `dsh-ui-skin-plain, dsh-ui-skin-lab`（探针实测，
  顺序是 plain 在前，正好是 `check-skins` 覆盖的「反序」场景）。
- 切换：探针调 `hub.setActive()` 切过去再切回来，读回三组证据——

| 时刻 | `data-dsu-skin` | `--dsw-alias-brand-primary` |
|---|---|---|
| 切换前 | `pixel` | `color-mix(in srgb, #b45309 70%, white)`（用户选的琥珀） |
| 切到素色 | `plain` | `#9ca3af`（素色中性灰） |
| 切回 | `pixel` | 回到琥珀的 color-mix —— **用户主色旋钮跨皮肤保留** |

- **卸载 / 重装已真机验（2026-11-06）**：原先只有 `check-skins` 的单元覆盖，现在四个场景都跑过，详见 §3.6.2。

**新皮肤要接进来怎么做**：复制 `dsh-ui-skin-plain` 的 `getHub()`（与 lab 逐行一致）、
`register` 自己、在 `subscribe` 回调里按 `isActive()` 决定上色或让位、用 `__dshSkinLock` 标 owner。
改协议必须两个包一起改，然后跑 `tests/check-skins.mjs`。

### 3.6.1 皮肤清单 skin.json（2026-11-05，板块 B 原始产出物）

板块 B 原始定义要求皮肤包带一份 `skin.json` 清单（id / 名称 / 作者 / tagline / 标签 / accent /
bodyAttr / 兼容版本 / 预览图 / 桌面图标）。两个包现在都有：

| 字段 | lab | plain |
|---|---|---|
| `id`（= hub 里的皮肤 id） | `dsh-ui-skin-lab` | `dsh-ui-skin-plain` |
| `wiring.id`（= cordis 行 id） | `ui-skin-lab` | `ui-skin-plain` |
| `bodyAttr` | `data-dsu-skin` | `data-dsu-skin` |
| `bodyAttrValues` | minimal / pixel | plain |
| `multiSkin` | hub / lock / active key | 同左 |

**没写 `preview` 和 `desktopIcon`**——没有那两张图，不写不存在的路径。补图之后再加。

**它不是死文件**：`lib/index.js` 启动时读一遍，缺字段写 `manifest missing=...`、正常写
`manifest ok id=... attr=...` 进 `debug.log`（只有 Host 能读包内文件，浏览器拿不到）。
`tests/check-skin-manifest.mjs` 保证清单和代码是同一个人说的：`package` 对 package.json、
`wiring.id` 对 cordis.patch.yml、`id` 对 client.js 注册的皮肤 id、`bodyAttr` 对 tokens.css 前缀、
`files` 含 skin.json、**写了 preview/desktopIcon 就要求那个文件存在**。
变异验证：把 `package` 改错立刻红。

### 3.6.2 卸载 / 重装真机验证（2026-11-06，B 板块收口）

`plugin_manager remove_bundle` 的实现在 asar 内（`dsh-plugin-manager/lib/index.js`）：
**走 `pnpm remove <name>`，不是 fs 递归删除**。`removable` 判定 = `owned && !shipped`（`link:` 包满足）。
顺序是「先从 profile 的 `dsh.profile.bundles` 摘掉 → reload 卸掉 cordis 行 → `pnpm remove`」，
所以它不会碰 junction 的目标目录。

四个场景实测（client 探针回传 `window.__dshSkinHub` 状态 + 截屏）：

| 场景 | 操作 | 结果 |
|---|---|---|
| 卸非激活皮肤 | `active=lab`，remove plain | hub 只剩 `lab`；`attr=minimal` 不变；页面零变化 |
| 重装 | install plain | hub 恢复 `plain,lab`（**反序**）；页面不变 |
| 卸激活皮肤 | `active=lab`，remove lab | 页面回 **DSH 原生**（品牌蓝 / 圆角 / 系统字 / 陪看回到「看」字）；会话不崩、输入框可用 |
| 重装 | install lab | 恢复 pixel（localStorage 的 preset 保留），之后切回 minimal |

**为什么卸掉激活的不会回落到剩下那套**（实测，不是缺陷）：`active` 存的是显式 id
（实测读到 `dsh-ui-skin-lab`，不是 null）；plain 的 `isActive()` 是严格相等，不认这个 id；
lab 的 `isActiveSkin()` 才把 null 当自己。于是「指向不存在的皮肤 = 没人上色」这条兜底真的生效，
页面干净地回原生。

**两条要记住的事实**：

1. **`pnpm remove` 不删 `node_modules` 顶层的 junction**。卸完 lab / plain 后 junction 仍在原位、
   Target 不变（实测）。判断「卸干净没」要看 profile `package.json` 的 `dependencies` 和
   `dsh.profile.bundles`，**别只看 node_modules**——那里会骗人。
2. **重装会把 bundle 追加到 `bundles` 数组末尾**，顺序可能与原来不同（实测重装后 plain 在前）。
   不影响观感——`check-skins` 场景二覆盖的正是反序。

**源目录安全性（实测）**：卸载全程两个包 12 / 8 个文件逐字节完好（清单 + SHA256 比对），
junction 目标没被穿透。演练备份与文件清单在 `<工作区>/.tmp\uninstall-drill\`（不进仓库）。

**一个推断，未直接确认**：卸掉 lab 后「外观」设置分区也会消失（该 section 由 lab 自己注册），
按此推断此时界面里没有切皮肤的入口，只能重装恢复。要确认得在卸载状态下打开设置页看一眼。

> **⚠️ 2026-11-06 复验（第二棒）——这条推断当场被推翻了一半**：卸掉 lab 后「外观」设置分区
> **没有消失**，哥哥还能在里面把预设从 minimal 切到 pixel。原因是
> **`remove_bundle` 只卸配置、不卸运行时**：profile 的 `dsh.profile.bundles` 与 `dependencies`
> 都清干净了，但**页面不会自动重载**，lab 的 client 实例仍在内存里跑——`window.__dsuSkinLab` 仍 alive、
> `data-dsu-skin` 仍挂着、`__dshSkinHub` 仍 alive、皮肤锁 owner 还是 `dsh-ui-skin-lab`、
> lab 的 `debug.log` 也没有新的 `boot` 记录。
> 所以「卸载后页面回原生」这类观察**必须在页面重载之后看**，否则看到的是「配置层已卸、运行时还在」的混合态。
> ⚠️ 这与本节上表「卸激活皮肤 → 页面回 DSH 原生」的记录**不一致**，原因未查清
> （可能当时页面恰好重载了，也可能与 HMR 活动有关）。两条都留着，别把哪一条当定论。
> 已同步写进 `checkpoint-6a4dec9a.md` 的「已知坑」第 11 条。

**回退 / 装回**：`install_bundle`，target 用 `link:<repo>/packages/<包名>`。

### 3.7 形态层与组件矩阵（M5 之后的架构加固）

**目的**：做第 4、5 个组件覆盖时不再重复抄 `2px` / `rgba(0,0,0,.28)`。

- `tokens.css` 新增第 0 节「形态常量」：`--dsu-edge` / `--dsu-shadow-sm|md|lg` / `--dsu-scrollbar`。
  只在 `html[data-dsu-skin="pixel"]` 上定义，所有引用都带兜底，minimal 读不到时退回原值。
- **官方有自己的中间变量层 `--dsl-*`（19 个，全部映射到 `--dsw-*`）**：代码块、终端、搜索、网页预览的
  圆角/背景/字体已经自动跟随皮肤——**不需要**为它们重复写选择器。只有官方没抽象成变量的地方
  （边框粗细、硬阴影、间距常量）才要结构覆盖。
- 已经做了：Markdown 代码块（`.md-code-block`，2px 硬边 + 硬阴影）。
- **2026-11-05 补的交互组件**（`tokens.css` 第 4 节，全部走「不占布局」手法）：
  - 用户消息气泡：载体是 `[data-chat-flow-kind="user"] [class*="bubble"]`（哈希前缀会变，只认中段）；
    `inset 0 0 0 2px` 描边 + 外硬阴影。
  - 按钮：**只在按钮集群里**常驻描边（输入区 `[data-composer-card]` / 对话框 / 菜单），
    全局只做 `:hover` / `:focus-visible` 描边。全量 268 个一起加过一版，侧栏变成方框、太吵，已收敛。
  - tab：底部 2px；`aria-selected="true"` 换品牌色（实测读回用户选的琥珀）。
  - 菜单 / 对话框：`outline` + `--dsu-shadow-lg`；菜单项 hover 换背景。
  - **对话框已真机验过（2026-11-05）**：打开设置 → 通用，`[role="dialog"]` 实测 800×702，
    `outline: 1.6px solid rgb(123,95,184)`（= 2px @ 80% 缩放）、`box-shadow: rgba(0,0,0,.28) 4px 4px 0` 都生效；
    设置行七行全渲染（皮肤 / 风格 / 主色 / 正文字号 / 圆角 / 动效 / 方案），方案行三个按钮都在。
  - **菜单已真机验过（2026-11-05）**：打开右上角「…」的会话菜单，实测 `[role="menu"]` 164×68，
    `outline: 1.6px solid rgb(107,90,143)`（= 2px `border-l2`）、`outline-offset: -1.6px`（贴边向内）、
    `box-shadow: rgba(0,0,0,.28) 4px 4px 0`、`border-radius: 0`；两个菜单项各有 `inset 2px` 描边。
    至此**五类交互组件（气泡 / 按钮 / tab / 菜单 / 对话框）全部真机验过**。
  - **右键菜单（2026-11-06 新版 `context-menu` 包）也命中**：官方新增的右键菜单用 `[role="menu"]`，
    已有菜单规则直接吃到了（哥哥实测确认）。不用为新包单独写规则。
  - **`.dsu-skin-toggle` 例外**：`[role="dialog"] button` 会命中「停用我的皮肤」那个文字链接式按钮，
    把它框成一个紫块盖住文字（真机截图发现的）。已加 `:not(.dsu-skin-toggle)` 例外，
    实测 toggle 的 `box-shadow` 回到 `none`，而 `cube` / `brandChip` 仍是 `inset 2px`。
  - **设置行排版：分散版定稿**（2026-11-05 哥哥定的）。七行合起来 611px，在 700px 高的对话框里要滚动——
    这是可接受的。试过**两列网格**紧凑版（标题在左、控件在右，能压到 ~280px），
    **体感不如分散版，已回退**（`git checkout` 回 `b181c94`，工作区无残留）。
    将来还要试的话，关键坑：`.dsu-skin-row` 换 `grid-template-columns:64px 1fr` 时，
    `status`（运行中）必须挪到末尾——它作为整行元素夹在中间，会把后面的按钮组挤到下一行第一列。
- **布局纪律**：第 4 节只许写不占布局的属性，`tests/check-layout.mjs` 强制（变异验证过：
  塞一条 `border: 2px` 立刻红）。实测覆盖前后尺寸一模一样：气泡 40x42、输入区按钮 28x28、
  侧栏按钮 256x24、tab 26x25。
- **做不了（试过，已放弃）**：
  - 终端/命令块（`._block_8z71b_1`）——容器是哈希类名，没有稳定 data 锚点。
  - 工具调用（`[data-tool]`）——紧凑态是纯文本、没有边框载体，实测加了规则视觉无变化；展开态是哈希类名，分散在 `dsh-client-ui-tool` 等几个包里。别用 `[class*="_card"]` 硬凑。
- 组件消费矩阵、覆盖率基线（官方 CSS 引用 94 个 token，我们覆盖 56 个 = 60%）、该补的清单，
  全在 `ARCHITECTURE.md` §4.1。

### 3.8 E 板块：主色、圆角与动效（字号已让位）

token 合并链现在是**三层**：`SHARED_TOKENS` → 预设值 → **用户覆写**（最后一层压过前两层）。

**主色**（`--dsw-alias-brand-primary` + `--dsw-alias-link`）：

- 只改这两个 token，其余 10 条派生（按钮 / 链接 / 选中态 / 文档选中）都是 `var()` / `color-mix()`，自动跟随。
- 色板 `BRAND_PALETTE` **只收深色系**（靛蓝 `#3b6ef5` / 紫 `#6b4bd6` / 青 `#0f766e` / 绿 `#15803d` / 玫红 `#be185d` / 琥珀 `#b45309`）：
  浅色模式下按钮是「品牌底 + 白字」，品牌色不够深就低于 4.5:1，浅黄浅绿会被这条约束挡掉。
- 深色模式自动提亮 `color-mix(色 70%, 白)`，落在官方深色品牌色的亮度区间。
- 实测琥珀：**浅色 5.02:1、深色（提亮后 `#ca8753`）6.14:1**，两个分支都过。
- 存储 `localStorage['dsh-ui-skin-lab.brand']`，空 = 跟随预设。

**字号：已撤，交给官方（2026-11-06 哥哥定的 A 方案）**：

- 官方「通用 → 字体大小」已经比我们细：正文 10–22px 步进、代码 10–16、终端 10–20，
  还有三行字体族、快捷键（`Ctrl+=` / `Ctrl+-`）、Host 持久化（`ui-theme` 命名空间）。
- 冲突机制（实测源码）：`ui-layout` 的 `ThemePresenter.apply()` 先写官方字号，再写 token 覆盖层；
  皮肤走 `overrideTokens` 写的 `--dsh-content-font-size` 在**后**，会把官方正文设置压掉
  （官方 UI 显示 12，页面不是 12）。
- 所以字号旋钮和 `.font` / `.fontSizes` / `.setFont` 控制台 API 一起删除；
  旧 `localStorage['dsh-ui-skin-lab.font']` 不读、不迁移。
- **字体族礼让（同批做）**：官方在 body 上用 `--dsw-font-family` 把 `--dsh-font-family-text`
  排在栈前；皮肤覆盖它会把用户的字体族设置压掉。现在 `syncTokens` 先读
  `ctx.theme.getTheme().fontFamilies`：用户设过 `text` / `code` 就让位（不写
  `--dsw-font-family` / `--ds-font-family-code`），没设才给预设的字体栈。
- **坑（2026-11-06 实测）**：官方 `overrideTokens` 会**同步** emit `theme/change`。
  订阅它做「字体变了重推」时，必须**先记 `lastLayerJson` 再推**——先推后记会无限递归
  （栈溢出 5 次，日志里 5 条 `tokenErr=Maximum call stack size exceeded`）。
  `client-smoke` 已加回归断言「官方同步 emit 时不会无限递归」。

**圆角**（6 个 `--dsw-radius-*`）：

- 三档：直角（全 `0px`）/ 跟随预设 / 圆润（`6/8/12/16/20px`）。
- **给绝对值而不是乘系数**：pixel 的基准是 `0px`，乘任何系数还是 0，「圆润」在 pixel 下会变成没反应。
- 存储 `localStorage['dsh-ui-skin-lab.radius']`。

**动效**（`html[data-dsu-motion="off"]`）：

- `transition` / `animation` / `scroll-behavior` 全部 `none/auto !important`。`transition` 没法用 CSS 变量表达，只能整体关。
- 属性由 `syncMotion()` 维护，apply / enable / disable / cleanup 四处都会调；皮肤停用时一并撤掉。
- **实测（扫描式探针）**：开 = `.GAkraW_sectionLabel .GAkraW_w` 读到 `0.18s`；关 = 整页扫不到任何带过渡的元素。
  所以开关生效；「看起来没效果」是因为 DSH 过渡本来就轻（官方 CSS 只有 19 处 transition、18 处 animation）。
- 存储 `localStorage['dsh-ui-skin-lab.motion']`（只有 `'off'` 算关）。

**pixel 硬切（2026-11-06，DESIGN §6 的 0ms，哥哥验收通过）**：

- `tokens.css` 第 1 节：`html[data-dsu-skin="pixel"]` 及其全部后代 `transition: none !important` +
  `scroll-behavior: auto !important`。minimal 的 120/200ms 不动。
- **只压 `transition`，不压 `animation`**：官方 17 个 `@keyframes` 里 `_spin`（spinner）、
  `_dsh-state-dot-spin`（运行状态点）、`_dsh-plugin-detail-skeleton`（骨架屏）、
  `_reveal-second-dot` / `_reveal-third-dot`（打字指示点）是「进行中」的唯一表达，
  压成 `none` 会静止——那是功能损失，不是风格。
- **实测（扫描式探针，真机）**：pixel 下整页 **0** 个元素带 `transition`，minimal 下 **1081** 个。
  同一次探针、同一份 CSS，只差 `data-dsu-skin` 属性。
- `check-motion.mjs` 新增四条断言：块存在、压 `transition`、压 `scroll-behavior`、
  **反向断言不许压 `animation`**。变异验证：删 `transition` → 红；加 `animation: none` → 红。
- **剩下的不一致**：弹窗 / toast 的进入是 animation，pixel 下仍会「弹一下」。刻意取舍，别当 bug 改。
- ⚠️ 数字口径：旧文写「官方 19 处 transition、18 处 animation」是 0.2.1 时代的统计。
  0.2.2-rc.1 的两份前端 CSS（`index-lh_YM6sT.css` + `vendor-DV2921Zo.css`）实测
  **22 处 `transition:`、22 处 `animation:`、17 个独立 `@keyframes`**（正则计数，口径是「声明出现次数」）。

**设置页（2026-11-06 改为独立「外观」分区）**：注册 `settings.section`（list 槽），
`id: 'skin'`、`order: 12`、`label: () => '外观'`；导航图标走 `settings.section.icon`（同 id，2×2 方块 SVG）。
组件 props 与原来的 `settings.general.item` 相同（`useStore` + `inject` 返回的动作），所以内容整体平移，
只多了一行说明「正文字号在『通用 → 字体大小』里调」。内容顺序：
皮肤 → 风格 → 主色 → 圆角 → 动效 → 方案 → 导出/导入 → 停用/启用。
（2026-11-06 拆包后「陪看图标」一行已移除，归 whale-sense 自己。）
导航位置在「模型」和「插件」之间（实测回传：`account, general, models, skin, plugins, agent-presets, ...`）。
**真机验证（2026-11-06）**：探针确认 `slots.entries('settings.section')` 回传含 `skin`、label「外观」、
icon 注册 `skin`；**07:49 哥哥肉眼确认「外观」页渲染正常**（`useStore` 在 section 模式下可用）。
**坑**：多步编辑期间 HMR 会推中间态（比如字段改了一半），`debug.log` 可能留下瞬时
`settingsErr=Row is not defined`——**最终代码绿即可，别把中间态当 bug**（清日志后 audit 会恢复全绿）。
控制台：`__dsuSkinLab.brand` / `.brandPalette` / `.setBrand('#be185d')` /
`.radius` / `.radiusPresets` / `.setRadius('square')` / `.motion` / `.setMotion(false)`。

**系统级动效降级（2026-11-05 补，M5「动效」项）**：

- `tokens.css` 第 4 节：`@media (prefers-reduced-motion: reduce)` 下整套皮肤
  `transition` / `animation` / `scroll-behavior` 全归零。**纯 CSS，不经过 JS、不需要用户操作。**
- **系统偏好优先于手动开关**：即便设置里开着动效，系统要求减少也压掉。
- 这条长期只写在 `DESIGN.md` 里、代码里根本没有——属于「文档承诺了、实现没做」，本轮补上。
- 实测（2026-11-05 20:44，临时探针）：页面里 `matchMedia('(prefers-reduced-motion: reduce)').matches = false`，
  说明查询语法被浏览器识别、当前未激活，**观感零变化**。系统真开 reduce 时的关停效果**未在真机验证**（推断：标准媒体查询行为）。
- 新增 `tests/check-motion.mjs` 钉住它：降级块存在、三条压制齐全、块内选择器带卸载前缀、手动开关仍在、
  `syncMotion` 仍是函数声明且调用点 ≥ 4。
  **变异验证**：把块内选择器改成裸 `*`，`check-motion` 与 `check-selectors` 同时红；还原后字节一致。
- **CHECK**：`check-selectors` 其实**会**检查 `@media` 块内的选择器（全局正则从 `{` 之后重新起扫）。
  我一开始推断「它检查不到」，变异实验推翻了——所以才两个检查并存，不是重复。

**陪看图标：已搬走（2026-11-06 拆包）**。这一行原来在设置页里、属性由 UI 插件维护，现在全归 whale-sense：

- 存储 `localStorage['dsh-whale-sense.senseIcon']`，默认 `auto`——有皮肤 → `eye`（pixel 下 CSS 自动换像素眼），
  无皮肤 → 行楷「看」；手动可选 `kanji` / `eye` / `dot`；
- 属性 `html[data-dsh-sense-icon]`（**不再是 `data-dsu-*`**）；
- 控制台 `window.__dshWhaleSense.setIcon(id)`。

**历史教训仍然有效**（别丢）：
- 变异验证：去掉白名单后 `check-input-guard` 红。
  ⚠️ **第一次变异仍然绿**——插入 `syncSenseIcon()` 时我用「6 空格 + syncMotion();」做锚点，
  子串匹配命中了 `repaintSkin` 里 8 空格的那行，**初始化路径根本没调**。
  改用「syncMotion(); + 后面的注释」做锚点才修好。教训：用子串锚点插代码时，前后要带足够上下文。

> ⚠️ **事故记录（2026-11-05）**：`1622bb8` 里混进过一个临时探针（为了截图故意「暂不还原」），
> 之后的脚本把**含探针的工作区文件**当成了原始基线，于是探针一路留到提交里——每次 `apply` 都会
> 把图标强制切成 `dot`。`66fc2e8` 已删除。**教训：任何「暂不还原」的探针，后续脚本的基线必须来自
> git（`git show HEAD:...` 或 checkout），不能读当前工作区文件当 original——那时基线已经被污染了。**

E 板块剩下的旋钮：**密度**（暂缓——官方没有统一的间距抽象，硬做要改几十处）。

**方案与导出 / 导入（2026-11-05 补，E 板块原始要求「一份 JSON，能存多套方案，换机器能带走」）**：

- 导出：`__dsuSkinLab.config` / `.exportConfig(name)` 返回
  `{ format: 'dsh-ui-skin-lab.config', version: 1, exportedAt, name, prefs, schemes }`。
  设置页「导出」按钮复制到剪贴板（`navigator.clipboard` 不可用时退到 `execCommand('copy')`）。
- 导入：`__dsuSkinLab.importConfig(json | object)`。格式/版本不对直接 `false`；
  字段**逐项校验**，非法字段整条跳过、绝不写脏值（`brand: 'red'`、`font: '12em'` 都进不去）。
- 多套方案：`saveScheme(name)` / `.schemes` / `applyScheme(name)` / `deleteScheme(name)`，
  存 `localStorage['dsh-ui-skin-lab.schemes']`，上限 20 套，设置页「方案」行可点。
- **契约**：导入带 `schemes` 字段时**整体替换**本地方案（配置文件是完整快照）；
  不带 `schemes` 时保留本地方案。两条都有测试钉住。
- 真机实测（2026-11-05）：导出 → 导入 → 再导出，`prefs` 完全一致；
  方案 存 / 套用 / 删除 全闭环；`deleted` 一次为 false 是我探针把 `cfg` 取在 `save` 之前
  （里面 `schemes: []`），不是代码 bug——但它把这个「整体替换」契约暴露出来了。

### 3.9 整体核查（2026-11-05 晚，提交 `0bcb314`）

八个角度：包完整性、可移植性、运行日志、**组合交叉**、死代码、**变异验证**、**输入守卫**、文档数字。

| 核验 | 结果 |
|---|---|
| 包完整性 | `files` 字段与磁盘 10 个文件一致；无运行时 dependencies |
| 可移植性 | `lib/index.js` 用 `fileURLToPath`；全包无硬编码绝对路径 |
| 运行健康 | `debug.log` 434 行，无 error/fail |
| **组合交叉** | 预设 × 主色 × 字号 × 圆角 = **24 组**，0 失败。每个 token 都是非空 `{light, dark}`，旋钮覆写与「未设时跟随预设」都对 |
| 死代码 | 无只定义不使用的符号 |
| 测试有效性 | **变异测试**：把陪看小字改回 `label-tertiary`，`check-sense-contrast` 立刻红 5 条（该测试 2026-11-06 已删，能力内化进 `check-contrast`） |
| 输入守卫 | 脏值（`"red"` / `"12em"` / `"huge"` / `"nonexistent"`）不会写进 token 层，合法值仍生效 |
| 文档数字 | 修了「token 覆盖 103」的误导：minimal 103（40+63）、**pixel 104**（41+63） |

**测试从 5 项变 7 项**，新增：

- `tests/check-sense-contrast.mjs` —— ~~陪看面板四组配色的文字对比度（跨包；没装 whale-sense 会 SKIP）~~
  **2026-11-06 拆包时删除**：这条知识变成 `check-contrast` 的通用断言「次要文字 × 层 2 / 层 3 ≥ 4.5」，
  不再依赖陪看仓库。这个盲区之前是**手动算的**，没有自动保护。
- `tests/check-input-guard.mjs` —— 脏 localStorage 值不许写进 token 层。

**组合交叉脚本**放在 `<工作区>/.tmp\verify-combos.mjs`（临时目录，不随仓库走）。

---

### 3.10 板块 C 验收（2026-11-05，四项全过）

原始要求：「浅/深色、宽/窄窗口、多会话各过一遍；所有可点元素 44px 命中区不破。」

| 项 | 状态 | 证据 |
|---|---|---|
| 浅 / 深色 | ✅ | 四宫格（两预设 × 浅深）肉眼验过 |
| **44px 命中区** | ✅ 实测 | 皮肤开 / 关各扫一遍全部可点元素（531 个）：`below24` **68 vs 67**、`below44` **523 vs 523**、最小边都是 4px |
| **宽 / 窄窗口** | ✅ 窄窗口实测 | 视口 868×822：**水平溢出 0**、侧栏宽 0（官方自动折叠）、输入框 688×101 居中、四个 tab 在 28/86/143/214 正常排布 |
| 多会话 | ✅ 实测 | 切到「鱼的第四研究所分所」：视口 1206×822，**overflowX 0**，侧栏 280、头部从 x=280 起、输入框 688×101；消息结构 `user 3 / assistant-step 58 / tool-call 74 / turn-tail 2`，3 个用户气泡全在 |

**多会话那次的额外发现**：陪看面板展开时横向盖住侧栏 **271/280 px**（面板实测在 `(4,132)`）。
这不是皮肤造成的——面板是 `position: fixed` 的浮动层，位置来自 whale-sense 自己 + 拖放保存。
但它确实会挡住导航菜单，属于 D 板块「与皮肤共存」的可用性观察，记在这里，不擅自改别人的定位。

**窄窗口那次我误判过一次**：截图里陪看的折叠小眼睛看着压在「对话」tab 上，我起初写成「眼睛压住 tab」。
`elementFromPoint` 一查——chip 实际在 `(37,131,40×40)`，tab 行是 `y=90~115`，**y 方向根本不重叠**，
是截图缩放（1103 像素图 / 868 视口 ≈ 1.27）造成的视觉错觉。已改。

**44px 这条的正确读法**：DSH 原生就有大量 24–28px 的按钮（最小 4px 是侧栏搜索框）。
「不破」= 我们的改动不把它们变得更小，**不是要求它们达到 44px**。实测皮肤关掉时同样有 523 个低于 44px。

尺寸差异逐个查过（`hdelta` 探针），全部来自**字体替换**——等宽字的字宽和行高与官方系统字不同，
宽度变化 ±9px、高度变化 ≤2px，没有一个是边框/内边距造成的。唯一高度变小的是一个无类名的原生
`button`（24→22px），同样是行高差异，仍高于 20px。

### 3.11 变异覆盖（2026-11-05 补齐，13/13 项都做过；**2026-11-06 起现有 12 项**，`check-sense-contrast` 已删）

「测试绿」不等于「测试有用」——每一项都做过一次「故意改坏 → 确认它红 → 还原」。
没做过变异的测试，可能是永远绿的摆设。

| 测试 | 变异手法 | 结果 |
|---|---|---|
| check-tokens | 把 minimal.dark 的 `bg-base` 改名 | 红 ✅ |
| check-contrast | 把 minimal.light 的 `label-secondary` 改成接近白 | 红 ✅ |
| check-selectors | 规则去掉 `html[data-dsu-skin` 前缀 | 红 ✅ |
| client-smoke | 让 `syncTokens` 不调 `overrideTokens` | 红 ✅ |
| skin-conflict | 启动时不再检测别人的皮肤锁 | 红 ✅ |
| check-sense-contrast | 小字改回 `label-tertiary` | 红 ✅（测试 2026-11-06 已删，能力内化进 check-contrast） |
| check-input-guard | **`readBrand`** 去掉格式校验 | 红 ✅ |
| check-motion | 媒体查询块内选择器裸奔 | 红 ✅ |
| check-skins | `isActiveSkin` 恒真 | 红 ✅ |
| check-layout | 第 4 节塞一条 `border: 2px` | 红 ✅ |
| check-structure | 伪造回传把某个锚点命中改成 0 | 红 ✅ |
| check-config | 导入不校验 `version` | 红 ✅ |
| check-skin-manifest | `package` 字段改错 | 红 ✅ |
| check-selectors | **插一条没登记的裸 `!important`** | 红 ✅（2026-11-06） |
| check-selectors | **删掉一条 `force` 登记** | 红 ✅（2026-11-06） |
| check-skin-manifest | **`dshCompatibility` 改掉** | 红 ✅（2026-11-06） |

**一个真盲区是这次变异抓出来的**：`check-input-guard` 原先只覆盖「读脏值」（`readBrand`），
把 `applyBrand` 的**写入**校验删掉时测试**仍然全绿**。已补 7 条断言
（`setBrand` / `setFont` / `setRadius` 拒脏值 + 不污染存储），再变异就红了。
教训：**写入路径和读取路径是两个攻击面，别只测一边。**

所有变异都用 bytes 级还原（`client.js` 是 CRLF），跑完 `git status` 必须干净。

**探针还原同样走 cp 备份，别用 `git checkout`**（2026-11-06 实测事故）：工作区改动还没提交时
`git checkout -- client.js` 会把整份改动一起丢回上次提交（本棒丢过 63 行 `settings.section` 改动）。
正确做法：`cp client.js .tmp/client.js.pre-probe` → 插探针 → 验完 `cp` 回来 → 再 `AppendAllText ' '`
触发一次 HMR，最后 `git status` 确认干净。

**探针里的定时器必须挂进 dispose 清理**（2026-11-06 踩到）：插在 `client.js` 里的探针若用
`setInterval` 写 `document.title`、却没在 cleanup 里 `clearInterval`，**每次 HMR 都会泄漏一个定时器**，
多个探针抢着写同一个标题，读回来的数据新旧混杂（旧版报 `kanji=V`、新版报 `kanji=V[c,26x26]`），
一度误判成「CSS 没生效」。处置：拦截 `document.title` 的 setter、只放行不带探针前缀的值，
再还原文件。**观测工具自己污染观测，是这类探针最隐蔽的失败方式。**

### 3.12 可分发：tarball 本机模拟真装（2026-11-06，F 板块收口）

「换机器真装」原本没验。2026-11-06 用**本机模拟**补上了核心那一环：把自己的 tarball 装进真 DSH。

**做法**（全部实测）：

1. `pnpm pack`（**必须在 `packages/dsh-ui-skin-lab` 里跑**）→ `<工作区>/.tmp\packtest2\dsh-ui-skin-lab-0.1.0.tgz`
   （30622 字节）。包内 11 个文件，`lib/client.js` 与源码 **SHA256 完全一致**。
2. `remove_bundle dsh-ui-skin-lab` → **手工删掉残留 junction**（`cmd /c rmdir`，对 junction 只删链接）。
   ⚠️ 不删的话 pnpm 会把包解进 junction 目标，**直接覆盖源码目录**。
3. `install_bundle target='<工作区>/.tmp/packtest2/dsh-ui-skin-lab-0.1.0.tgz'`
   → pnpm `add` 该路径；`node_modules/dsh-ui-skin-lab` 变成**实体目录**，package.json 写 `file:...tgz`。
4. **重启 DSH**（见下面第一条坑）。
5. 验证：新进程 `boot clientPath=...\profiles\desktop\node_modules\dsh-ui-skin-lab\lib\client.js`；
   实体包目录里出现 `debug.log`；源码目录的 `debug.log` **停止增长**。
6. 变异验证：碰实体包 `client.js` 的 mtime → 实体包日志 +693 字节、源码 0 变化。
7. 回滚：`remove_bundle` → `install_bundle link:<repo>/packages/dsh-ui-skin-lab`；
   junction 恢复、HMR 重新跟源码、十三项全绿。

**⚠️ 最大的坑：换包不会热重载，必须重启 DSH。**
装 tgz 后不重启，Host 沿用旧的模块解析（`clientPath` 仍指源码目录），日志仍写源码、HMR 仍监视源码——
看起来「装了但没生效」，其实是进程缓存。**判据：碰哪个目录的 `client.js` 能触发 apply，当前真正加载的就是哪份。**
（当时对照实验：碰 `node_modules` 的 0 字节，碰源码的 +693 字节 → 结论是用源码。）

**另一个坑：`install_bundle` 不能直接改 spec。** 同包名已装时会报 `already-installed`，必须
`remove_bundle` → `install_bundle`。中间窗口里页面会短暂回原生，正常。

**这次证明了什么**：包自足（tarball 里的 11 个文件够用）、pnpm 能从 tarball 装、DSH 新进程能从实体包解析
client/Host、patch 与 manifest 在实体包里同样生效。
**仍然没做的**：真的另一台机器（路径、权限、registry 形态可能不同）。本机模拟排除的是「包内容不全」和
「DSH 吃包姿势不对」——这两类是真装最容易翻车的地方。

---

## 4. 关键技术事实（全部实测，不是推断）

### 4.1 样式进页面

- **`<link rel="stylesheet">` 不行**：`dsh-app://app/` 下 onload 触发、HTTP 200，但规则一条都不应用。
- 必须 `fetch()` 取文本 + `<style>` 注入。官方皮肤 maid-atelier 也是这么做的。

### 4.2 token 必须落在 body

- DSH 官方在 **`body`** 上声明整套 `--dsw-*`。元素自身声明优先于继承，所以写 `html` 的覆盖后代读不到。
- 现场证据（同一时刻）：`fill@html=#d9c9f5`（我们的）、`fill@body=#f9fafb`（官方的）、`fill@col=#f9fafb`（继承 body）。
- **现在走 `overrideTokens` 就没这个问题了**——官方 presenter 写的就是 body 内联样式。这条留着是为了看懂历史，以及以后别又手写变量 CSS 回去。

### 4.3 Host 侧没有热重载

- 改 `lib/index.js` 要「禁用再启用」才生效（`PLUGINS.md` 记过）。而 `ui-skin-lab` 这一行**不在 profile 的 `cordis.patch.yml`**（它来自包自己的 bundle patch），连「改配置触发 HMR」都不行。
- 后果：Host 加资源路由在当前进程里做不到，只能重启 DSH。试过 `tokens.json` 路由 → 404，只能回退。

### 4.4 HMR 会留下多份 `<style>`

- 每次改 `client.js` 都往 head 追加一份，旧的不一定被 dispose。
- 两份叠着时**旧标签的变量盖住新预设**，症状是「改了 CSS 纹丝不动」。现场抓到 tag0（9 条规则）+ tag1（13 条规则）。
- 已修：插入前清场，cleanup 全清，设置行样式同样处理。
- 另：`overrideTokens` 按 **source** 分层，换 source 等于多一层（不会自动消失）。所以切预设永远用同一个 source `'dsh-ui-skin-lab'`。

### 4.5 `overrideTokens` 的语义（读源码得来）

- 每个 source 一层；重复调用**整层替换**；值必须 `{ light, dark }` 成对（传裸字符串会抛教学错误）。
- **不校验 token 名**：拼错的变量照样写进 body，但没人消费，页面看起来「什么都没发生」。
  → 这就是 `tests/official-tokens.json`（419 个名字）存在的原因，`check-tokens` 会拦。

### 4.6 页面与刷新

- 页面在 `dsh-app://app/`（Electron 自定义协议），不是 `http://127.0.0.1:PORT`。
- **Ctrl+R 不生效**。只认 HMR：改 `lib/client.js` 会推；改 `tokens.css`、启停插件、改 patch **不会推**。
- 改完 CSS 要 `printf ' ' >> lib/client.js` 碰一下触发 HMR。
- 真脏了只能关窗口重开或重启 DSH。

- ⛔ **绝对不要在插件代码里调 `location.reload()`**（2026-11-06 真炸过）。为了验「重载后皮肤属性
  不出现」，有人往 whale-sense 的 `client.js` 插了一段带 `location.reload()` 的探针（还加了
  localStorage 一次性标记防循环），结果页面重载后界面卡死，**只能卸载重装 DSH**——重装还把
  profile 重置成默认值（bundles 从 26 掉到 2、patch 从 11 条掉到 3 条），是个连环事故。
  `dsh-app://` 下的重载不是普通刷新，代价是一整块 UI 可能起不来。
  **要验「重载后的状态」，请人在安全时机手动重启，不要自己造。**
  完整记录见 `checkpoint-6a4dec9a.md` 的「⛔ 事故记录」。

### 4.7 页面有 80% 缩放

`border-right: 2px` 的 computed 值是 `1.6px`。核对尺寸时别把 1.6px 当成官方样式。

### 4.8 已知命中的选择器（实测 querySelectorAll 数量）

| 选择器 | 命中 | 用途 |
|---|---|---|
| `[data-slot="sidebar"]` | 1 | 侧栏槽位 |
| `[class*="sidebarCol"]` | 1 | 侧栏真容器（哈希类名） |
| `header[class*="header"]` | 1 | 会话头部 |
| `[data-slot="conversation.header"]` | 1 | 头部槽位（加隔线用） |
| `[data-composer-card]` | 1 | 输入框卡片 |
| `[class*="titlebar"]` | **0** | 不存在这个类，已删相关规则 |

写新选择器前先用 client 的 `querySelectorAll` 诊断，别猜。

### 4.9 Host 插件约束

- `inject` 必须写 `['webServer', 'connection', 'clientModules']`。缺 `connection` 会让 handler 访问 `ctx.connection` 抛错 → 路由 400。
- 路由要过 `connection.requestRejection(req)` 同源校验。
- 装包用 `plugin_manager install_bundle`，别手写 profile 的 `package.json` / `cordis.patch.yml`。

### 4.10 诊断通道

- Host 在 `/dsu-skin` handler 里用 `note()` 写 `packages/dsh-ui-skin-lab/debug.log`（1MB 上限已加，**要重启才生效**）。
- client 用 `fetch('/dsu-skin/ping?...')` 回传状态。
- 这套通道排除了「没加载 / 加载了没生效 / 生效了看不见」三种情况，**别删**。

---

## 5. 文件地图

```
<repo>/
  ARCHITECTURE.md          分层模型、ADR（含被更正的 ADR-003）、第 10 节 11 条实测记录
  DESIGN.md                两套预设的视觉方向与数值（实现真源在 client.js）
  HANDOVER.md              本文件
  packages\dsh-ui-skin-lab\
    package.json           包定义（dsh.bundle.patch + dsh.client.platform=web）
    cordis.patch.yml       只插一行：id=ui-skin-lab, name=dsh-ui-skin-lab
    skin.json              皮肤清单（id / wiring / bodyAttr / 兼容版本 / multiSkin）
    lib\index.js           Host：/dsu-skin/tokens.css 路由 + debug.log（118 行）
    lib\client.js          Client：约 1078 行。PRESET_TOKENS / SHARED_TOKENS / syncTokens /
                           applyPreset / 设置行 / window.__dsuSkinLab / cleanup
    tokens.css             **组件级覆盖**（结构，不含值）
    selectors.json         所有依赖官方 DOM 的选择器登记表（15 条）+ 3 条 !important 登记（`force`）
    assets\icon.svg        包图标
    locale\zh.json / en.json
    debug.log              诊断日志（.gitignore）
  packages\dsh-ui-skin-plain\
    lib\client.js          多皮肤的第二套：hub 注册 + 锁 + 两个中性灰 token（不做结构覆盖）
    lib\index.js           Host 空壳（只打一条 logger），没有资源路由
    cordis.patch.yml       只插一行：id=ui-skin-plain
    skin.json              皮肤清单（同 lab，bodyAttrValues 只有 plain）
  tests\
    official-tokens.json   官方 token 名白名单（419 个）
    check-tokens.mjs       14 必需 token + 名字白名单 + SHARED_TOKENS 校验
    check-contrast.mjs     WCAG 对比度（正文/次要 ≥4.5，品牌 ≥3）+ **次要文字 × 层 2/层 3**（2026-11-06 内化）
    check-selectors.mjs    前缀纪律 + 选择器登记 + 高风险 fallback + **!important 必须登记在 force 里**
    client-smoke.mjs       假 DOM 跑 apply：token 推送、设置行注册、cleanup
    skin-conflict.mjs      M5 互斥：协议锁 / 特征标记 / 开关 / 停用清场（26 条断言）
    check-input-guard.mjs  脏 localStorage 值不许写进 token 层
    check-motion.mjs       动效契约：系统级 reduce 降级块 + 手动开关 + syncMotion 不退化
    check-skins.mjs        多皮肤：两套同装 / 切换 / 让位顺序 / 卸载（两份 hub 实现放一起跑）
    check-layout.mjs       交互组件覆盖纪律：第 4 节只许写不占布局的属性 + 关键锚点在
    check-structure.mjs    结构锚点基线：探针清单 vs 登记表 / present 锚点命中 0 判失败
    check-config.mjs       配置导出/导入/多套方案：往返一致、脏值拒绝、方案整体替换
    check-skin-manifest.mjs 皮肤清单一致性：字段 / package / wiring / id / bodyAttr / files
```

---

## 6. 常用命令

```bash
# 路径按本机替换：<repo> = 本仓库根
NODE=node
cd <repo>

# 十二项自检（改完必跑；check-sense-contrast 已于 2026-11-06 内化进 check-contrast）
"$NODE" tests/check-tokens.mjs
"$NODE" tests/check-contrast.mjs
"$NODE" tests/check-selectors.mjs
"$NODE" tests/client-smoke.mjs
"$NODE" tests/skin-conflict.mjs
"$NODE" tests/check-input-guard.mjs      # 脏 localStorage 值
"$NODE" tests/check-motion.mjs           # 系统级 reduce 降级 + 手动开关
"$NODE" tests/check-skins.mjs            # 多皮肤：两套同装 / 切换 / 让位顺序 / 卸载
"$NODE" tests/check-layout.mjs           # 交互组件只许写不占布局的属性
"$NODE" tests/check-structure.mjs        # 结构锚点基线（没回传会 SKIP）
"$NODE" tests/check-config.mjs           # 配置导出/导入/方案（往返一致、脏值拒绝）
"$NODE" tests/check-skin-manifest.mjs    # 皮肤清单与代码一致（字段/package/wiring/id/bodyAttr）

# 语法
"$NODE" --check packages/dsh-ui-skin-lab/lib/index.js
"$NODE" --check packages/dsh-ui-skin-lab/lib/client.js

# 触发 HMR（改完 tokens.css 必须做一次）
printf ' ' >> packages/dsh-ui-skin-lab/lib/client.js

# 看诊断日志
tail -8 packages/dsh-ui-skin-lab/debug.log
grep -a "settingsRow\|settingsErr\|tokenErr" packages/dsh-ui-skin-lab/debug.log | tail -3

# 从 client.js 里读 PRESET_TOKENS（调试用）
"$NODE" -e "const c=require('fs').readFileSync('packages/dsh-ui-skin-lab/lib/client.js','utf8');const m=c.match(/const PRESET_TOKENS = (\{[\s\S]*?\n {6}\});/);const t=new Function('return '+m[1])();console.log(Object.keys(t), Object.keys(t.minimal.light).length)"
```

切换预设（浏览器控制台）：`__dsuSkinLab.select('pixel')`，存在 `localStorage['dsh-ui-skin-lab.preset']`，默认 `minimal`。

---

## 7. 已知问题 / 下一步

**DSH 升级验证（2026-11-06）**：`0.2.1-rc.5` → `0.2.2-rc.1` 已实测通过——
十三项全绿、结构锚点全在、boot 无 error。升级前快照与升级后结果都在
`UPGRADE-BASELINE.md`（§3 基线 / §3.1 结果 / §5 下次照跑）。

**F 板块：可分发已闭环（本机模拟，2026-11-06）**。`pnpm pack` → `install_bundle <tgz>` → **重启 DSH** →
新进程从 `node_modules` 实体包加载（`clientPath` 实证）。详见 §3.12。
真正「另一台机器」仍未做（哥哥 2026-11-05 定过往后延），但本机模拟已排掉真装最容易翻车的两类：
**包内容不全** 与 **DSH 不吃包**。

其余：

1. ~~pixel 全局硬切未做~~ → **2026-11-06 已实现并验收**：只压 `transition`（pixel 整页 0 个），
   保留 `animation`（spinner / 状态点 / 骨架屏 / 打字点）。见 §3.8。
2. **Host 层（`lib/index.js`，118 行）没有测试**：路由、诊断日志、401/404 分支都没被测过。风险低但存在。
3. **minimal 浅色仍接近原生**（白底 + 浅灰层），侧栏已提到 `#f1f3f6`，要不要再加强等哥哥定。
4. 剩余 19 个 token 刻意不改（语义色：文件对比红绿、遮罩黑、引导页）。
5. `debug.log` 的 1MB 上限代码已写，**要重启 DSH 才生效**。
6. **密度旋钮暂缓**：官方没有统一间距抽象，间距散在各组件里。
7. **板块 C 外壳页面完全没动**。
8. 陪看字幕压在输入框上（`bottom: 76px`，是 whale-sense 原有定位，不是皮肤造成的）。
9. ~~M5「多皮肤」卸载未验~~ → **2026-11-06 已真机验过**：卸非激活 / 卸激活 / 重装 / 源目录完整性
   四个场景全过，含「卸掉激活皮肤后回 DSH 原生且不崩」。见 §3.6.2。
10. ~~菜单的形态规则没真机验过~~ → **2026-11-05 已验**（见 §3.7），五类交互组件全过。

---

## 8. 决策记录（哥哥定的，别擅自改）

- 极简 = **深色高对比（Linear 式）**，不是白底细线。
- 像素 = 16-bit：直角、2px 硬边、硬阴影、等宽字。
- **不打包像素中文字库**（体积代价太大）。
- 一套皮肤 + 两个预设；M4 后再考虑拆包。
- **默认预设 = minimal**（哥哥 2026-11-05 定）。
- 做的时候多问他，一起拿主意。
- 先验证「可见的一刀」再继续。
- **设置行用分散排版**（每项标题一行、控件一行）。2026-11-05 试过两列紧凑版，体感不如分散，已回退。
- **独立「外观」设置页**（2026-11-06）：注册 `settings.section`（id `skin`），不再挂在「通用」分区里。
  这是 E 板块原始定义的要求；控件内容不变，只是换了容器和入口。
- **正文字号交给官方**（2026-11-06）：官方「通用 → 字体大小」更细（10–22px 步进 + 代码/终端 + 字体族 +
  快捷键 + Host 持久化），皮肤不再提供字号旋钮，避免抢同一个变量把官方设置压掉。
  字体族同理：用户设过就让位（见 §3.8）。

---

## 9. 环境

- UI 目录：`<repo>`（git，最新提交见 `git log --oneline -1`）
- 包：`<repo>/packages\dsh-ui-skin-lab`，profile `$DSH_HOME/profiles\desktop` 里 link 到 `node_modules`
- 第二套皮肤：`<repo>/packages\dsh-ui-skin-plain`（素色基准，2026-11-05 装进 profile，link 到 `node_modules`）
- 陪看插件真身：`<whale-sense 仓库>`（git，`node_modules/dsh-whale-sense` 是软链；M2 的改动在这里，未提交）
- 插件行：`include:ui-skin-lab`（在包自己的 `cordis.patch.yml`，不在 profile patch）
- DSH `0.2.2-rc.1`；Web GUI `http://127.0.0.1:52255`（重启会变）
- 页面协议：`dsh-app://app/`
- 已禁用的皮肤：`include:ui-skin-maid-atelier`
- 仍在跑的其他 UI 插件：`dsh-whale-widget`（右下角角色）、`dsh-better-sidebar`
- node：`node`

---

## 10. 相关文档（按优先级）

1. `<repo>/ARCHITECTURE.md` —— 分层、ADR、第 10 节实测记录（11 条）
2. `<repo>/DESIGN.md` —— 视觉方向与数值表
3. `<工作区>/PLUGINS.md` —— 插件手艺：重载粒度、`ctx.effect` 清理、config 整段替换
4. `<repo>-PROJECT.md` —— 六板块与里程碑原始规划
5. `<工作区>/HANDOFF.md` —— 技术总表
6. 官方源码（asar 内，用 `<工作区>/.tools\asar-peek\index.cjs get <内部路径> <输出>` 导出）：
   - `dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/lib/client.js` —— **`overrideTokens` 与 `AppearanceRow` / `slots.register` 的写法，最有用**
   - `dsh/node_modules/@deepseek-ai/dsh-client-ui-theme/README.zh.md` —— 主题体系说明
   - `dsh/node_modules/@deepseek-ai/dsh-client-ui-layout/lib/client.js` —— `ThemePresenter.apply()`
   - `dsh/node_modules/@deepseek-ai/dsh-web-frontend/dist/assets/index-BNyAYEM7.css` —— 官方组件样式（77KB）
   - `dsh/node_modules/@deepseek-ai/dsh-client-modules/README.zh.md`、`dsh-client-hmr/README.zh.md`
