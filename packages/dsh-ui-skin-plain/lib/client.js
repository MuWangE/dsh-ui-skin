/**
 * `dsh-ui-skin-plain` — 素色基准皮肤（多皮肤框架的第二套，只验框架，不做视觉）。
 *
 * 为什么存在：板块 B 的原始定义是「runtime 包 + 一套『素色』基准皮肤」，
 * 验收「装两套皮肤，切换互斥；卸载后页面回到默认」。没有第二套皮肤，
 * 这条永远只能靠与第三方皮肤（maid-atelier）让位来间接证明，不算数。
 *
 * 它做的事极少：把品牌色换成中性灰，其余全跟官方 token。
 * 目的是让「切换」肉眼可见，同时把风险压到最低。
 *
 * 协议（`__dshSkinHub` / `__dshSkinLock`）与 `dsh-ui-skin-lab` 同源。
 * 两个包无法共享模块，所以各有一份实现；**改协议必须两边一起改**，
 * `tests/check-skins.mjs` 会比对两边的行为。
 */
window.__ModuleLoader__.load({
  id: 'dsh-ui-skin-plain',
  factory: (require) => ({
    apply(ctx) {
      const html = document.documentElement;
      const SKIN_ID = 'dsh-ui-skin-plain';
      const HUB_KEY = '__dshSkinHub';
      const ACTIVE_KEY = 'dsh-ui-skin.active';
      const LOCK_KEY = '__dshSkinLock';

      // —— hub 实现：与 dsh-ui-skin-lab 的 getHub 逐行一致，改一处必须改两处 ——
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

      let disposed = false;
      let themeApi = null;
      let disposeTokens = null;

      const lockOwner = () => {
        try {
          const lock = window[LOCK_KEY];
          return lock !== undefined && lock !== null && typeof lock.owner === 'string' ? lock.owner : null;
        } catch {
          return null;
        }
      };
      /** 用户选中了我这套。 */
      const isActive = () => (hub?.active?.() ?? null) === SKIN_ID;
      /** 轮到我 + 没有第三方占锁。同族皮肤（hub 里登记过的）由 active 决定谁上，不算冲突。 */
      const canPaint = () => {
        if (disposed || !isActive()) return false;
        const owner = lockOwner();
        if (owner === null || owner === SKIN_ID) return true;
        return (hub?.list?.() ?? []).some((item) => item.id === owner);
      };

      function claim() {
        try {
          window[LOCK_KEY] = { owner: SKIN_ID, since: Date.now() };
        } catch {
          /* 写不进去不影响观感 */
        }
      }
      function release() {
        try {
          if (lockOwner() === SKIN_ID) delete window[LOCK_KEY];
        } catch {
          /* 同上 */
        }
      }

      /** 素色：只动两个品牌 token，其余全跟官方。 */
      const LAYER = {
        '--dsw-alias-brand-primary': { light: '#4b5563', dark: '#9ca3af' },
        '--dsw-alias-link': { light: '#4b5563', dark: '#9ca3af' },
      };

      function paint() {
        if (!canPaint()) return false;
        try {
          disposeTokens?.();
        } catch {
          /* 已拆除的层再撤一次是 no-op */
        }
        disposeTokens = null;
        html.setAttribute('data-dsu-skin', 'plain');
        try {
          if (themeApi !== null) disposeTokens = themeApi.overrideTokens(SKIN_ID, LAYER) ?? null;
        } catch {
          /* 主题层不可用时至少属性在，不至于整套失效 */
        }
        claim();
        return true;
      }

      function cede() {
        try {
          disposeTokens?.();
        } catch {
          /* 同上 */
        }
        disposeTokens = null;
        // 只撤自己的：hub 通知按注册顺序派发，别人可能已经先上色了。
        if (html.getAttribute('data-dsu-skin') === 'plain') html.removeAttribute('data-dsu-skin');
        release();
      }

      const unregister =
        hub?.register?.({ id: SKIN_ID, label: '素色基准', hint: '中性灰，不做结构覆盖' }) ?? (() => {});
      const unsubscribe =
        hub?.subscribe?.(() => {
          if (disposed) return;
          if (isActive()) paint();
          else cede();
        }) ?? (() => {});

      ctx?.inject?.(['theme'], (scope) => {
        themeApi = scope.theme;
        scope.effect?.(
          () => () => {
            themeApi = null;
            disposeTokens = null;
          },
          'dsh-ui-skin-plain: theme',
        );
        if (isActive()) paint();
      });

      ctx?.logger?.info?.('dsh-ui-skin-plain: 素色基准皮肤已加载');

      return () => {
        disposed = true;
        try {
          unsubscribe();
          unregister();
        } catch {
          /* hub 拿不到时就是空函数 */
        }
        cede();
      };
    },
  }),
});
