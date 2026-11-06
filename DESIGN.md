# UI 定制项目 · 设计规范（M1）

> 2026-11-05。两套实验风格：**minimal**（深色高对比，Linear 式）与 **pixel**（16-bit 像素）。
> 这份表记「为什么这么设计、值大概长什么样」；**实现真源是 `lib/client.js` 的 `PRESET_TOKENS`**，
> 组件结构在 `tokens.css`。改视觉先定方向，再改那两处，最后跑对比度检查。

---

## 1. 方向

| | minimal | pixel |
|---|---|---|
| 性格 | 冷静、克制、信息优先 | 复古、硬朗、有玩具感 |
| 参考 | Linear / Raycast 的深色工作台 | 90 年代终端、老式 GUI、16-bit 游戏 UI |
| 关键手法 | 低饱和、细线、留白、极轻阴影 | 直角、2px 硬边、硬阴影、等宽字、无平滑过渡 |
| 禁忌 | 大面积发光、玻璃拟态、多彩 | 圆角、渐变、模糊、抗锯齿的柔和感 |

**共同点**：界面本身退后，内容在前。不用装饰性插图占版面。

## 2. 色彩

### 2.1 minimal · 深色（主）

| token | 值 | 用途 |
|---|---|---|
| bg-base | `#0b0c0e` | 应用底 |
| bg-layer-1 | `#16181e` | 主表面 |
| bg-layer-2 | `#1e2129` | 嵌套表面 |
| bg-layer-3 | `#262a33` | 再上一层 |
| bg-overlay | `#1d2028` | 浮层、菜单 |
| border-l1 | `#24262d` | 细边框 |
| border-l2 | `#33363f` | 强调边框 |
| brand-primary | `#7c9eff` | 主色、选中、链接 |
| label-primary | `#e8eaf0` | 正文 |
| label-secondary | `#9aa0ad` | 次要说明 |
| state-error | `#ff6b6b` | 错误 |
| state-idle | `#4b4f59` | 未激活 |
| state-success | `#4ade80` | 成功 |
| state-warn | `#fbbf24` | 警告 |
| sidebar-fill | `#14161b` | 侧栏（比主区亮一档，否则和 bg-base 分不开） |

### 2.2 minimal · 浅色

| token | 值 |
|---|---|
| bg-base | `#ffffff` |
| bg-layer-1 | `#f7f8fa` |
| bg-layer-2 | `#eef0f4` |
| bg-overlay | `#ffffff` |
| border-l1 | `#e6e8ee` |
| border-l2 | `#d5d8e0` |
| brand-primary | `#3b6ef5` |
| label-primary | `#191b21` |
| label-secondary | `#606673` |
| state-error | `#d64545` |
| state-idle | `#b9bec9` |
| state-success | `#1f9d55` |
| state-warn | `#b7791f` |
| sidebar-fill | `#fafbfc` |

### 2.3 pixel · 深色（主）

| token | 值 |
|---|---|
| bg-base | `#17141f` |
| bg-layer-1 | `#1f1b2b` |
| bg-layer-2 | `#2a2438` |
| bg-overlay | `#2f2840` |
| border-l1 | `#4a3f66` |
| border-l2 | `#6b5a8f` |
| brand-primary | `#b48cff` |
| label-primary | `#ece7f7` |
| label-secondary | `#a79ec0` |
| state-error | `#ff7a7a` |
| state-idle | `#5c5470` |
| state-success | `#6ee7a8` |
| state-warn | `#ffd166` |
| sidebar-fill | `#12101a` |

### 2.4 pixel · 浅色

| token | 值 |
|---|---|
| bg-base | `#f6f3ff` |
| bg-layer-1 | `#ece6fb` |
| bg-layer-2 | `#e2d8f7` |
| bg-overlay | `#ffffff` |
| border-l1 | `#b9a8dd` |
| border-l2 | `#8d76bf` |
| brand-primary | `#6b4bd6` |
| label-primary | `#241c3a` |
| label-secondary | `#5d5380` |
| state-error | `#c62f4b` |
| state-idle | `#a99fc4` |
| state-success | `#1b8f5a` |
| state-warn | `#a8620c` |
| sidebar-fill | `#efeaf9` |

**规则**：正文与底的对比度 ≥ 4.5:1，次要文字 ≥ 4.5:1，图标 ≥ 3:1。用脚本量，不靠眼睛（`tests/check-contrast.mjs`）。

## 3. 排版

| | minimal | pixel |
|---|---|---|
| 界面字体 | 系统无衬线：`system-ui, -apple-system, "Segoe UI", "Microsoft YaHei"` | 等宽：`ui-monospace, "Cascadia Mono", "Consolas", monospace` |
| 代码字体 | `ui-monospace, "Cascadia Code", Consolas, monospace` | 同界面 |
| 正文字号 | 由官方「通用 → 字体大小」决定（默认 14px，10–22 步进）；皮肤不覆盖 | 同左（等宽字更宽，需要时整体调小） |
| 小字 | 11px | 11px |
| 标题字重 | 600 | 700 |
| 字距 | 默认 | 0.02em（等宽字的呼吸） |

**中文保持系统字体**（哥哥定的，M1 不打包像素中文字库）。像素字体只作用于拉丁字母、数字、等宽场景。

## 4. 形状与材质

| | minimal | pixel |
|---|---|---|
| 圆角 | sm 4 / md 8 / lg 12 | 0（全部直角） |
| 边框 | 1px | 2px |
| 阴影 | `0 1px 2px rgba(0,0,0,.18)` / `0 10px 28px rgba(0,0,0,.28)` | `2px 2px 0 #000`（硬阴影，无模糊） |
| 分隔 | 1px 细线 | 2px 实线 |
| 图像渲染 | 默认 | `image-rendering: pixelated` |

**像素风刻度纪律**：所有尺寸取偶数（2 的倍数），避免 1px 抗锯齿造成的灰边。间距只在 2/4/8/12/16 里选。

## 5. 间距

统一刻度（与风格无关）：`4 / 8 / 12 / 16 / 24 / 32`（`--dsu-space-1..6`）。
像素风只用 `4 / 8 / 12 / 16`，不用 24/32——大留白会破坏「密实的玩具感」。

## 6. 动效

| | minimal | pixel |
|---|---|---|
| 快 | 120ms | 0 |
| 常规 | 200ms | 0 |
| 缓动 | `cubic-bezier(.2,.8,.2,1)` | 无（或 1 帧跳变） |
| 允许的动效 | 淡入、轻微位移、hover 变色 | 仅颜色切换、闪烁光标 |

**降级（两条路，任一命中都生效）**：

1. **系统偏好**：`prefers-reduced-motion: reduce` 时整套皮肤关掉过渡与动画。
   已实现于 `tokens.css` 第 4 节（纯 CSS，不依赖 JS、不需要用户去设置页操作）。
   **系统偏好优先于下面的手动开关。**
2. **手动开关**：设置页「动效」可以主动关（`data-dsu-motion="off"`），存 `localStorage`。

> **pixel 的「0ms」已实现（2026-11-06，哥哥验收通过）**：`tokens.css` 第 1 节用 `!important` 压掉
> pixel 下所有 `transition` 与 `scroll-behavior`（实测：pixel 整页 **0** 个元素带过渡，minimal **1081** 个）。
> **刻意不压 `animation`**：官方 17 个 `@keyframes` 里 `_spin` / `_dsh-state-dot-spin` /
> `_dsh-plugin-detail-skeleton` / 打字指示点 是「进行中」的唯一表达，压掉会静止、像卡死。
> 所以 pixel 下弹窗与 toast 仍有进入动画——这是取舍，不是遗漏。见 `HANDOVER.md` §3.8 / §7。

## 7. 图标

- 尺寸：16 / 20 / 24；线宽 minimal 1.5px，pixel 2px 且只走横竖（斜线用阶梯，不用抗锯齿斜线）。
- 像素风图标用 SVG + `shape-rendering: crispEdges`，坐标对齐整数。
- 陪看插件（whale-sense）的折叠图标按这套规范在 M2 重画 → **2026-11-06 已重画**（whale-sense 提交 `202b3bf`）：
  细线/像素两套眼睛 SVG、dot 方块 16px、行楷保留为书法选项。

## 8. 规则：什么时候用哪个色

- `brand-primary`：选中态、主按钮、可点链接。**不做大面积背景**。
- `state-*`：只表达状态，不做装饰。
- `bg-layer-2`：卡片内再嵌一层时用，超过两层说明信息结构有问题。
- `border-l2`：只在「可交互且需要强调」时用；普通分隔用 `border-l1`。

## 9. 验收清单（M1）

- [ ] 14 个 token × 2 预设 × 2 模式，全部有值。
- [ ] 四种组合下正文对比度 ≥ 4.5:1。
- [ ] 浅色模式下没有黑底黑字、深色下没有白底白字。
- [ ] 像素风在 100% 缩放下边框清晰、无灰边。
- [ ] 系统字体缺失时回落到 sans-serif，不出现方块。
