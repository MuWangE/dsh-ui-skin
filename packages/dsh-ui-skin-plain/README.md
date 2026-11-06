# dsh-ui-skin-plain · 素色基准皮肤

板块 B 原始定义里的「一套『素色』基准皮肤（只为验证框架，不做视觉）」。
它不重绘任何结构，只把品牌色换成中性灰——目的是让「两套皮肤之间切换」肉眼可见。

## 它验证什么

`dsh-ui-skin-lab` 与它同时装着时：

1. 设置页「皮肤」列出两套；点哪套哪套生效，另一套自动让位；
2. 让位方撤掉自己的 token 层、DOM 属性、皮肤锁；
3. 卸载任一套，页面回到默认，不留残留属性和样式。

协议与 `dsh-ui-skin-lab` 同源（`window.__dshSkinHub` / `window.__dshSkinLock`，
选中状态存 `localStorage['dsh-ui-skin.active']`）。两个包各有一份实现，
**改协议必须两边一起改**，`tests/check-skins.mjs` 比对两边行为。

## 值

只推两个 token，其余全跟官方：

| token | 浅色 | 深色 |
|---|---|---|
| `--dsw-alias-brand-primary` | `#4b5563` | `#9ca3af` |
| `--dsw-alias-link` | `#4b5563` | `#9ca3af` |

对比度：浅色 7.55:1、深色 7.06:1（均按品牌色 ≥ 3:1 的口径，实际远超正文 4.5:1）。

## 安装

```bash
plugin_manager({ action: 'install_bundle', target: '<仓库根>/packages/dsh-ui-skin-plain' })
```

装完重启 DSH（Host 侧没有热重载）。
