/**
 * 在假 DOM 里跑一遍 client.js：注册 factory → 物化 → 调用 apply。
 * 目的：
 *   1. 确认它在浏览器里执行时不会抛错（抛错的话页面侧会静默失败）；
 *   2. 确认预设 token 真的通过 ctx.theme.overrideTokens 推给了官方主题层。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const code = fs.readFileSync(path.join(HERE, '..', 'packages', 'dsh-ui-skin-lab', 'lib', 'client.js'), 'utf8');

const registrations = [];
const attributes = new Map();
const styles = [];
const requests = [];

const documentElement = {
  setAttribute(name, value) {
    attributes.set(name, value);
  },
  removeAttribute(name) {
    attributes.delete(name);
  },
  getAttribute(name) {
    return attributes.get(name) ?? null;
  },
};

const sandbox = {
  console,
  window: {
    __ModuleLoader__: {
      load(definition) {
        registrations.push(definition);
      },
    },
    addEventListener() {},
    removeEventListener() {},
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  },
  document: {
    documentElement,
    readyState: 'complete',
    createElement(tag) {
      const element = {
        tagName: tag,
        textContent: '',
        attributes: new Map(),
        setAttribute(name, value) {
          this.attributes.set(name, value);
        },
        getAttribute(name) {
          return this.attributes.get(name) ?? null;
        },
        remove() {
          const index = styles.indexOf(this);
          if (index >= 0) styles.splice(index, 1);
        },
      };
      return element;
    },
    head: {
      appendChild(element) {
        styles.push(element);
      },
    },
    querySelector() {
      return {};
    },
    querySelectorAll() {
      return [...styles];
    },
  },
  localStorage: {
    data: new Map(),
    getItem(key) {
      return this.data.get(key) ?? null;
    },
    setItem(key, value) {
      this.data.set(key, value);
    },
    removeItem(key) {
      this.data.delete(key);
    },
  },
  fetch(url) {
    requests.push(String(url));
    return Promise.resolve({ ok: true, text: async () => 'html[data-dsu-skin]{--dsu-space-1:4px}' });
  },
  Request: class {},
  URL,
  encodeURIComponent,
};

vm.runInNewContext(code, sandbox, { filename: 'client.js' });

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`, detail ?? '');
};

check('factory 已注册 id=dsh-ui-skin-lab', registrations.length === 1 && registrations[0].id === 'dsh-ui-skin-lab');

const definition = registrations[0];

// 模拟模块加载器的 require：只提供设置行需要的那两个包。
const fakeRequire = (id) => {
  if (id === 'react') {
    return {
      createElement: (type, props, ...children) => ({ type, props, children }),
    };
  }
  if (id === '@deepseek-ai/dsh-client-store') {
    return {
      defineStore: (spec) => ({ init: spec.init, actions: spec.actions, get: () => spec.init() }),
    };
  }
  return {};
};

const exportsObject = definition.factory(fakeRequire);
check('factory 返回 apply', typeof exportsObject?.apply === 'function');

// 模拟官方主题服务：记录 overrideTokens 的调用。
let captured = null;
let changeListeners = [];
let themeFontFamilies = { text: '', code: '' };
const themeScope = {
  theme: {
    getTheme() {
      return { fontFamilies: themeFontFamilies };
    },
    overrideTokens(source, layer) {
      captured = { source, layer };
      // 官方 ThemeRuntime 推层后同步 emit theme/change；重入防线要扛住
      // （2026-11-06 实测：先推后记账会无限递归栈溢出）。
      for (const callback of [...changeListeners]) callback();
      return () => {
        captured = null;
      };
    },
  },
  on(name, callback) {
    if (name !== 'theme/change') return () => {};
    changeListeners.push(callback);
    return () => {
      changeListeners = changeListeners.filter((item) => item !== callback);
    };
  },
  effect(callback) {
    return callback();
  },
};

const registeredRows = [];
// slots 是官方服务，client 通过 ctx.inject(['slots']) 申请（直接读 ctx.slots 拿不到）。
const slotsScope = {
  slots: {
    inject(name, callback) {
      check('注册到官方设置槽位', name === 'settings.section' || name === 'settings.section.icon', name);
      callback();
    },
    register(options, component) {
      registeredRows.push({ options, component });
      return () => {};
    },
  },
};

const ctx = {
  logger: { info() {} },
  inject(deps, callback) {
    check('请求了官方服务', Array.isArray(deps), deps?.join(','));
    if (deps.includes('theme')) callback(themeScope);
    if (deps.includes('slots')) callback(slotsScope);
  },
};

// 先塞一个用户主色 + 圆角：验证覆写层压在预设之后（否则旋钮等于没接上）。
// 字号自 2026-11-06 起交给官方「通用 → 字体大小」，皮肤不再读写 dsh-ui-skin-lab.font。
sandbox.localStorage.setItem('dsh-ui-skin-lab.brand', '#be185d');
sandbox.localStorage.setItem('dsh-ui-skin-lab.radius', 'square');

const disposed = exportsObject.apply(ctx);
check('apply 执行', true);
check('data-dsu-skin 已设置', documentElement.getAttribute('data-dsu-skin') !== null, documentElement.getAttribute('data-dsu-skin'));

const flush = () => new Promise((resolve) => setImmediate(resolve));
await flush();
await flush();
await flush();

check('拉取了 tokens.css', requests.some((url) => url.includes('tokens.css')));
check('样式已注入', styles.some((element) => element.getAttribute('data-dsu') === 'skin-lab'));
check('token 已推给官方主题层', captured !== null);
check('官方同步 emit theme/change 时不会无限递归', !requests.some((url) => url.includes('tokenErr')));
check(
  'token 层是 { light, dark } 成对结构',
  captured !== null &&
    Object.values(captured.layer).every(
      (value) => typeof value === 'object' && value !== null && typeof value.light === 'string' && typeof value.dark === 'string',
    ),
  captured === null ? '(未推送)' : `${Object.keys(captured.layer).length} 个 token`,
);
check('token 数量 ≥ 80（覆盖得够才算整套重绘）', captured !== null && Object.keys(captured.layer).length >= 80, `${captured === null ? 0 : Object.keys(captured.layer).length} 个`);
check('覆盖层 source 固定', captured?.source === 'dsh-ui-skin-lab', captured?.source);

// 主色覆写层：值来自 localStorage，深色那半必须是提亮后的 color-mix
const brandEntry = captured?.layer?.['--dsw-alias-brand-primary'];
check('主色覆写：brand-primary 被用户色压过', brandEntry?.light === '#be185d', brandEntry?.light);
check(
  '主色覆写：深色那半是提亮的 color-mix',
  typeof brandEntry?.dark === 'string' && brandEntry.dark.includes('color-mix') && brandEntry.dark.includes('#be185d'),
  brandEntry?.dark,
);
check('主色覆写：link 跟着同一个色', captured?.layer?.['--dsw-alias-link']?.light === '#be185d');
check('主色覆写：派生 token 仍是 var/color-mix（不写死）', String(captured?.layer?.['--dsw-alias-button-primary-fill']?.light ?? '').includes('var(--dsw-alias-brand-primary)'));

// 字号：2026-11-06 起交给官方「通用 → 字体大小」，皮肤层不再碰 --dsh-content-font-size。
check('字号不再进 token 层（交给官方）', captured?.layer?.['--dsh-content-font-size'] === undefined);

// 圆角覆写：三档给绝对值，直角那档全部 0px
check('圆角覆写：radius-xl 被压成 0px', captured?.layer?.['--dsw-radius-xl']?.light === '0px', captured?.layer?.['--dsw-radius-xl']?.light);
check('圆角覆写：radius-panel 同样归零', captured?.layer?.['--dsw-radius-panel']?.light === '0px');

// 字体族礼让（2026-11-06）：官方「通用 → 字体」里用户设过的行优先。
// 用户设了正文字体 → 皮肤不覆盖 --dsw-font-family；代码字体没设 → 仍提供。
themeFontFamilies = { text: '"PingFang SC", sans-serif', code: '' };
sandbox.window.__dsuSkinLab?.setRadius('round');
check('礼让：用户设了正文字体 → 皮肤撤掉 --dsw-font-family', captured?.layer?.['--dsw-font-family'] === undefined);
check(
  '礼让：代码字体没设 → 皮肤仍给 --ds-font-family-code',
  typeof captured?.layer?.['--ds-font-family-code']?.light === 'string',
  captured?.layer?.['--ds-font-family-code']?.light,
);
check('礼让后圆角仍然生效', captured?.layer?.['--dsw-radius-xl']?.light === '20px', captured?.layer?.['--dsw-radius-xl']?.light);

// 设置页：独立「外观」section（2026-11-06，E 板块）
const sectionRow = registeredRows.find((row) => row.options?.name === 'settings.section');
const iconRow = registeredRows.find((row) => row.options?.name === 'settings.section.icon');
check('注册为独立 section（不再是 general.item 里的一行）', sectionRow !== undefined);
check('section id 固定', sectionRow?.options?.id === 'skin', sectionRow?.options?.id);
check('section 有导航标签', typeof sectionRow?.options?.label === 'function' && sectionRow.options.label() === '外观');
check('section 带组件', typeof sectionRow?.component === 'function');
check('section 有 store', typeof sectionRow?.options?.store === 'object' && sectionRow?.options?.store !== null);
const actions = typeof sectionRow?.options?.inject === 'function' ? sectionRow.options.inject({ sync() {} }) : null;
check('section 暴露 setPreset', typeof actions?.setPreset === 'function');
check('导航图标同 id 注册', iconRow?.options?.id === 'skin', iconRow?.options?.id);
check('设置行样式已注入', styles.some((element) => element.getAttribute('data-dsu') === 'skin-lab-settings'));

// 动效开关：默认开（没有属性），关掉后属性落到 html 上
check('动效默认开：html 上没有 data-dsu-motion', documentElement.getAttribute('data-dsu-motion') === null);
sandbox.window.__dsuSkinLab?.setMotion(false);
check('动效关掉：html 上有 data-dsu-motion', documentElement.getAttribute('data-dsu-motion') === 'off');
sandbox.window.__dsuSkinLab?.setMotion(true);
check('动效再打开：属性撤掉', documentElement.getAttribute('data-dsu-motion') === null);

if (typeof disposed === 'function') disposed();
check('cleanup 后 data-dsu-skin=null', documentElement.getAttribute('data-dsu-skin') === null);

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
