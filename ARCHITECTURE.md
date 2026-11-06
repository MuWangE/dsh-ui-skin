# UI 定制项目 · 架构决策（M1）

> 2026-11-05 建档。这份文件回答一个问题：**以后改东西，什么时候只改数据、什么时候才动代码。**
> 目标不是「能跑」，是「跑起来之后不常回来打补丁」。

---

## 1. 约束

- 只走插件 + 槽位 + CSS 变量 + 官方客户端服务，不碰 `app.asar`、不改官方组件源码。
- 一套 runtime 下支持多个预设（先极简、像素），未来加风格 = 加数据。
- 官方 DOM / 类名 / token 会随 DSH 升级变化——**把这种变化关进两个文件，别让它渗进每个 CSS**。
- 卸载/禁用后页面必须回到原样，不能留属性、样式、监听。

## 2. 分层模型

三层，依赖单向向下，禁止反向引用：

```
┌─────────────────────────────────────────────┐
│ 值层    lib/client.js 的 PRESET_TOKENS      │  每个预设的 token 值（颜色/圆角/字体）
│         tokens.css 的组件覆盖段              │  「哪些元素要 2px 硬边框」这类结构
├─────────────────────────────────────────────┤
│ 机制层  lib/client.js（runtime）            │  只写「怎么装、怎么切、怎么退」
│         lib/index.js（Host 资源路由）        │
├─────────────────────────────────────────────┤
│ 契约层  tests/official-tokens.json          │  官方 token 名白名单（拼错要能拦住）
│         selectors.json（DOM 依赖登记）       │
└─────────────────────────────────────────────┘
```

**值的通道**（2026-11-05 定）：token 值走 `ctx.theme.overrideTokens()`，官方 presenter 会把
它们写成 **body 内联样式**（优先级最高、自动随 light/dark 切换、卸载自动撤回）。
组件覆盖仍走 `<style>` 注入 —— token 只能改「值」，改不了「哪个元素用什么」。

**判断标准**：新增一个风格，只需要在 `PRESET_TOKENS` 加一组值（必要时加几条组件规则）；
官方改结构，只需要改 `selectors.json` 和对应 CSS 段。如果做不到，说明分层漏了。

## 3. 目录与命名

```
<repo>/
  ARCHITECTURE.md            # 本文件
  DESIGN.md                  # 视觉规范
  packages\
    dsh-ui-skin-lab\         # M1 实验包（将来可拆成 runtime + skins）
      package.json
      cordis.patch.yml
      lib\index.js           # Host：资源路由（唯一 Host 逻辑）
      lib\client.js          # Client：加载/切换/清理 + PRESET_TOKENS（token 值唯一真源）
      tokens.css             # 组件级覆盖（结构，不含值）
      # 预设元数据不单放：label / description 和 token 值一起写在 lib/client.js 的
      # PRESET_TOKENS 里。原计划的 presets/*.json 没落地（2026-11-06 核实），见 ADR-002 的代价。
      skin.json              # 皮肤清单（id / 名称 / 标签 / 兼容版本 / multiSkin）
      selectors.json         # 所有「依赖官方 DOM」的选择器登记表
      assets\icon.svg
      locale\zh.json / en.json
  tests\
    official-tokens.json     # 官方 token 名白名单（拼错要拦）
    check-tokens.mjs         # 变量完整性 + 名字合法性
    check-contrast.mjs       # WCAG 对比度
    check-selectors.mjs      # 选择器登记与实际使用一致
    client-smoke.mjs         # 假 DOM 跑一遍 apply
```

**命名**：

- 包：`dsh-ui-skin-lab`（实验期）。正式皮肤 `dsh-ui-skin-<id>`。
- HTML 属性：`html[data-dsu-skin="<preset>"]`。
- CSS 变量前缀：`--dsu-*`（自有扩展）；官方 `--dsw-*` 只读不造。
- 本地存储键：`dsh-ui-skin-lab.preset`。

## 4. 扩展点：每种改动要碰哪里

| 我想…… | 改哪里 | 要不要动 JS |
|---|---|---|
| 加一种风格（如「毛玻璃」） | `lib/client.js` 的 `PRESET_TOKENS` 加一组 + `PRESETS` 加 id | 是（值在 JS 里） |
| 调整某风格的颜色/圆角/字体 | `PRESET_TOKENS` 对应预设 | 是 |
| 加减主色色板 / 改色块 | `BRAND_PALETTE`（`lib/client.js`） | 是 |
| ~~调字号档位~~ | **已撤**（ADR-008）：字号交给官方「通用 → 字体大小」 | — |
| 调整某风格的结构（边框、阴影、直角） | `tokens.css` 对应段 | 否 |
| 官方改了个类名导致某块没样式 | `selectors.json` + 对应 CSS 段 | 否（若选择器有替代） |
| 新增一个组件覆盖（如消息气泡） | `tokens.css` + `selectors.json` 登记 | 否 |
| 改切换方式（快捷键、设置页） | `lib/client.js` | 是 |
| 换存储（localStorage → DSH 配置） | `lib/client.js` 的 `store` 对象 | 是 |
| 改圆角三档 | `RADIUS_PRESETS`（`lib/client.js`） | 是 |
| 改动效压制（手动开关 / 系统 reduce / pixel 硬切） | `tokens.css` 对应三段 + `selectors.json` 的 `force` | 否（**必须登记，否则 check-selectors 红**） |
| 改陪看图标三态 | **不在本包**：whale-sense 自己维护（`window.__dshWhaleSense` + `data-dsh-sense-icon`） | — |
| 改配置导出/导入契约 | `lib/client.js` 的 `exportConfig` / `importConfig` + `check-config` | 是 |
| 加一个调试开关 | `lib/client.js` | 是 |

**规则**：`tokens.css` 是组件数据；`lib/client.js` 同时是机制**和** token 值数据（2026-11-05 起）。
值放 JS 是因为 Host 没有热重载，而 token 值要能即时生效——代价是「加风格要动 JS」。
改 `tokens.css` 需要碰一下 `client.js` 触发 HMR；改 `PRESET_TOKENS` 直接生效。

**注意（2026-11-06 核实）**：加一个预设不只是「加数据」——`tokens.css` 还要**复制一段**
`html[data-dsu-skin="<新 id>"]` 的结构覆盖（pixel 段约 100 行）。这是 §1「未来加风格 = 加数据」
唯一没兑现的地方。第 3 个预设之前应该先把它解决掉（把公共部分下沉到 `html[data-dsu-skin]`，
只有真正不同的才分段），否则预设越多、段之间越容易漂移。

### 4.1 组件消费矩阵（做新组件前先查这张表）

官方前端**几乎不硬编码颜色**（2026-11-05 扫全量 CSS：只有 3 条规则直接写颜色，都是引导页/复制提示这种无害的）。
所以新组件的正确做法不是「写一堆选择器改颜色」，而是先判断它走哪条路：

| 组件 | 颜色/圆角/字体从哪来 | 还需结构覆盖吗 | 锚点 |
|---|---|---|---|
| 侧栏 | `--dsw-specific-sidebar-*` | 是（2px 右边） | `[data-slot="sidebar"]`、`[class*="sidebarCol"]` |
| 会话头部 | `--dsw-alias-*` | 是（2px 下边） | `header[class*="header"]` |
| 输入框卡片 | `--dsw-alias-*` | 是（2px 边 + 硬阴影） | `[data-composer-card]` |
| 滚动条 | 自绘 | 是（方块化） | `::-webkit-scrollbar` |
| Markdown 代码块 | **`--dsl-code-block-*` → `--dsw-*` 已自动跟随** | 是（硬边 + 硬阴影） | `.md-code-block` |
| 终端/命令块 | `--dsl-terminal-*` → `--dsw-*` **已自动跟随** | **做不了**：容器是哈希类名 `._block_8z71b_1`，没有稳定锚点 | — |
| 工具调用条目 | `--dsw-alias-*` 已跟随 | **做不了**：`[data-tool]` 试过，紧凑态是纯文本没有边框载体；展开态是哈希类名，分散在 `dsh-client-ui-tool` 等几个包里 | — |
| 陪看面板 | `--dsw-*`（whale-sense 自己消费） | **不在本包**：whale-sense 自己读 `data-dsu-skin` 做适配 | — |
| 用户消息气泡 | `--dsw-alias-*` | 是（inset 2px 描边 + 外硬阴影） | `[data-chat-flow-kind="user"] [class*="bubble"]` |
| 按钮 | `--dsw-alias-*` | 是，但**只在按钮集群里**（输入区 / 对话框 / 菜单）；全局只做 hover 描边 | `button:not([disabled])` |
| tab | `--dsw-alias-*` | 是（底部 2px；选中换品牌色） | `[role="tab"]`（`aria-selected`） |
| 菜单 / 对话框 | `--dsw-alias-*` | 是（outline + 硬阴影） | `[role="menu"]` / `[role="dialog"]` / `[role="alertdialog"]` |
| 菜单项 | `--dsw-alias-*` | 是（hover 换背景） | `[role="menuitem"]` 及 checkbox/radio/option |

**布局纪律（`tests/check-layout.mjs` 强制）**：`tokens.css` 第 4 节的声明只允许
`box-shadow` / `outline` / `outline-offset` / `background` / `color` / `border-radius` 这类**不参与布局**的属性。

原因是实测出来的：官方按钮高度只有 24px、tab 25px，页面上有 268 个 `button`。
给它们加 `border` / `padding` / `margin` 会改盒模型，整版一起歪，而且很难归因。
**描边一律用 `inset box-shadow`，浮层用 `outline`**——两者都不占布局。

真机实测（2026-11-05，pixel 皮肤，读计算样式）覆盖前后尺寸完全一致：
气泡 40x42、输入区按钮 28x28、侧栏按钮 256x24、tab 26x25。

**按钮为什么不做全局常驻描边**：先按「268 个全加」做了一版，真机截图显示侧栏每个菜单项
都变成方框，视觉噪音盖过内容，违背「界面退后、内容在前」。收敛成「按钮集群常驻 + 全局 hover」。

**关键发现**：官方有一套自己的中间变量层 `--dsl-*`（19 个），全部映射到 `--dsw-*`：
`--dsl-code-block-background` / `-border-radius` / `-banner-background-color`、
`--dsl-terminal-radius` / `-font`、`--dsl-search-radius`、`--dsl-web-radius`。
**这些组件的形态已经跟着 token 走了**，别再去写重复的选择器。只有官方没抽象成变量的地方（边框粗细、硬阴影、间距常量）才需要结构覆盖。

**形态常量在 `tokens.css` 第 0 节**（`--dsu-edge` / `--dsu-shadow-sm|md|lg` / `--dsu-scrollbar`），
只在 pixel 下定义、引用处都带兜底。新组件直接用它们，不要再抄 `2px` / `rgba(0,0,0,.28)`。

**覆盖率基线（2026-11-05 实测）**：官方 CSS 实际引用 94 个 `--dsw-*`，皮肤覆盖 56 个（60%）。
未覆盖里值得补的：9 个 `--dsw-static-*` 色板（amber/deepseek/green/red/neutral-bluish，像素风下会露出官方色）、
`--dsw-alias-code-diff-added|deleted`、`--dsw-alias-label-error`、`--dsw-alias-bg-layer-4`、`--dsw-specific-menu`。
其余是字号类 `--dsw-font-markdown-*`（等宽字体已随 `--dsw-font-family` 生效）和 `--dsw-elevation-*`（那是 `0 0 0 .5px` 描边阴影，不承担浮层投影）。

## 5. 契约与检查（防补丁的核心）

### 5.1 token 契约

- `tests/official-tokens.json` 记录官方主题层定义过的**全部 token 名**（2026-11-05 抽取：body 层 113 个，
  加圆角/字体/static 色板共 419 个），来源 `@deepseek-ai/dsh-client-ui-theme/lib/client.js`。
- `tests/check-tokens.mjs` 断言：每个预设（`minimal` / `pixel`）× 每种模式（light / dark）都定义了 **M1 时期的必需 14 个** token
  （现在实际覆盖 minimal 103 / pixel 104，14 只是保底，不是当前规模），
  且**所有用到的 token 名都在白名单里**（`overrideTokens` 不校验名字，拼错会被静默吞掉）。
- 官方加 token → 重新抽取白名单，检查脚本会提示「未覆盖的新 token」。

### 5.2 选择器契约

所有 `html[data-dsu-skin] ...` 里依赖官方 DOM 的选择器，必须先在 `selectors.json` 登记：

```json
{
  "entries": [
    {
      "id": "sidebar-slot",
      "selector": "[data-slot=\"sidebar\"]",
      "purpose": "左侧栏容器（槽位根，官方稳定契约）",
      "risk": "low",
      "fallback": null
    }
  ]
}
```

- `tests/check-selectors.mjs` 断言：CSS 里出现的官方选择器都在登记表里；登记表里标 `risk: high` 的选择器必须有 `fallback`。
- 运行期能力探测：关键选择器缺失时，`lib/client.js` 给 `html` 加 `data-dsu-degraded`，对应的 CSS 段自动让路。

### 5.3 安全红线

- **禁止无前缀选择器**。所有样式必须以 `html[data-dsu-skin]` 开头。这样卸载包时属性一撤，样式全失效，天然回退。
- **禁止 `!important` 大面积使用**。只允许在「官方内联样式覆盖」的登记条目里用，且写进 `selectors.json` 的 `force` 字段。
  **2026-11-06 补执法**：当前登记 3 条（`motion-off` / `reduced-motion-system` / `pixel-hardcut`），
  `check-selectors` 第 5 条断言会拦「没登记的 `!important`」；媒体块内外的登记不能混用。
  变异验证过：插一条裸规则、删一条登记，都会红。
- **禁止改 DOM 结构**。只改 class/attribute 和 CSS 变量；需要加元素时走槽位注册。

## 6. 状态与持久化

- 当前预设：`localStorage['dsh-ui-skin-lab.preset']`，缺省 `minimal`。
- 其余偏好（2026-11-06 拆包后实况，共 6 个键）：`dsh-ui-skin-lab.brand` / `.radius` / `.motion` /
  `.enabled` / `.schemes`，以及跨皮肤的 `dsh-ui-skin.active`。
- 抽象成 `store`（`get/set`），未来换 DSH 配置或跨设备同步只改这一处。
- 运行时状态：`html[data-dsu-skin]`、`html[data-dsu-degraded]` 两个属性，不存 DOM 树。
- 清理：`apply` 返回的 cleanup 必须撤掉 token 层（`disposeTokens()`）、注入的 `<style>`、属性、监听、全局入口。

## 7. 升级与回退

**DSH 升级后跑什么**（2026-11-05 已固化成脚本，不再靠人记）：

```bash
NODE=node
cd <repo>

"$NODE" tests/check-tokens.mjs      # 官方 token 有没有增减、白名单还对不对
"$NODE" tests/check-structure.mjs   # 结构锚点还在不在（读真机回传的基线）
"$NODE" tests/check-selectors.mjs   # 前缀纪律、登记表、fallback
```

**`check-structure` 是怎么工作的**（客户端探针 + 离线对账，不需要浏览器自动化）：

1. `lib/client.js` 里有一份 `STRUCT_ANCHORS` 清单，内容必须与 `selectors.json` 里
   `expect = present | conditional` 的条目**完全一致**（测试会比对，防止两份漂移）；
2. 页面启动 2.5 秒后，探针对每条选择器跑 `querySelectorAll().length`，
   整包一次回传 `/dsu-skin/ping?struct=<json>`；
3. Host 把这条写进 `debug.log`；
4. `tests/check-structure.mjs` 取**最近一条**回传：`expect=present` 的锚点命中 0 就判失败。

所以升级后的动作是：**重开一次 DSH（让页面跑一次探针）→ 跑命令**。
没有回传时测试是 `SKIP` 而不是失败——没开 DSH 的机器也能跑，只是不知道现场。

**有失效锚点怎么办**：只改 `selectors.json` 和 `tokens.css` 对应那一段，不重构。
`risk=high` 的条目必须同时更新 `fallback`。

**实测（2026-11-06，`0.2.1-rc.5` → `0.2.2-rc.1`）**：按上面三步跑完，十三项全绿、
9 个 present 锚点全在、boot 无 error。官方新增 4 个客户端包（context-menu / message-quotes /
file-actions / file-drag），没有动已有锚点；官方 CSS 引用 token 122 → 138，无消失。
详细记录见 `UPGRADE-BASELINE.md` §3.1。

**回退**：禁用插件 → `html[data-dsu-skin]` 消失 → 所有样式失效；`apply` 的 cleanup 再兜一层。不需要恢复备份。

## 8. 决策记录（ADR）

**ADR-001 单包 vs 多包**：M1 先单包（runtime + 预设同包），因为只有一个消费方；等第二个皮肤或设置页出现再拆成 `dsh-ui-skin-runtime` + `dsh-ui-skin-*`。拆的时候只要 `lib/index.js` 的资源路由和 `lib/client.js` 的注册表不变，表现层不用动。
**被否**：现在就三包——过度拆分，M1 会先卡在包间协议上。

**ADR-002 预设打包策略**：token 值全部写进 `lib/client.js` 的 `PRESET_TOKENS`（每预设一组 `{light, dark}`），
组件结构写进一个 `tokens.css`（按预设分段），用 `html[data-dsu-skin="<id>"]` 切换。
**理由**：token 走官方通道，切换是整层替换、无闪烁；CSS 只承载「哪些元素加边框」这类结构，体积很小。
**代价**：加风格要改 JS（见第 4 节）。**触发拆分**：预设 ≥ 5 个或单个预设 token 表 > 20KB 时，
改成按需加载的方案（`PRESET_TOKENS` 拆文件 + 动态 import）。属性语义不变。
*(2026-11-05 修订：原方案是「视觉全写 tokens.css」，改成官方 overrideTokens 通道后值移到 JS。)*

**ADR-003 样式生效方式**：用 `fetch()` 取文本后注入 `<style>`，**不用 `<link>`**。
**理由**：2026-11-05 实测，同一份 CSS 走 `<link>` 时 `onload` 触发、HTTP 200，但规则一条都不应用
（`dsh-app://app/` 协议下）。改成内联后立即可见，官方皮肤 maid-atelier 也是这么做的。
**代价**：不能利用浏览器对样式表的缓存，靠 `Cache-Control: no-cache` 每次重新取；文本体积小，可接受。
*(2026-11-05 更正：这份 ADR 原文写的是「用 link 引入 Host 路由的 CSS」，与实测结果相反，已改正。)*

**ADR-004 深浅色判定**：用 `body[data-ds-dark-theme]`，不读 `prefers-color-scheme`。
**理由**：DSH 跟随自己的设置切换，不跟系统；maid-atelier 实测这个属性是官方开关。

**ADR-005 选择器稳定性分级**：`data-slot` / `data-composer-card` / `data-chat-flow-kind` 这类语义属性优先（保 DSH 升级）；`[class*=xxx]` 类名兜底（最易变）。每条登记 `risk`。

**ADR-006 多皮肤互斥**：同一时间只允许一套皮肤上色，两道判据任意命中就让位——
1. **协议**：`window.__dshSkinLock = { owner, since }`。启动时发现 `owner` 是别人，就认输；
2. **特征**：已知皮肤挂的 DOM 标记（当前登记 `data-dsh-maid-atelier`，查 `html` 和 `body`）。

让位的表现：不打 `data-dsu-skin`、不推 token、不注入样式；**设置行保留**（要能显示「已被 xxx 接管」并重新启用）。
后加载的皮肤由 `MutationObserver` 监听已知标记补刀。

**理由**：两套皮肤都往 `body` 写内联 `--dsw-*` 变量（maid-atelier 408 处、我们走 `overrideTokens` 也是 body 内联），
同优先级、后 apply 者赢，胜负取决于插件加载顺序——这是不可控的。属性前缀（`data-dsu-*` / `data-dsh-*`）互不冲突，
所以叠加不会崩，只会**混成第三套**。必须显式互斥，不能赌顺序。

**代价**：`window` 全局多一个键；不认识协议的皮肤（目前的 maid）只能靠特征标记认出来，所以 `FOREIGN_MARKERS` 要随新皮肤维护。
**触发重做**：皮肤 ≥ 3 套、或需要「同时装、按设置切换」时，按 ADR-001 拆出 `dsh-ui-skin-runtime`，把协议升级成注册表（增删查、优先级、事件）。
→ **2026-11-05 命中了**，见 ADR-007。

**ADR-007 多皮肤注册表（M5，2026-11-05）**：

ADR-006 的触发条件命中：要「同时装两套、按设置切换」。做法**没有**另立 `dsh-ui-skin-runtime` 包，
而是把协议升级成进程内注册表 `window.__dshSkinHub`：

- `register({ id, label, hint })` 登记一套皮肤；`list()` 给设置页列出；
- `active()` / `setActive(id)`：用户选中的是哪套，存 `localStorage['dsh-ui-skin.active']`；
  **没选过 = 默认皮肤**（`dsh-ui-skin-lab`），所以老用户升级后观感不变；
- `subscribe(fn)`：变更通知，每套皮肤自己判断「上色」还是「让位」。

**为什么没拆 runtime 包**：拆包要新增一个依赖 + 新的加载顺序问题，而协议本体约 30 行。
两份拷贝（`dsh-ui-skin-lab` / `dsh-ui-skin-plain`）的漂移风险交给 `tests/check-skins.mjs`：
它把两份实现放进同一个假 DOM 跑，覆盖登记、切换、**让位方的通知顺序**、脏值。

**锁的语义变了**：`__dshSkinLock` 从「谁先占谁赢」变成「**第三方让位信号**」。
同族皮肤（hub 里登记过的）互相占锁不算冲突，谁上色由 `active` 决定；
只有不在 hub 里的第三方（maid-atelier）才触发让位。`detectForeign` 因此要查 hub 名单——
第一版没查，切到素色时被 lab 的锁挡住，`check-skins` 当场红（同族互占锁的 bug）。

**让位方不许删别人的属性**：hub 通知按注册顺序派发，先注册的那套先被通知。
切走后无脑 `removeAttribute('data-dsu-skin')` 会把**先上色的那套**刚打上的标记抹掉；
两边都改成「只撤自己的」（值属于自己那套才删）。这条有专门的测试（反序加载场景）。

**代价**：协议两份实现，必须同步改；`window` 又多一个全局键。

**ADR-008 字号与字体族让位官方（2026-11-06）**：

官方 `ui-theme` 自带「通用 → 字体大小」：正文 10–22px 步进、代码 10–16、终端 10–20、
三行字体族、快捷键、Host 持久化。`ui-layout` 的 `ThemePresenter.apply()` 先写这些，再写 token 覆盖层——
皮肤通过 `overrideTokens` 写 `--dsh-content-font-size` 会在后写，把官方设置压掉。

**决定**：皮肤不再提供字号旋钮（删 `.font` / `.fontSizes` / `.setFont` 与 localStorage 读取）。
字体族同理但保留预设值：`syncTokens` 读 `ctx.theme.getTheme().fontFamilies`，用户设过 `text` / `code`
就不写对应变量。

**为什么不做「驱动官方设置」**（B 方案）：`ThemeRuntime.setFontSize` 虽然存在，但官方 README 只承诺
「消费快照 + `overrideTokens`」，没承诺写入口；跨插件调它等于依赖未公开 API。

**代价**：E 板块「五旋钮」变「四旋钮」；字号调整入口从皮肤设置页挪到官方「通用」。

**坑**：`overrideTokens` 会**同步** emit `theme/change`；订阅后重推必须**先记 `lastLayerJson` 再推**，
先推后记会无限递归（2026-11-06 实测栈溢出）。`client-smoke` 有回归断言。

**ADR-009 `lib/client.js` 暂不拆分（2026-11-06）**：

ADR-001 的拆分触发条件是「等第二个皮肤或设置页出现再拆」。**两个都已经出现**（`dsh-ui-skin-plain`、
`settings.section`），按字面该拆；ADR-007 也解释过 hub 协议为什么不值得单开 runtime 包。

**现状**：`lib/client.js` 约 1540 行，同时承载 token 值表、加载/切换/清理机制、hub 协议、
皮肤锁、设置页 UI、配置导出导入、方案、结构探针、诊断回传。

**决定**：**暂不拆**，但把触发条件换成可测量的——命中任一条再动手：
1. 文件 > 2000 行；
2. 新增**第三个**功能区（现在这堆之外）；
3. 出现「两个包要共享同一段非协议代码」的需求（目前只有 hub 协议共享，且两份拷贝有 `check-skins` 兜着）。

**理由**：拆包要新包 + 加载顺序 + 跨包共享方案（两个包无法共享模块，只能靠 hub 协议这类进程内约定），
成本高；现在 1540 行还能在一个文件里找全，拆早了大半精力会花在包间通信上。
**代价**：每次改动都要在巨型文件里定位；设置页 UI 和机制混在一起，碰一下 client 就整包重推。

**ADR-010 国际化：备而不接（2026-11-06）**：

`locale/zh.json` / `en.json` 备了，`UI-PROJECT §1.3` 也写了「皮肤文案走 locale」，
但 `lib/client.js` 里对 locale 的引用是 **0**，设置页文案（「外观」「极简」「像素」「已手动停用」…）
全部硬编码中文。这是「文档承诺了、实现没有」的又一例。

**决定**：暂不接，把文档改成实话（「已备未接」），别留假能力。
**理由**：当前只有中文用户；接 locale 要动设置页几十处文案和状态字符串，收益为零、回归风险不为零。
**触发条件**：真要出英文版，或第三方皮肤要复用这套设置页时，一次性接。
**代价**：英文环境下皮肤设置页是中文。

## 9. M1 范围与验收

**做**：目录、`tokens.css`（minimal + pixel 两预设 × 浅深）、`lib/` 最小实现、检查脚本、包安装。

**不做**：组件级覆盖（M3）、设置页（M4）、多皮肤互斥（M5）。

**验收**：

1. 安装并刷新后，`html[data-dsu-skin="minimal"]` 生效，界面变为深色高对比（或浅色段按 DSH 设置）。
2. 切到 `pixel` 后，颜色、圆角、边框、阴影、字体风格整体改变。
3. 禁用插件后刷新，页面完全回到默认。
4. `check-tokens` 与 `check-selectors` 全绿。
5. 浅色模式下两套预设都不出现「黑底黑字」。

---

## 10. 实测记录（2026-11-05，M1 第一次跑通）

这些是踩出来的事实，不是设计推断，后续别重走：

1. **`<link rel="stylesheet">` 在 `dsh-app://app/` 下加载成功但规则不生效**。`link.onload` 触发、请求 200，但样式一条都不应用。改成 `fetch()` 取文本后 `<style>` 注入，立即可见。官方皮肤（maid-atelier）也是注入 `<style>`，不是 link。
2. **token 覆盖确实写入 CSSOM**：`getComputedStyle(html).getPropertyValue('--dsw-alias-bg-base')` 读回 `#f6f3ff`（pixel 浅色值），品牌色读回 `#6b4bd6`。变量层是通的。
   - ⚠️ **2026-11-05 修正（原记录不完整，误导了 M3 第一刀）**：这条只对「html 元素自己」成立。DSH 官方在 `body` 上重新声明了整套 `--dsw-*`，元素自身声明优先于继承，后代拿到的是官方值。实测同一时刻：`fill@html=#d9c9f5`（我们的）、`fill@body=#f9fafb`（官方的）、`fill@col=#f9fafb`（继承 body 的）。当时只读了 html 就写「变量层通了」，是错的。**正确做法：变量块挂 `body`** —— `html[data-dsu-skin="x"] body { ... }`。`check-tokens.mjs` 已加断言防止改回 html。
3. **但 14 个 alias token 改不动整体观感**：`html` / `body` 的背景被 DSH 自己的不透明容器盖住（给 body 设红底，截图看不到；给 `body::after` 盖红幕，看得到）。M3 必须做组件级选择器覆盖，不能只换 token。
   - 2026-11-05 补充：真正的容器是 `div[class*=frame]` / `div[class*=sidebarCol]`，它们有自己的不透明背景。token 生效后还要确认「哪一层在画背景」。
4. **诊断链路**：Host 写 `debug.log` 记录 `/dsu-skin` 请求；client 用 `fetch('/dsu-skin/ping?...')` 回传 `href` / `title` / 变量值。页面在 `dsh-app://app/` 协议下，`location.href` 能确认操作的是不是可见文档。
5. **刷新问题**：DSH 桌面版的 Ctrl+R 不生效；页面加载后才进入启动图的插件，靠 **HMR 改 `lib/client.js` 触发 rev 变化**才能推给已打开的页面（启停插件不会推）。真脏了只能重启 DSH。
6. **`data-ds-dark-theme`** 挂在 `body` 上，跟 DSH 自己的深浅设置，不跟系统。
7. **HMR 重载会留下多份 `<style>`**（2026-11-05 实测）。每次改 `lib/client.js` 都往 `head` 追加一份，旧的不一定被 dispose 掉。两份 CSS 叠着时，**旧标签里声明的变量会盖住新预设的值**——现场抓到 tag0（9 条规则，`html[data-dsu-skin]` 无值前缀的旧版）+ tag1（13 条规则，当前版）。症状是「改了 CSS，页面纹丝不动」。
   - 修法：client 在插入新 `<style>` 前先清掉所有 `data-dsu="skin-lab"` 的标签；cleanup 时也全清。`client.js` 已实现。
8. **页面有 80% 缩放**（实测 `border-right: 2px` 的 computed 值是 `1.6px`）。核对尺寸数值时记得这个系数，别把 1.6px 当成官方样式。
9. **官方主题通道是 `ctx.theme.overrideTokens(source, tokens)`**（2026-11-05 查明，`dsh-client-ui-theme/lib/client.js`）。语义：
   - 每个 source 一层，重复调用整层替换；`tokens` 必须是 `{ light, dark }` 成对（传裸字符串会抛教学错误）。
   - 官方 `ThemePresenter.apply()` 把它写成 **`body.style.setProperty()`** —— 内联样式，优先级高于任何选择器，且自带深浅切换与卸载清理。
   - 不校验 token 名：拼错的变量照样写进 body，但没人消费。所以 `tests/official-tokens.json` 是必需的。
   - 实测覆盖面积（比预想大）：背景、文字、圆角（`--dsw-radius-xs/sm/md/lg/xl/panel`）、字体（`--dsw-font-family`、`--ds-font-family-code`）都跟着走。一次覆盖 5 个圆角 token，输入框就从圆角变直角。
10. **Host 侧 `lib/index.js` 没有热重载**（PLUGINS.md 2026-11-01 记过，2026-11-05 再确认）。改代码必须「禁用再启用」；而且 `ui-skin-lab` 这一行**不在 profile 的 `cordis.patch.yml` 里**（它来自包自己的 bundle patch），所以连「改配置触发 HMR」这条路也走不通。
    - 后果：Host 想新增资源路由（比如 `tokens.json`）在当前进程里做不到，只能重启 DSH。
    - 决定：**token 值内联在 `lib/client.js` 的 `PRESET_TOKENS`**，跟 client 一起走 HMR。Host 只保留 `tokens.css` 一条老路由。
11. **官方 token 全景**（2026-11-05 抽取）：`body` 块 113 个、`body[data-ds-dark-theme]` 112 个；含 alias / specific / static 三类。`--dsw-alias-*` 107 个，`--dsw-specific-*` 24 个，其余是 static 色板（154 个）。皮肤目前覆盖 41 个，覆盖清单要扩就照这份抽样。

**对 M3 的影响**：验收标准从「换 token 就变色」改成「token + 组件覆盖组合出可辨认的风格」；每个组件覆盖都要进 `selectors.json` 登记。
