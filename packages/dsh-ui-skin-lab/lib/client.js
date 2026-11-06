/**
 * `dsh-ui-skin-lab` — browser half.
 *
 * 职责：
 *   1. 给 <html> 打上 data-dsu-skin="<preset>"（组件级 CSS 靠这个属性生效）；
 *   2. 用 ctx.theme.overrideTokens 把预设 token 推给官方主题层——这是 2026-11-05
 *      查明的主通道：官方 ThemePresenter 会写进 body 内联样式，优先级最高，
 *      而且自动跟随 light/dark 切换；
 *   3. 抓 /dsu-skin/tokens.css 用 <style> 注入组件级覆盖（<link> 在 dsh-app:// 下不生效）；
 *   4. 提供 window.__dsuSkinLab 供切换与调试，卸载时清干净。
 *
 * 不在这里写颜色——值全在 tokens.json（token 层）和 tokens.css（组件层）。
 */
window.__ModuleLoader__.load({
  id: 'dsh-ui-skin-lab',
  factory: (require) => ({
    apply(ctx) {
      const html = document.documentElement;
      // 设置页要 React 组件 + 官方 store。拿不到就只保留控制台切换，皮肤照常工作。
      let React = null;
      let defineStore = null;
      try {
        React = require('react');
      } catch {
        /* 没有 React 就不挂设置行 */
      }
      try {
        defineStore = require('@deepseek-ai/dsh-client-store').defineStore;
      } catch {
        /* 同理 */
      }
      const STORAGE_KEY = 'dsh-ui-skin-lab.preset';
      const PRESETS = ['minimal', 'pixel'];
      const DEFAULT_PRESET = 'minimal';

      // —— 主色旋钮（E 板块）——
      // 色板只收深色系：浅色模式下按钮是「品牌底 + 白字」，品牌色不够深就低于 4.5:1。
      // 深色模式下自动提亮（mix 70% 品牌 + 30% 白），正好落在官方深色品牌色的亮度区间。
      const BRAND_KEY = 'dsh-ui-skin-lab.brand';
      const BRAND_PALETTE = [
        { id: 'default', label: '跟随预设', value: '' },
        { id: 'indigo', label: '靛蓝', value: '#3b6ef5' },
        { id: 'violet', label: '紫', value: '#6b4bd6' },
        { id: 'teal', label: '青', value: '#0f766e' },
        { id: 'green', label: '绿', value: '#15803d' },
        { id: 'rose', label: '玫红', value: '#be185d' },
        { id: 'amber', label: '琥珀', value: '#b45309' },
      ];
      const readBrand = () => {
        try {
          const value = localStorage.getItem(BRAND_KEY);
          // 只认 6 位 hex：随便存进来的脏值会让 overrideTokens 写出一层废变量。
          return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : null;
        } catch {
          return null;
        }
      };
      const saveBrand = (value) => {
        try {
          if (value) localStorage.setItem(BRAND_KEY, value);
          else localStorage.removeItem(BRAND_KEY);
        } catch {
          /* 存不了只影响下次开机 */
        }
      };

      // —— 正文字号：交给官方「通用 → 字体大小」——
      // 2026-11-06 定案（哥哥选的 A 方案）：官方已有正文 10–22px 步进、代码/终端字号、
      // 字体族设置、快捷键和 Host 持久化。皮肤再写 --dsh-content-font-size 会在
      // ThemePresenter 的 token 层里后写，把官方设置压掉。所以皮肤不再提供字号旋钮。
      // 旧 localStorage['dsh-ui-skin-lab.font'] 留作历史，不读、不迁移。

      // —— 圆角旋钮（E 板块）——
      // 官方圆角全走 6 个 --dsw-radius-* token，覆盖它们就够。
      // 三档给的是**绝对值**而不是乘系数：pixel 的基准是 0px，乘系数永远是 0，
      // 「圆润」在 pixel 下会变成没反应。
      const RADIUS_KEY = 'dsh-ui-skin-lab.radius';
      const RADIUS_PRESETS = [
        { id: 'default', label: '跟随预设', value: '' },
        { id: 'square', label: '直角', value: 'square' },
        { id: 'round', label: '圆润', value: 'round' },
      ];
      const RADIUS_TOKENS = {
        xs: '--dsw-radius-xs',
        sm: '--dsw-radius-sm',
        md: '--dsw-radius-md',
        lg: '--dsw-radius-lg',
        xl: '--dsw-radius-xl',
        panel: '--dsw-radius-panel',
      };
      const RADIUS_SETS = {
        square: { xs: '0px', sm: '0px', md: '0px', lg: '0px', xl: '0px', panel: '0px' },
        round: { xs: '6px', sm: '8px', md: '12px', lg: '16px', xl: '20px', panel: '20px' },
      };
      const readRadius = () => {
        try {
          const value = localStorage.getItem(RADIUS_KEY);
          return value === 'square' || value === 'round' ? value : null;
        } catch {
          return null;
        }
      };
      const saveRadius = (value) => {
        try {
          if (value) localStorage.setItem(RADIUS_KEY, value);
          else localStorage.removeItem(RADIUS_KEY);
        } catch {
          /* 同上 */
        }
      };

      // —— 动效开关（E 板块）——
      // 走 html 属性而不是 token：transition/animation 没法用变量表达。
      const MOTION_KEY = 'dsh-ui-skin-lab.motion';
      const readMotion = () => {
        try {
          return localStorage.getItem(MOTION_KEY) !== 'off';
        } catch {
          return true;
        }
      };
      const saveMotion = (on) => {
        try {
          if (on) localStorage.removeItem(MOTION_KEY);
          else localStorage.setItem(MOTION_KEY, 'off');
        } catch {
          /* 同上 */
        }
      };
      /** overrideTokens 的层身份；同一 source 重复注册会整层替换。 */
      const OVERRIDE_SOURCE = 'dsh-ui-skin-lab';

      /**
       * 两套预设共用的派生规则：值写成 `var(--另一个 token)` 或 `color-mix(...)`，
       * 深浅自动跟着被引用的 token 走，不用每个预设各写四遍。
       * 官方很多组件读的是 `--dsw-static-*` 色板（不随主题变），这些必须显式改写，
       * 否则换预设时按钮、滚动条、浮层会留着官方灰。
       * 预设自己的值优先级更高（见 syncTokens 的合并顺序）。
       */
      const SHARED_TOKENS = {
        // 按钮
        '--dsw-alias-button-elevated-fill': 'var(--dsw-alias-bg-layer-1)',
        '--dsw-alias-button-floating-fill': 'var(--dsw-alias-bg-overlay)',
        '--dsw-alias-button-floating-hover': 'var(--dsw-alias-interactive-bg-hover)',
        '--dsw-alias-button-contrast-fill': 'var(--dsw-alias-label-primary)',
        '--dsw-alias-button-primary-fill': 'var(--dsw-alias-brand-primary)',
        '--dsw-alias-button-primary-hover': 'color-mix(in srgb, var(--dsw-alias-brand-primary) 82%, var(--dsw-alias-bg-base))',
        '--dsw-alias-button-primary-dimmed': 'color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, var(--dsw-alias-bg-base))',
        '--dsw-alias-button-info-fill': 'var(--dsw-alias-brand-primary)',
        '--dsw-alias-button-info-hover': 'color-mix(in srgb, var(--dsw-alias-brand-primary) 82%, var(--dsw-alias-bg-base))',
        '--dsw-alias-button-ghost-active-fill': 'var(--dsw-alias-interactive-bg-active)',
        '--dsw-alias-button-ghost-active-hover': 'var(--dsw-alias-interactive-bg-hover)',
        '--dsw-alias-button-ghost-active-border': 'var(--dsw-alias-border-l2)',
        '--dsw-alias-button-tool-bar-fill': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-alias-button-tool-bar-hover': 'var(--dsw-alias-interactive-bg-hover)',
        '--dsw-alias-button-tool-bar-fill-invisible': 'transparent',

        // 文字
        '--dsw-alias-label-primary-dimmed': 'color-mix(in srgb, var(--dsw-alias-label-primary) 62%, var(--dsw-alias-bg-base))',
        '--dsw-alias-label-primary-inverted': 'var(--dsw-alias-bg-base)',
        '--dsw-alias-label-primary-foreground': 'var(--dsw-alias-bg-base)',
        '--dsw-alias-label-primary-bluish': 'var(--dsw-alias-brand-primary)',
        '--dsw-alias-label-shimmer': 'color-mix(in srgb, var(--dsw-alias-label-primary) 30%, transparent)',
        '--dsw-alias-label-document-preview': 'var(--dsw-alias-label-secondary)',
        '--dsw-alias-menu-icon': 'var(--dsw-alias-label-secondary)',

        // 交互
        '--dsw-alias-interactive-bg-hover-solid': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-alias-interactive-bg-hover-accent': 'color-mix(in srgb, var(--dsw-alias-brand-primary) 14%, transparent)',
        '--dsw-alias-interactive-bg-hover-danger': 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)',

        // 滚动条
        '--dsw-alias-scrollbar-bg-l1': 'var(--dsw-alias-border-l2)',
        '--dsw-alias-scrollbar-bg-l2': 'var(--dsw-alias-border-l3)',
        '--dsw-alias-scrollbar-hover-l1': 'var(--dsw-alias-border-l3)',
        '--dsw-alias-scrollbar-hover-l2': 'var(--dsw-alias-border-l4)',

        // Markdown
        '--dsw-alias-markdown-citation': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-alias-markdown-placeholder': 'var(--dsw-alias-label-tertiary)',
        '--dsw-alias-markdown-tag': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-alias-markdown-code-segment-selected': 'var(--dsw-alias-bg-layer-1)',
        '--dsw-alias-markdown-code-segment-unselected': 'var(--dsw-alias-bg-base)',

        // 浮层
        '--dsw-menu-surface-fill': 'color-mix(in srgb, var(--dsw-alias-bg-overlay) 94%, transparent)',
        '--dsw-alias-menu-group-header-fill': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-alias-toast-bg': 'var(--dsw-alias-label-primary)',
        '--dsw-alias-toast-label': 'var(--dsw-alias-bg-base)',
        '--dsw-alias-tooltip-bg': 'var(--dsw-alias-label-primary)',
        '--dsw-alias-turn-trigger-bg': 'var(--dsw-alias-markdown-code-block)',
        '--dsw-alias-turn-trigger-bg-hover': 'var(--dsw-alias-interactive-bg-hover)',

        // 状态补充
        '--dsw-alias-state-business-primary': 'var(--dsw-alias-brand-primary)',
        '--dsw-alias-state-business-tertiary': 'color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, var(--dsw-alias-bg-base))',
        '--dsw-alias-state-success-secondary': 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 60%, var(--dsw-alias-bg-base))',
        '--dsw-alias-state-success-tertiary': 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, var(--dsw-alias-bg-base))',
        '--dsw-alias-state-error-secondary': 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 60%, var(--dsw-alias-bg-base))',
        '--dsw-alias-state-warn-secondary': 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 60%, var(--dsw-alias-bg-base))',
        '--dsw-alias-state-warn-tertiary': 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 16%, var(--dsw-alias-bg-base))',
        '--dsw-alias-state-warn-label': 'color-mix(in srgb, var(--dsw-alias-state-warn-primary) 80%, var(--dsw-alias-bg-base))',

        // 其他表面
        '--dsw-alias-bg-skeleton': 'color-mix(in srgb, var(--dsw-alias-label-primary) 8%, transparent)',
        '--dsw-alias-bg-document-selection': 'color-mix(in srgb, var(--dsw-alias-brand-primary) 30%, transparent)',
        '--dsw-alias-bg-module-platform': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-alias-bg-multi-select': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-alias-bg-document-preview': 'var(--dsw-alias-bg-layer-1)',
        '--dsw-alias-border-inverted': 'transparent',
        '--dsw-alias-border-inverted2': 'transparent',
        '--dsw-alias-border-l2-darkmode-thin': 'var(--dsw-alias-border-l1)',
        '--dsw-alias-settings-card-fill': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-alias-settings-card-stroke': 'var(--dsw-alias-border-l1)',
        '--dsw-alias-switch-thumb': 'var(--dsw-alias-bg-base)',
        '--dsw-specific-selector': 'var(--dsw-alias-bg-layer-1)',
        '--dsw-specific-tip': 'var(--dsw-alias-bg-layer-2)',
        '--dsw-specific-login-input': 'var(--dsw-alias-bg-layer-1)',
      };

      /**
       * 预设 token 表。官方通道 ctx.theme.overrideTokens 要 { light, dark } 成对。
       * token 名必须真实存在于官方主题层（tests/official-tokens.json 会校验）。
       */
      const PRESET_TOKENS = {
        minimal: {
          label: '极简',
          description: '深色高对比（Linear 式）：低饱和、细线、留白。',
          light: {
            '--dsw-alias-bg-base': "#ffffff",
            '--dsw-alias-bg-layer-1': "#f7f8fa",
            '--dsw-alias-bg-layer-2': "#eef0f4",
            '--dsw-alias-bg-layer-3': "#e6e9ef",
            '--dsw-alias-bg-overlay': "#ffffff",
            '--dsw-alias-border-l1': "#e6e8ee",
            '--dsw-alias-border-l2': "#d5d8e0",
            '--dsw-alias-border-l3': "#c2c6d0",
            '--dsw-alias-border-l4': "#aeb3bf",
            '--dsw-alias-label-primary': "#191b21",
            '--dsw-alias-label-secondary': "#606673",
            '--dsw-alias-label-tertiary': "#8b909c",
            '--dsw-alias-label-caption': "#a3a8b3",
            '--dsw-alias-label-dimmed': "#c7cbd4",
            '--dsw-alias-brand-primary': "#3b6ef5",
            '--dsw-alias-link': "#3b6ef5",
            '--dsw-alias-state-idle-primary': "#b9bec9",
            '--dsw-alias-state-error-primary': "#d64545",
            '--dsw-alias-state-success-primary': "#1f9d55",
            '--dsw-alias-state-warn-primary': "#b7791f",
            '--dsw-specific-sidebar-fill': "#f1f3f6",
            '--dsw-specific-sidebar-nav-item-active': "#e6eaf1",
            '--dsw-specific-sidebar-nav-item-hover': "#eaeef4",
            '--dsw-specific-sidebar-nav-item-active-accent': "#dbe6fd",
            '--dsw-specific-bubble': "#eef2fb",
            '--dsw-specific-bubble-highlight': "#dbe6fd",
            '--dsw-specific-input-major': "#ffffff",
            '--dsw-alias-interactive-bg-hover': "#2631480f",
            '--dsw-alias-interactive-bg-active': "#2631481a",
            '--dsw-alias-markdown-code-block': "#f7f8fa",
            '--dsw-alias-markdown-code-block-banner': "#eef0f4",
            '--dsw-alias-markdown-inline-code': "#eef0f4",
            '--dsw-radius-xs': "4px",
            '--dsw-radius-sm': "6px",
            '--dsw-radius-md': "8px",
            '--dsw-radius-lg': "12px",
            '--dsw-radius-xl': "16px",
            '--dsw-radius-panel': "16px",
            '--dsw-font-family': "system-ui, -apple-system, \"Segoe UI\", \"Microsoft YaHei\", sans-serif",
            '--ds-font-family-code': "ui-monospace, \"Cascadia Code\", Consolas, \"Courier New\", monospace",
          },
          dark: {
            '--dsw-alias-bg-base': "#0b0c0e",
            '--dsw-alias-bg-layer-1': "#16181e",
            '--dsw-alias-bg-layer-2': "#1e2129",
            '--dsw-alias-bg-layer-3': "#262a33",
            '--dsw-alias-bg-overlay': "#1d2028",
            '--dsw-alias-border-l1': "#24262d",
            '--dsw-alias-border-l2': "#33363f",
            '--dsw-alias-border-l3': "#424652",
            '--dsw-alias-border-l4': "#565b68",
            '--dsw-alias-label-primary': "#e8eaf0",
            '--dsw-alias-label-secondary': "#9aa0ad",
            '--dsw-alias-label-tertiary': "#767c88",
            '--dsw-alias-label-caption': "#5e6470",
            '--dsw-alias-label-dimmed': "#3a3e47",
            '--dsw-alias-brand-primary': "#7c9eff",
            '--dsw-alias-link': "#7c9eff",
            '--dsw-alias-state-idle-primary': "#4b4f59",
            '--dsw-alias-state-error-primary': "#ff6b6b",
            '--dsw-alias-state-success-primary': "#4ade80",
            '--dsw-alias-state-warn-primary': "#fbbf24",
            '--dsw-specific-sidebar-fill': "#14161b",
            '--dsw-specific-sidebar-nav-item-active': "#22252d",
            '--dsw-specific-sidebar-nav-item-hover': "#1b1e24",
            '--dsw-specific-sidebar-nav-item-active-accent': "#16233f",
            '--dsw-specific-bubble': "#16233f",
            '--dsw-specific-bubble-highlight': "#1e2c4d",
            '--dsw-specific-input-major': "#16181e",
            '--dsw-alias-interactive-bg-hover': "#ffffff14",
            '--dsw-alias-interactive-bg-active': "#ffffff24",
            '--dsw-alias-markdown-code-block': "#16181e",
            '--dsw-alias-markdown-code-block-banner': "#1e2129",
            '--dsw-alias-markdown-inline-code': "#1e2129",
            '--dsw-radius-xs': "4px",
            '--dsw-radius-sm': "6px",
            '--dsw-radius-md': "8px",
            '--dsw-radius-lg': "12px",
            '--dsw-radius-xl': "16px",
            '--dsw-radius-panel': "16px",
            '--dsw-font-family': "system-ui, -apple-system, \"Segoe UI\", \"Microsoft YaHei\", sans-serif",
            '--ds-font-family-code': "ui-monospace, \"Cascadia Code\", Consolas, \"Courier New\", monospace",
          },
        },
        pixel: {
          label: '像素',
          description: '16-bit 像素：直角、2px 硬边、硬阴影、等宽字。',
          light: {
            '--dsw-alias-bg-base': "#efe6ff",
            '--dsw-alias-bg-layer-1': "#e3d7fb",
            '--dsw-alias-bg-layer-2': "#d5c4f2",
            '--dsw-alias-bg-layer-3': "#c9b4ee",
            '--dsw-alias-bg-overlay': "#faf7ff",
            '--dsw-alias-border-l1': "#b39ae0",
            '--dsw-alias-border-l2': "#7b5fb8",
            '--dsw-alias-border-l3': "#5e4490",
            '--dsw-alias-border-l4': "#4a3472",
            '--dsw-alias-label-primary': "#241c3a",
            '--dsw-alias-label-secondary': "#4b4168",
            '--dsw-alias-label-tertiary': "#6e6193",
            '--dsw-alias-label-caption': "#8a7ca8",
            '--dsw-alias-label-dimmed': "#b7a9d2",
            '--dsw-alias-brand-primary': "#6b4bd6",
            '--dsw-alias-link': "#6b4bd6",
            '--dsw-alias-state-idle-primary': "#9a8cbd",
            '--dsw-alias-state-error-primary': "#c62f4b",
            '--dsw-alias-state-success-primary': "#1b8f5a",
            '--dsw-alias-state-warn-primary': "#a8620c",
            '--dsw-specific-sidebar-fill': "#d9c9f5",
            '--dsw-specific-sidebar-nav-item-active': "#c3aef0",
            '--dsw-specific-sidebar-nav-item-hover': "#cdb8f3",
            '--dsw-specific-sidebar-nav-item-active-accent': "#b89dea",
            '--dsw-specific-bubble': "#e3d7fb",
            '--dsw-specific-bubble-highlight': "#d5c4f2",
            '--dsw-specific-input-major': "#faf7ff",
            '--dsw-alias-interactive-bg-hover': "#3d2a6b1f",
            '--dsw-alias-interactive-bg-active': "#3d2a6b2e",
            '--dsw-alias-markdown-code-block': "#f3ecff",
            '--dsw-alias-markdown-code-block-banner': "#e3d7fb",
            '--dsw-alias-markdown-inline-code': "#e3d7fb",
            '--dsw-radius-xs': "0px",
            '--dsw-radius-sm': "0px",
            '--dsw-radius-md': "0px",
            '--dsw-radius-lg': "0px",
            '--dsw-radius-xl': "0px",
            '--dsw-radius-panel': "0px",
            '--dsw-corner-shape': "round",
            '--dsw-font-family': "ui-monospace, \"Cascadia Code\", \"Cascadia Mono\", Consolas, \"Courier New\", monospace",
            '--ds-font-family-code': "ui-monospace, \"Cascadia Code\", \"Cascadia Mono\", Consolas, \"Courier New\", monospace",
          },
          dark: {
            '--dsw-alias-bg-base': "#17141f",
            '--dsw-alias-bg-layer-1': "#1f1b2b",
            '--dsw-alias-bg-layer-2': "#2a2438",
            '--dsw-alias-bg-layer-3': "#332c45",
            '--dsw-alias-bg-overlay': "#2f2840",
            '--dsw-alias-border-l1': "#4a3f66",
            '--dsw-alias-border-l2': "#6b5a8f",
            '--dsw-alias-border-l3': "#8a76b5",
            '--dsw-alias-border-l4': "#a894d4",
            '--dsw-alias-label-primary': "#ece7f7",
            '--dsw-alias-label-secondary': "#a79ec0",
            '--dsw-alias-label-tertiary': "#857c9e",
            '--dsw-alias-label-caption': "#6b6383",
            '--dsw-alias-label-dimmed': "#3d3654",
            '--dsw-alias-brand-primary': "#b48cff",
            '--dsw-alias-link': "#b48cff",
            '--dsw-alias-state-idle-primary': "#5c5470",
            '--dsw-alias-state-error-primary': "#ff7a7a",
            '--dsw-alias-state-success-primary': "#6ee7a8",
            '--dsw-alias-state-warn-primary': "#ffd166",
            '--dsw-specific-sidebar-fill': "#12101a",
            '--dsw-specific-sidebar-nav-item-active': "#2a2438",
            '--dsw-specific-sidebar-nav-item-hover': "#221d2e",
            '--dsw-specific-sidebar-nav-item-active-accent': "#3a2f57",
            '--dsw-specific-bubble': "#2a2438",
            '--dsw-specific-bubble-highlight': "#3a2f57",
            '--dsw-specific-input-major': "#1f1b2b",
            '--dsw-alias-interactive-bg-hover': "#ffffff14",
            '--dsw-alias-interactive-bg-active': "#ffffff24",
            '--dsw-alias-markdown-code-block': "#1f1b2b",
            '--dsw-alias-markdown-code-block-banner': "#2a2438",
            '--dsw-alias-markdown-inline-code': "#2a2438",
            '--dsw-radius-xs': "0px",
            '--dsw-radius-sm': "0px",
            '--dsw-radius-md': "0px",
            '--dsw-radius-lg': "0px",
            '--dsw-radius-xl': "0px",
            '--dsw-radius-panel': "0px",
            '--dsw-corner-shape': "round",
            '--dsw-font-family': "ui-monospace, \"Cascadia Code\", \"Cascadia Mono\", Consolas, \"Courier New\", monospace",
            '--ds-font-family-code': "ui-monospace, \"Cascadia Code\", \"Cascadia Mono\", Consolas, \"Courier New\", monospace",
          },
        },
      };


      // —— M5 多皮肤：皮肤 hub 协议 ——
      // 多套皮肤（本包、素色基准、将来的第三方）共用一个进程内 hub：
      //   window.__dshSkinHub = { version, active, setActive, register, list, subscribe }
      // 用户选中哪套存 localStorage['dsh-ui-skin.active']；**没设过 = 默认皮肤**（本包）。
      // 同一份实现在 dsh-ui-skin-plain 里也有一份（两个包无法共享模块）。
      // 改协议必须两边一起改：tests/check-skins.mjs 会比对两边行为。
      const HUB_KEY = '__dshSkinHub';
      const ACTIVE_KEY = 'dsh-ui-skin.active';
      /** 没被用户选过时生效的皮肤。多皮肤协议里它就是本包的 id。 */
      const DEFAULT_SKIN = 'dsh-ui-skin-lab';
      const getHub = () => {
        try {
          if (window[HUB_KEY] == null) {
            const listeners = new Set();
            const entries = new Map();
            const notify = () => {
              for (const fn of [...listeners]) {
                try {
                  fn();
                } catch {
                  /* 单个订阅者出错不影响别人 */
                }
              }
            };
            window[HUB_KEY] = {
              version: 1,
              active() {
                try {
                  return localStorage.getItem(ACTIVE_KEY);
                } catch {
                  return null;
                }
              },
              setActive(id) {
                try {
                  if (typeof id === 'string' && id !== '') localStorage.setItem(ACTIVE_KEY, id);
                  else localStorage.removeItem(ACTIVE_KEY);
                } catch {
                  /* 隐私模式下写不进去也不影响本次会话 */
                }
                notify();
              },
              register(entry) {
                if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string') {
                  return () => {};
                }
                entries.set(entry.id, entry);
                notify();
                return () => {
                  entries.delete(entry.id);
                  notify();
                };
              },
              list() {
                return [...entries.values()].map((item) => ({
                  id: item.id,
                  label: item.label ?? item.id,
                  hint: item.hint ?? '',
                }));
              },
              subscribe(fn) {
                if (typeof fn !== 'function') return () => {};
                listeners.add(fn);
                return () => listeners.delete(fn);
              },
            };
          }
          return window[HUB_KEY];
        } catch {
          return null;
        }
      };
      const hub = getHub();
      /** 当前是否轮到我上色：没选过 = 默认（本包）；选过且不是我 = 让位。 */
      const isActiveSkin = () => {
        const active = hub?.active?.() ?? null;
        return active === null || active === DEFAULT_SKIN;
      };

      let disposed = false;
      let themeApi = null;
      let disposeTokens = null;
      let cssInjected = false;

      // —— M5 皮肤互斥 ——
      // 同一时间只允许一套皮肤生效。判据两条：
      //   1) 协议：window.__dshSkinLock.owner 是别人（将来其他皮肤可以遵守这个约定）；
      //   2) 特征：已知皮肤挂的 DOM 标记（maid-atelier 用 data-dsh-maid-atelier）。
      // 为什么必须互斥：两套皮肤都往 body 写内联 --dsw-* 变量，同优先级，谁后 apply 谁赢；
      // 属性前缀不同（data-dsu-* / data-dsh-*）不会互相误伤，但视觉会混成第三套。
      const SKIN_ID = DEFAULT_SKIN;
      const SKIN_LOCK_KEY = '__dshSkinLock';
      const ENABLED_KEY = 'dsh-ui-skin-lab.enabled';
      const FOREIGN_MARKERS = [['data-dsh-maid-atelier', 'maid-atelier']];

      function detectForeign() {
        try {
          const lock = window[SKIN_LOCK_KEY];
          if (lock !== undefined && lock !== null && typeof lock.owner === 'string' && lock.owner !== SKIN_ID) {
            // hub 里登记过的皮肤算「自己人」：谁上色由 active 决定，不算冲突。
            // 只有不走 hub 的第三方皮肤（maid-atelier 这类）才需要让位。
            const sameFamily = (hub?.list?.() ?? []).some((item) => item.id === lock.owner);
            if (!sameFamily) return lock.owner;
          }
        } catch {
          /* Proxy / 隐私模式下读全局可能抛，按「没有别人」处理 */
        }
        for (const [attribute, label] of FOREIGN_MARKERS) {
          try {
            if (html.hasAttribute?.(attribute) === true) return label;
            if (document.body?.hasAttribute?.(attribute) === true) return label;
          } catch {
            /* 同上 */
          }
        }
        return null;
      }

      const readSaved = () => {
        try {
          return localStorage.getItem(STORAGE_KEY);
        } catch {
          return null;
        }
      };
      const save = (value) => {
        try {
          localStorage.setItem(STORAGE_KEY, value);
        } catch {
          /* 隐私模式下写不进去也不影响本次会话 */
        }
      };

      // 开关默认开；只有明确存过 'off' 才算关。
      let enabled = true;
      try {
        enabled = localStorage.getItem(ENABLED_KEY) !== 'off';
      } catch {
        /* 读不到就当开着 */
      }
      let blockedBy = detectForeign();

      /** 皮肤当前是否应该（且能够）上色：用户开关、外皮肤冲突、hub 里轮到我，三者都要过。 */
      const canPaint = () => !disposed && enabled && blockedBy === null && isActiveSkin();

      const claimSkinLock = () => {
        try {
          if (window[SKIN_LOCK_KEY]?.owner === SKIN_ID) return;
          window[SKIN_LOCK_KEY] = { owner: SKIN_ID, since: Date.now() };
        } catch {
          /* 写不进去不影响皮肤本身 */
        }
      };

      const releaseSkinLock = () => {
        try {
          if (window[SKIN_LOCK_KEY]?.owner === SKIN_ID) delete window[SKIN_LOCK_KEY];
        } catch {
          /* 同上 */
        }
      };

      /** 让位：撤掉自己所有痕迹，但**不改**「启用」开关——那是用户意愿，这是被动让位。 */
      function cedeSkin() {
        try {
          disposeTokens?.();
        } catch {
          /* 已拆除的层再撤一次是 no-op */
        }
        disposeTokens = null;
        try {
          [...document.querySelectorAll('style')]
            .filter((el) => el.getAttribute('data-dsu') === 'skin-lab')
            .forEach((el) => el.remove());
        } catch {
          /* 测试环境没有 querySelectorAll 时跳过 */
        }
        cssInjected = false;
        // 只撤自己的属性：hub 通知按注册顺序派发，切走的那一套可能已经先上色了，
        // 无脑 removeAttribute 会把别人刚打上的标记一起抹掉（顺序依赖 bug）。
        const current = html.getAttribute('data-dsu-skin');
        if (current === null || PRESETS.includes(current)) html.removeAttribute('data-dsu-skin');
        html.removeAttribute('data-dsu-degraded');
        releaseSkinLock();
      }

      /** 上色：打属性、推 token、注入样式、占锁。和 cedeSkin 成对，切换时先撤后上。 */
      function repaintSkin() {
        if (!canPaint()) return false;
        const preset = PRESETS.includes(readSaved()) ? readSaved() : DEFAULT_PRESET;
        html.setAttribute('data-dsu-skin', preset);
        syncTokens();
        injectCss();
        claimSkinLock();
        syncMotion();
        return true;
      }

      const initial = PRESETS.includes(readSaved()) ? readSaved() : DEFAULT_PRESET;
      // 向 hub 登记自己：设置页靠这份清单列出「已装皮肤」。
      const unregisterHub =
        hub?.register?.({ id: SKIN_ID, label: '实验皮肤', hint: '极简 / 像素两套风格' }) ?? (() => {});
      // 用户在设置页换皮肤：轮到我上色，换给别人就让位。
      const unsubHub =
        hub?.subscribe?.(() => {
          if (disposed) return;
          if (isActiveSkin()) repaintSkin();
          else cedeSkin();
        }) ?? (() => {});
      // 冲突时不打属性——组件级 CSS 全靠它生效，属性不在就等于整套皮肤没装。
      if (canPaint()) {
        html.setAttribute('data-dsu-skin', initial);
        claimSkinLock();
      }
      syncMotion();

      // 后加载的皮肤也要能触发互斥：监视已知皮肤标记的增删。
      // 测试环境没有 MutationObserver，取不到就退化成「只在启动时检测一次」。
      let skinWatcher = null;
      if (typeof MutationObserver === 'function') {
        try {
          skinWatcher = new MutationObserver(() => {
            if (blockedBy !== null) return;
            const found = detectForeign();
            if (found === null) return;
            blockedBy = found;
            // 让位：撤掉自己所有痕迹（用户开关不动，那是他的意愿）
            cedeSkin();
            void fetch(`/dsu-skin/ping?skin=ceded|to=${encodeURIComponent(found)}`).catch(() => {});
          });
          skinWatcher.observe(html, {
            attributes: true,
            attributeFilter: FOREIGN_MARKERS.map(([attribute]) => attribute),
          });
        } catch {
          /* 监视装不上不影响主流程 */
        }
      }

      /**
       * 官方字体设置里用户设过哪些类别。皮肤只提供「默认字体」，用户选过就礼让。
       * 读 ctx.theme 的公开快照（fontFamilies），不读 DOM——快照是稳定数据源。
       */
      const readOfficialFontFamilies = () => {
        const fallback = { text: false, code: false };
        try {
          const families = themeApi?.getTheme?.()?.fontFamilies;
          if (families === null || typeof families !== 'object') return fallback;
          return {
            text: typeof families.text === 'string' && families.text.trim() !== '',
            code: typeof families.code === 'string' && families.code.trim() !== '',
          };
        } catch {
          return fallback;
        }
      };

      // —— token 通道：官方主题层（body 内联，优先级最高）——
      // lastLayerJson 去重：overrideTokens 会触发 theme/change，重推必须幂等，
      // 否则「字体变了 → 重推 → 又触发」会转圈。
      let lastLayerJson = '';
      const syncTokens = () => {
        if (!canPaint() || themeApi === null) return;
        const id = html.getAttribute('data-dsu-skin');
        const preset = PRESET_TOKENS[id];
        if (preset === undefined) return;
        const layer = {};
        // 先铺共用派生规则，再用预设自己的值盖上去。
        for (const [name, value] of Object.entries(SHARED_TOKENS)) {
          layer[name] = { light: value, dark: value };
        }
        for (const [name, light] of Object.entries(preset.light ?? {})) {
          layer[name] = { light, dark: preset.dark?.[name] ?? light };
        }
        // 用户主色最后盖：预设只是默认，用户选过的压过它。
        // 只改两个 token —— 其余 10 条派生规则都是 var()/color-mix()，会自动跟着走。
        const brand = readBrand();
        if (brand !== null) {
          const darkBrand = `color-mix(in srgb, ${brand} 70%, white)`;
          layer['--dsw-alias-brand-primary'] = { light: brand, dark: darkBrand };
          layer['--dsw-alias-link'] = { light: brand, dark: darkBrand };
        }
        // 字体族礼让：官方「通用 → 字体」里用户设过的行优先。
        // 官方在 body 上用 --dsw-font-family 把 --dsh-font-family-text 排在栈前；
        // 皮肤覆盖它就把用户那行压掉了（pixel 的等宽栈最明显）。
        // 用户设过 → 皮肤不写这两个变量，让官方字体生效。
        const officialFonts = readOfficialFontFamilies();
        if (officialFonts.text) delete layer['--dsw-font-family'];
        if (officialFonts.code) delete layer['--ds-font-family-code'];
        // 圆角：三档绝对值，压过预设。
        const radius = readRadius();
        if (radius !== null) {
          const set = RADIUS_SETS[radius];
          for (const [key, token] of Object.entries(RADIUS_TOKENS)) {
            layer[token] = { light: set[key], dark: set[key] };
          }
        }
        const json = JSON.stringify(layer);
        if (json === lastLayerJson) return;
        // 必须先记账再推：overrideTokens 内部会同步 emit theme/change，
        // 回调重入 syncTokens 时靠这个值判断「已经推过」——先推后记会无限递归（2026-11-06 实测栈溢出）。
        lastLayerJson = json;
        try {
          disposeTokens = themeApi.overrideTokens(OVERRIDE_SOURCE, layer);
        } catch (error) {
          lastLayerJson = '';
          void fetch(`/dsu-skin/ping?tokenErr=${encodeURIComponent(String(error?.message ?? error))}`).catch(() => {});
        }
      };

      ctx?.inject?.(['theme'], (scope) => {
        themeApi = scope.theme;
        scope.effect?.(() => () => {
          themeApi = null;
          disposeTokens = null;
          lastLayerJson = '';
        }, 'dsh-ui-skin-lab: theme');
        // 官方字体设置变化后重新判断让不让位：用户设了字体族，皮肤就得撤掉自己那行。
        try {
          scope.effect?.(() => scope.on('theme/change', () => syncTokens()), 'dsh-ui-skin-lab: theme fonts');
        } catch {
          /* 没有事件 API 的旧宿主：不影响主流程 */
        }
        syncTokens();
      });

      // —— 组件级覆盖：<style> 注入（可重复调用，内部去重）——
      const injectCss = () => {
        if (cssInjected || !canPaint()) return;
        cssInjected = true;
        void fetch('/dsu-skin/tokens.css')
          .then((response) => (response.ok ? response.text() : ''))
          .then((css) => {
            if (css === '' || !canPaint()) {
              cssInjected = false;
              return;
            }
            // HMR 重载不一定走 dispose，旧 <style> 会留在 head 里。多份 CSS 叠在一起时，
            // 旧标签声明的变量会盖住新预设（2026-11-05 实测）。插入前统一清场。
            [...document.querySelectorAll('style')]
              .filter((el) => el.getAttribute('data-dsu') === 'skin-lab')
              .forEach((el) => el.remove());
            const tag = document.createElement('style');
            tag.setAttribute('data-dsu', 'skin-lab');
            tag.textContent = css;
            document.head.appendChild(tag);
          })
          .catch(() => {
            cssInjected = false;
          });
      };
      injectCss();

      // 能力探测：页面渲染出槽位标记才算「结构在」，否则降级。
      let probeTimer = null;
      const probe = () => {
        const hasSlot = document.querySelector('[data-slot]') !== null;
        if (hasSlot) html.removeAttribute('data-dsu-degraded');
        else html.setAttribute('data-dsu-degraded', '');
      };
      if (document.readyState === 'complete') probe();
      else window.addEventListener('load', probe, { once: true });
      probeTimer = window.setTimeout(probe, 2500);

      /** 切预设的唯一入口：写存储、改属性、重推 token。控制台和设置页都走这里。 */
      const applyPreset = (id) => {
        if (!PRESETS.includes(id)) return false;
        save(id);
        if (canPaint()) html.setAttribute('data-dsu-skin', id);
        syncTokens();
        return true;
      };

      /** 切主色：写存储 + 重推 token。空字符串 = 跟随预设。 */
      const applyBrand = (value) => {
        if (typeof value !== 'string') return false;
        if (value !== '' && /^#[0-9a-f]{6}$/i.test(value) === false) return false;
        saveBrand(value);
        syncTokens();
        return true;
      };

      /** 切圆角：写存储 + 重推 token。空字符串 = 跟随预设。 */
      const applyRadius = (value) => {
        if (typeof value !== 'string') return false;
        if (value !== '' && value !== 'square' && value !== 'round') return false;
        saveRadius(value);
        syncTokens();
        return true;
      };

      /** 动效开关落到 html 属性上（CSS 规则靠它生效，见 tokens.css 第 1 节）。
       *  用函数声明而不是 const：apply 开头就要调它，const 会撞 TDZ。 */
      function syncMotion() {
        if (readMotion()) html.removeAttribute('data-dsu-motion');
        else html.setAttribute('data-dsu-motion', 'off');
      }

      /** 开/关动效：写存储 + 改属性。 */
      const applyMotion = (on) => {
        saveMotion(on !== false);
        syncMotion();
        return true;
      };

      /** 停用：撤 token、删样式、去掉属性、交还锁。设置行不动（还要能重新打开）。 */
      const disableSkin = () => {
        enabled = false;
        try {
          localStorage.setItem(ENABLED_KEY, 'off');
        } catch {
          /* 存不了也只影响下次开机 */
        }
        cedeSkin();
        html.removeAttribute('data-dsu-motion');
        return true;
      };

      /** 启用：重新打属性、推 token、注入样式。被别的皮肤占着（或 hub 里轮不到我）时返回 false。 */
      const enableSkin = () => {
        enabled = true;
        try {
          localStorage.setItem(ENABLED_KEY, 'on');
        } catch {
          /* 同上 */
        }
        blockedBy = detectForeign();
        return repaintSkin();
      };

      // —— E 板块：配置导出 / 导入 / 多套方案 ——
      // 目标（UI-PROJECT 板块 E）：「一份 JSON 配置，能存多套方案，换机器能带走」。
      // 走剪贴板而不是文件对话框：Electron 下不碰文件系统权限，跨机器粘过去就行。
      const SCHEMES_KEY = 'dsh-ui-skin-lab.schemes';
      const CONFIG_FORMAT = 'dsh-ui-skin-lab.config';
      const CONFIG_VERSION = 1;
      const MAX_SCHEMES = 20;

      /** 当前所有偏好（导出的就是这一份）。 */
      const readPrefs = () => ({
        skin: hub?.active?.() ?? DEFAULT_SKIN,
        preset: PRESETS.includes(readSaved()) ? readSaved() : DEFAULT_PRESET,
        brand: readBrand() ?? '',
        radius: readRadius() ?? '',
        motion: readMotion(),
      });

      const listSchemes = () => {
        try {
          const raw = localStorage.getItem(SCHEMES_KEY);
          if (raw === null) return [];
          const list = JSON.parse(raw);
          if (!Array.isArray(list)) return [];
          return list
            .filter((item) => item !== null && typeof item === 'object' && typeof item.name === 'string')
            .map((item) => ({ name: item.name.slice(0, 24), prefs: item.prefs ?? {} }))
            .slice(0, MAX_SCHEMES);
        } catch {
          return [];
        }
      };

      const saveSchemes = (list) => {
        try {
          localStorage.setItem(SCHEMES_KEY, JSON.stringify(list.slice(0, MAX_SCHEMES)));
        } catch {
          /* 隐私模式下写不进去 */
        }
      };

      /** 导出：format/version 是给导入端校验的，不是装饰。 */
      const exportConfig = (name = '') => ({
        format: CONFIG_FORMAT,
        version: CONFIG_VERSION,
        exportedAt: new Date().toISOString(),
        name: String(name).slice(0, 24),
        prefs: readPrefs(),
        schemes: listSchemes(),
      });

      /** 逐项校验后再写：非法字段**整条跳过**，不整体失败，也绝不写脏值。 */
      const applyPrefs = (prefs) => {
        if (prefs === null || typeof prefs !== 'object') return false;
        if (typeof prefs.skin === 'string' && (hub?.list?.() ?? []).some((item) => item.id === prefs.skin)) {
          hub?.setActive?.(prefs.skin);
        }
        if (PRESETS.includes(prefs.preset)) applyPreset(prefs.preset);
        if (typeof prefs.brand === 'string' && (prefs.brand === '' || /^#[0-9a-f]{6}$/i.test(prefs.brand))) {
          applyBrand(prefs.brand);
        }
        if (typeof prefs.radius === 'string' && (prefs.radius === '' || prefs.radius === 'square' || prefs.radius === 'round')) {
          applyRadius(prefs.radius);
        }
        if (typeof prefs.motion === 'boolean') applyMotion(prefs.motion);
        return true;
      };

      /** 导入：接受对象或 JSON 字符串。格式/版本不对直接拒绝。 */
      const importConfig = (raw) => {
        let data = raw;
        if (typeof raw === 'string') {
          try {
            data = JSON.parse(raw);
          } catch {
            return false;
          }
        }
        if (data === null || typeof data !== 'object') return false;
        if (data.format !== CONFIG_FORMAT) return false;
        if (data.version !== CONFIG_VERSION) return false;
        if (data.prefs === null || typeof data.prefs !== 'object') return false;
        if (Array.isArray(data.schemes)) saveSchemes(data.schemes.filter((item) => item?.name));
        return applyPrefs(data.prefs);
      };

      const saveScheme = (name) => {
        const trimmed = String(name ?? '').trim().slice(0, 24);
        if (trimmed === '') return false;
        const list = listSchemes().filter((item) => item.name !== trimmed);
        list.push({ name: trimmed, prefs: readPrefs() });
        saveSchemes(list);
        return true;
      };

      const applyScheme = (name) => {
        const found = listSchemes().find((item) => item.name === name);
        if (found === undefined) return false;
        return applyPrefs(found.prefs);
      };

      const deleteScheme = (name) => {
        const list = listSchemes();
        const next = list.filter((item) => item.name !== name);
        if (next.length === list.length) return false;
        saveSchemes(next);
        return true;
      };

      /** 复制到剪贴板：优先 async API，失败退到 execCommand（dsh-app:// 下不一定有 secure context）。 */
      const copyText = async (text) => {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            return true;
          }
        } catch {
          /* 落到下面的兜底 */
        }
        try {
          const area = document.createElement('textarea');
          area.value = text;
          document.body.appendChild(area);
          area.select();
          const ok = document.execCommand?.('copy');
          area.remove();
          return ok === true;
        } catch {
          return false;
        }
      };

      const readText = async () => {
        try {
          if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
            return await navigator.clipboard.readText();
          }
        } catch {
          /* 读不到就当空 */
        }
        return '';
      };

      window.__dsuSkinLab = {
        /** 元数据也在这里：`presets/<id>/preset.json` 已并入 PRESET_TOKENS，避免两处漂移。 */
        presets: PRESETS.map((id) => ({
          id,
          label: PRESET_TOKENS[id]?.label ?? id,
          description: PRESET_TOKENS[id]?.description ?? '',
        })),
        get current() {
          return html.getAttribute('data-dsu-skin');
        },
        select: applyPreset,
        /** 已装皮肤清单（hub 汇总：本包 + 素色基准 + 将来第三方）+ 当前选中。 */
        get skins() {
          return hub?.list?.() ?? [];
        },
        get activeSkin() {
          return hub?.active?.() ?? DEFAULT_SKIN;
        },
        setSkin: (id) => {
          if (typeof id !== 'string' || id === '') return false;
          const known = (hub?.list?.() ?? []).some((item) => item.id === id);
          if (!known) return false;
          hub?.setActive?.(id);
          return true;
        },
        /** 配置导出 / 导入 / 多套方案（E 板块）。JSON 结构见 tests/check-config.mjs。 */
        get config() {
          return exportConfig();
        },
        exportConfig,
        importConfig,
        get schemes() {
          return listSchemes();
        },
        saveScheme,
        applyScheme,
        deleteScheme,
        get brand() {
          return readBrand();
        },
        brandPalette: BRAND_PALETTE.map(({ id, label, value }) => ({ id, label, value })),
        setBrand: applyBrand,
        get radius() {
          return readRadius();
        },
        radiusPresets: RADIUS_PRESETS.map(({ id, label, value }) => ({ id, label, value })),
        setRadius: applyRadius,
        get motion() {
          return readMotion();
        },
        setMotion: applyMotion,
        get enabled() {
          return enabled;
        },
        /** 被谁抢了地盘（null = 没有）。 */
        get blockedBy() {
          return blockedBy;
        },
        /** 一句话状态，设置行和调试共用。 */
        status: () => {
          if (blockedBy !== null) return `已被 ${blockedBy} 接管，本皮肤已停用`;
          if (!enabled) return '已手动停用';
          return '运行中';
        },
        enable: enableSkin,
        disable: disableSkin,
      };

      // —— 设置页：独立「外观」分区（2026-11-06，E 板块）——
      // 官方插件的写法：slots.register 到 `settings.section`（list 槽），
      // 组件拿到 { t, useStore, ...inject 返回的动作 }；导航图标走
      // `settings.section.icon`（同 id；没注册时外壳 fallback 是设置齿轮）。
      const settingsStyle = document.createElement('style');
      settingsStyle.setAttribute('data-dsu', 'skin-lab-settings');
      // 设置行的样式**不能**依赖 html[data-dsu-skin]：皮肤被停用/被别的皮肤接管时属性会撤掉，
      // 而行必须还能显示（用户要靠它重新打开）。它是动态注入的 <style data-dsu="skin-lab-settings">，
      // 卸载时由 cleanup 一并删掉，不靠属性做回退保证。
      settingsStyle.textContent = [
        '.dsu-skin-row{display:flex;flex-direction:column;gap:8px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}',
        '.dsu-skin-intro{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px;padding:0 0 8px}',
        '.dsu-skin-row-title{color:var(--dsw-alias-label-primary);font-size:14px;line-height:22px}',
        '.dsu-skin-status{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
        '.dsu-skin-row-cubes{display:flex;flex-wrap:wrap;gap:8px}',
        '.dsu-skin-cube{box-sizing:border-box;flex:180px;padding:14px 24px;font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);background:0 0;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-lg);cursor:pointer;text-align:center}',
        '.dsu-skin-cube:hover:not(.dsu-skin-cube-selected){background:var(--dsw-alias-interactive-bg-hover)}',
        '.dsu-skin-cube-selected{background:var(--dsw-alias-interactive-bg-active);border-color:var(--dsw-alias-brand-primary)}',
        '.dsu-skin-cube:disabled{opacity:.5;cursor:default}',
        '.dsu-skin-toggle{align-self:flex-start;background:0 0;border:0;padding:0;color:var(--dsw-alias-brand-primary);font:inherit;font-size:12px;cursor:pointer}',
        // 主色色块。「跟随预设」那一格没有颜色，用一道斜纹表示「无」。
        // 注意别用 data-* 属性做自己的状态标记：check-selectors 会把所有 data-* 当成官方属性要求登记。
        '.dsu-brand-chip{width:26px;height:26px;padding:0;border:2px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);cursor:pointer}',
        '.dsu-brand-chip-default{background:linear-gradient(135deg,var(--dsw-alias-bg-layer-2) 45%,var(--dsw-alias-label-tertiary) 45%,var(--dsw-alias-label-tertiary) 55%,var(--dsw-alias-bg-layer-2) 55%)}',
        '.dsu-brand-chip-selected{border-color:var(--dsw-alias-label-primary);outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
        '.dsu-brand-chip:disabled{opacity:.5;cursor:default}',
        // 窄按钮：预设方块是 flex:180px，这几行（圆角/动效/图标/方案）收窄成内容宽。
        '.dsu-font-chip{flex:0 0 auto;padding:6px 16px}',
      ].join('');
      // 同 HMR 清场逻辑：旧设置行样式也一起清，别越叠越多。
      [...document.querySelectorAll('style')]
        .filter((el) => el.getAttribute('data-dsu') === 'skin-lab-settings')
        .forEach((el) => el.remove());
      document.head.appendChild(settingsStyle);

      // slots 是官方服务，**必须走 ctx.inject 申请**——直接读 ctx.slots 拿到的是 undefined
      // （2026-11-05 实测：`settingsRow=skipped|react=true|store=true|slots=false`）。
      // 用动态注入而不是声明式 inject，是为了 slots 拿不到时皮肤本身照常工作。
      const installSettingsSection = (slots) => {
        const store = defineStore({
          init: () => ({
            preset: html.getAttribute('data-dsu-skin') ?? DEFAULT_PRESET,
            // 外层「皮肤」：hub 里用户选中的那套（没选过 = 本包）
            skin: hub?.active?.() ?? DEFAULT_SKIN,
            brand: readBrand() ?? '',
            radius: readRadius() ?? '',
            motion: readMotion(),
            // 方案只存名字：嵌套对象会让 store 的比较逻辑变复杂。
            schemes: listSchemes().map((item) => item.name),
            notice: '',
            // 被别的皮肤接管时 store 初始就是关，避免 UI 显示「运行中」骗人。
            enabled: window.__dsuSkinLab?.enabled === true && window.__dsuSkinLab?.blockedBy === null,
          }),
          actions: {
            sync: (state, preset) => {
              state.preset = preset;
            },
            setSkinId: (state, skin) => {
              state.skin = skin;
            },
            setSchemes: (state, schemes) => {
              state.schemes = schemes;
            },
            setNotice: (state, notice) => {
              state.notice = notice;
            },
            setEnabled: (state, enabled) => {
              state.enabled = enabled;
            },
            setBrand: (state, brand) => {
              state.brand = brand;
            },
            setRadius: (state, radius) => {
              state.radius = radius;
            },
            setMotion: (state, motion) => {
              state.motion = motion;
            },
          },
        });
        let bound = null;
        /** 导航图标：2×2 方块（像素风最小符号）。外壳按 { size, active } 传参。 */
        const SkinNavIcon = ({ size = 16 }) =>
          React.createElement(
            'svg',
            { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
            React.createElement('rect', { x: 2, y: 2, width: 5, height: 5, rx: 1, fill: 'currentColor' }),
            React.createElement('rect', { x: 9, y: 2, width: 5, height: 5, rx: 1, fill: 'currentColor' }),
            React.createElement('rect', { x: 2, y: 9, width: 5, height: 5, rx: 1, fill: 'currentColor' }),
            React.createElement('rect', { x: 9, y: 9, width: 5, height: 5, rx: 1, fill: 'currentColor' }),
          );
        const SkinSection = ({
          useStore,
          setPreset,
          setSkin,
          setEnabled,
          setBrand,
          setRadius,
          setMotion,
          setSchemes,
          setNotice,
          saveScheme,
          applyScheme,
          exportConfig,
          importConfig,
        }) => {
          const current = useStore((state) => state.preset);
          const skin = useStore((state) => state.skin);
          const schemes = useStore((state) => state.schemes);
          const notice = useStore((state) => state.notice);
          const enabled = useStore((state) => state.enabled);
          const brand = useStore((state) => state.brand);
          const radius = useStore((state) => state.radius);
          const motion = useStore((state) => state.motion);
          const status = window.__dsuSkinLab?.status?.() ?? '';
          const toggle = () => {
            const skin = window.__dsuSkinLab;
            if (skin?.enabled === true) {
              skin.disable?.();
              setEnabled(false);
              return;
            }
            // 被别的皮肤占着时 enable 会返回 false，UI 保持关闭。
            setEnabled(skin?.enable?.() === true);
          };
          return React.createElement(
            'div',
            { className: 'dsu-skin-row' },
            React.createElement(
              'div',
              { className: 'dsu-skin-intro' },
              '外观设置只影响样式，不改行为。正文字号在「通用 → 字体大小」里调。',
            ),
            // 外层：装了几套皮肤就列几套（hub 汇总）。切换时由各皮肤自己让位/上色。
            React.createElement('div', { className: 'dsu-skin-row-title' }, '皮肤'),
            React.createElement('div', { className: 'dsu-skin-status' }, status),
            React.createElement(
              'div',
              { className: 'dsu-skin-row-cubes' },
              (window.__dshSkinHub?.list?.() ?? []).map((item) =>
                React.createElement(
                  'button',
                  {
                    key: item.id,
                    type: 'button',
                    title: item.hint || undefined,
                    disabled: !enabled || skin === item.id,
                    'aria-pressed': skin === item.id,
                    className: 'dsu-skin-cube' + (skin === item.id ? ' dsu-skin-cube-selected' : ''),
                    onClick: () => setSkin(item.id),
                  },
                  item.label,
                ),
              ),
            ),
            // 内层：只有本包被选中时，「风格」才有意义（素色没有风格可选）。
            React.createElement('div', { className: 'dsu-skin-row-title' }, '风格'),
            React.createElement(
              'div',
              { className: 'dsu-skin-row-cubes' },
              PRESETS.map((id) =>
                React.createElement(
                  'button',
                  {
                    key: id,
                    type: 'button',
                    title: skin === DEFAULT_SKIN ? undefined : '这套皮肤没有风格可选',
                    disabled: !enabled || skin !== DEFAULT_SKIN,
                    'aria-pressed': current === id,
                    className: 'dsu-skin-cube' + (current === id ? ' dsu-skin-cube-selected' : ''),
                    onClick: () => setPreset(id),
                  },
                  PRESET_TOKENS[id]?.label ?? id,
                ),
              ),
            ),
            React.createElement('div', { className: 'dsu-skin-row-title' }, '主色'),
            React.createElement(
              'div',
              { className: 'dsu-skin-row-cubes' },
              BRAND_PALETTE.map((item) =>
                React.createElement('button', {
                  key: item.id,
                  type: 'button',
                  disabled: !enabled,
                  title: item.label,
                  'aria-label': item.label,
                  'aria-pressed': brand === item.value,
                  className:
                    'dsu-brand-chip' +
                    (item.value === '' ? ' dsu-brand-chip-default' : '') +
                    (brand === item.value ? ' dsu-brand-chip-selected' : ''),
                  style: item.value ? { background: item.value } : undefined,
                  onClick: () => setBrand(item.value),
                }),
              ),
            ),
            React.createElement('div', { className: 'dsu-skin-row-title' }, '圆角'),
            React.createElement(
              'div',
              { className: 'dsu-skin-row-cubes' },
              RADIUS_PRESETS.map((item) =>
                React.createElement(
                  'button',
                  {
                    key: item.id,
                    type: 'button',
                    disabled: !enabled,
                    'aria-pressed': radius === item.value,
                    className: 'dsu-skin-cube dsu-font-chip' + (radius === item.value ? ' dsu-skin-cube-selected' : ''),
                    onClick: () => setRadius(item.value),
                  },
                  item.label,
                ),
              ),
            ),
            React.createElement('div', { className: 'dsu-skin-row-title' }, '动效'),
            React.createElement(
              'div',
              { className: 'dsu-skin-row-cubes' },
              [
                { id: 'on', label: '开', value: true },
                { id: 'off', label: '关', value: false },
              ].map((item) =>
                React.createElement(
                  'button',
                  {
                    key: item.id,
                    type: 'button',
                    disabled: !enabled,
                    'aria-pressed': motion === item.value,
                    className: 'dsu-skin-cube dsu-font-chip' + (motion === item.value ? ' dsu-skin-cube-selected' : ''),
                    onClick: () => setMotion(item.value),
                  },
                  item.label,
                ),
              ),
            ),
            // 方案 / 导出 / 导入（E 板块：「一份 JSON，能存多套方案，换机器能带走」）
            React.createElement('div', { className: 'dsu-skin-row-title' }, '方案'),
            React.createElement(
              'div',
              { className: 'dsu-skin-row-cubes' },
              [
                ...schemes.map((name) =>
                  React.createElement(
                    'button',
                    {
                      key: `scheme-${name}`,
                      type: 'button',
                      disabled: !enabled,
                      title: '点击套用',
                      className: 'dsu-skin-cube dsu-font-chip',
                      onClick: () => {
                        setNotice(applyScheme(name) ? `已套用「${name}」` : '套用失败');
                      },
                    },
                    name,
                  ),
                ),
                React.createElement(
                  'button',
                  {
                    key: 'scheme-save',
                    type: 'button',
                    disabled: !enabled,
                    className: 'dsu-skin-cube dsu-font-chip',
                    onClick: () => {
                      const name = `方案 ${schemes.length + 1}`;
                      if (saveScheme(name)) {
                        setSchemes(schemes.concat([name]));
                        setNotice(`已存为「${name}」`);
                      }
                    },
                  },
                  '＋ 存为方案',
                ),
                React.createElement(
                  'button',
                  {
                    key: 'config-export',
                    type: 'button',
                    disabled: !enabled,
                    className: 'dsu-skin-cube dsu-font-chip',
                    onClick: async () => {
                      setNotice((await exportConfig()) ? '配置已复制到剪贴板' : '剪贴板不可用，改用控制台 __dsuSkinLab.config');
                    },
                  },
                  '导出',
                ),
                React.createElement(
                  'button',
                  {
                    key: 'config-import',
                    type: 'button',
                    disabled: !enabled,
                    className: 'dsu-skin-cube dsu-font-chip',
                    onClick: async () => {
                      setNotice((await importConfig()) ? '配置已导入' : '导入失败：剪贴板里没有合法配置');
                    },
                  },
                  '导入',
                ),
              ],
            ),
            notice ? React.createElement('div', { className: 'dsu-skin-status' }, notice) : null,
            React.createElement(
              'button',
              { type: 'button', className: 'dsu-skin-toggle', onClick: toggle },
              enabled ? '停用我的皮肤' : '启用我的皮肤',
            ),
          );
        };
        slots.inject('settings.section', () =>
          slots.register(
            {
              name: 'settings.section',
              id: 'skin',
              order: 12,
              label: () => '外观',
              store,
              inject: (actions) => {
                bound = actions;
                return {
                  setSchemes: (list) => bound?.setSchemes(list),
                  setNotice: (text) => bound?.setNotice(text),
                  saveScheme: (name) => saveScheme(name),
                  applyScheme: (name) => applyScheme(name),
                  exportConfig: async () => copyText(JSON.stringify(exportConfig(), null, 2)),
                  importConfig: async () => {
                    const text = await readText();
                    if (text === '') return false;
                    return importConfig(text);
                  },
                  setSkin: (id) => {
                    if (hub?.list?.().some((item) => item.id === id) !== true) return;
                    hub?.setActive?.(id);
                    bound?.setSkinId(id);
                  },
                  setPreset: (id) => {
                    if (!applyPreset(id)) return;
                    bound?.sync(id);
                  },
                  setEnabled: (value) => bound?.setEnabled(value),
                  setBrand: (value) => {
                    if (!applyBrand(value)) return;
                    bound?.setBrand(value);
                  },
                  setRadius: (value) => {
                    if (!applyRadius(value)) return;
                    bound?.setRadius(value);
                  },
                  setMotion: (value) => {
                    applyMotion(value);
                    bound?.setMotion(value !== false);
                  },
                };
              },
            },
            SkinSection,
          ),
        );
        // 导航图标：同 id 注册到 settings.section.icon；外壳找不到时 fallback 是设置齿轮。
        slots.inject('settings.section.icon', () =>
          slots.register({ name: 'settings.section.icon', id: 'skin' }, SkinNavIcon),
        );
      };

      if (React !== null && defineStore !== null) {
        try {
          ctx?.inject?.(['slots'], (scope) => {
            try {
              const slots = scope?.slots;
              if (typeof slots?.register !== 'function') {
                void fetch('/dsu-skin/ping?settingsRow=no-slots-api').catch(() => {});
                return;
              }
              installSettingsSection(slots);
            } catch (error) {
              void fetch(`/dsu-skin/ping?settingsErr=${encodeURIComponent(String(error?.message ?? error))}`).catch(() => {});
            }
          });
        } catch (error) {
          void fetch(`/dsu-skin/ping?settingsErr=inject:${encodeURIComponent(String(error?.message ?? error))}`).catch(() => {});
        }
      } else {
        void fetch(
          `/dsu-skin/ping?settingsRow=skipped|react=${React !== null}|store=${defineStore !== null}`,
        ).catch(() => {});
      }

      // —— 结构基线探针（F 板块：官方 DOM 变了要能报警，不能静默失效）——
      // 这份清单必须与 selectors.json 里 expect = present / conditional 的条目一致，
      // tests/check-structure.mjs 会比对两边；真机回传的数据用来判断锚点还在不在。
      // 为什么放在客户端：只有浏览器里才能 querySelectorAll，Host 侧看不到 DOM。
      const STRUCT_ANCHORS = [
        '[data-slot]',
        '[data-slot="sidebar"]',
        '[class*="sidebarCol"]',
        'header[class*="header"]',
        '[data-slot="conversation.header"]',
        '[data-composer-card]',
        '.md-code-block',
        '[data-chat-flow-kind]',
        'button',
        '[role="tab"]',
        '[role="menu"]',
        '[role="dialog"]',
        '[role="menuitem"]',
        '[class*="bubble"]',
      ];
      let structTimer = null;
      if (typeof window.setTimeout === 'function') {
        try {
          structTimer = window.setTimeout(() => {
            if (disposed) return;
            const counts = {};
            for (const selector of STRUCT_ANCHORS) {
              try {
                counts[selector] = document.querySelectorAll(selector).length;
              } catch {
                counts[selector] = -1;
              }
            }
            const packed = encodeURIComponent(JSON.stringify(counts));
            void fetch(`/dsu-skin/ping?struct=${packed}`).catch(() => {});
          }, 2500);
        } catch {
          /* 探针失败不影响皮肤 */
        }
      }

      ctx?.logger?.info?.('dsh-ui-skin-lab: 外观实验室已加载');

      return () => {
        disposed = true;
        if (probeTimer !== null) window.clearTimeout(probeTimer);
        if (structTimer !== null) window.clearTimeout(structTimer);
        // 从多皮肤 hub 上摘下自己：设置页不该再列出一套已经卸载的皮肤。
        try {
          unsubHub();
          unregisterHub();
        } catch {
          /* hub 拿不到时就是空函数 */
        }
        try {
          skinWatcher?.disconnect?.();
        } catch {
          /* 没装上就是 null */
        }
        // 撤掉 token 层（官方 presenter 会把 body 上的变量一并清掉）。
        try {
          disposeTokens?.();
        } catch {
          /* 已拆除的层再撤一次是 no-op */
        }
        // 不只删自己那份：HMR 可能留下多份，卸载时要清干净。
        [...document.querySelectorAll('style')]
          .filter((el) => {
            const marker = el.getAttribute('data-dsu');
            return marker === 'skin-lab' || marker === 'skin-lab-settings';
          })
          .forEach((el) => el.remove());
        html.removeAttribute('data-dsu-skin');
        html.removeAttribute('data-dsu-degraded');
        html.removeAttribute('data-dsu-motion');
        releaseSkinLock();
        delete window.__dsuSkinLab;
      };
    },
  }),
}); 