/**
 * M5 皮肤互斥的契约测试。
 *
 * 覆盖四件事：
 *   1. 无冲突时照常上色；
 *   2. 协议锁（window.__dshSkinLock.owner 是别人）时让位；
 *   3. 已知皮肤标记（data-dsh-maid-atelier）在 html / body 上时让位；
 *   4. 开关：停用后不留任何痕迹，重新启用能把皮肤装回来。
 *
 * 每个场景都新建一套假 DOM —— client.js 的 apply 有大量模块级状态，
 * 复用同一个 sandbox 会把上一个场景的样式/请求带进来，测不出真东西。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const code = fs.readFileSync(path.join(HERE, '..', 'packages', 'dsh-ui-skin-lab', 'lib', 'client.js'), 'utf8');

/** 造一个新的沙箱。参数决定「别人是否已经占了地盘」。 */
function makeSandbox({ lockOwner = null, maidOnHtml = false, maidOnBody = false, enabledFlag = null } = {}) {
  const attributes = new Map();
  const bodyAttributes = new Map();
  const styles = [];
  const requests = [];
  const tokenCalls = [];

  const makeElement = (tag) => ({
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
  });

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
    hasAttribute(name) {
      return attributes.has(name);
    },
  };

  if (maidOnHtml) attributes.set('data-dsh-maid-atelier', '');

  const body = {
    hasAttribute(name) {
      return bodyAttributes.has(name);
    },
  };
  if (maidOnBody) bodyAttributes.set('data-dsh-maid-atelier', '');

  const localStorageData = new Map();
  if (enabledFlag !== null) localStorageData.set('dsh-ui-skin-lab.enabled', enabledFlag);

  const windowObject = {
    __ModuleLoader__: { load() {} },
    addEventListener() {},
    removeEventListener() {},
    setTimeout() {
      return 1;
    },
    clearTimeout() {},
  };
  if (lockOwner !== null) windowObject.__dshSkinLock = { owner: lockOwner, since: 1 };

  const sandbox = {
    console,
    window: windowObject,
    document: {
      documentElement,
      body,
      readyState: 'complete',
      createElement: makeElement,
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
      getItem(key) {
        return localStorageData.get(key) ?? null;
      },
      setItem(key, value) {
        localStorageData.set(key, value);
      },
      removeItem(key) {
        localStorageData.delete(key);
      },
    },
    fetch(url) {
      requests.push(String(url));
      return Promise.resolve({ ok: true, text: async () => 'html[data-dsu-skin]{--x:1}' });
    },
    Request: class {},
    URL,
    encodeURIComponent,
  };

  return { sandbox, attributes, styles, requests, tokenCalls };
}

/** 跑一遍 apply，返回 ctx 和清理函数。 */
async function mount(sandbox, tokenCalls) {
  const registration = { id: null };
  sandbox.window.__ModuleLoader__.load = (definition) => {
    registration.id = definition.id;
    registration.definition = definition;
  };
  // 重新执行一次，拿到 factory（上面的 runInNewContext 已经跑过，注册被 load 捕获）。
  vm.runInNewContext(code, sandbox, { filename: 'client.js' });

  const { definition } = registration;
  const fakeRequire = (id) => {
    if (id === 'react') return { createElement: () => ({}) };
    if (id === '@deepseek-ai/dsh-client-store') {
      return { defineStore: (spec) => ({ init: spec.init, actions: spec.actions }) };
    }
    return {};
  };
  const ctx = {
    logger: { info() {} },
    inject(deps, callback) {
      if (deps.includes('theme')) {
        callback({
          theme: {
            overrideTokens(source, layer) {
              tokenCalls.push({ source, layer });
              return () => {};
            },
          },
          effect() {},
        });
      }
      if (deps.includes('slots')) {
        callback({
          slots: {
            inject(name, fn) {
              fn();
            },
            register() {
              return () => {};
            },
          },
        });
      }
    },
  };
  const dispose = definition.factory(fakeRequire).apply(ctx);
  // fetch 是异步的，等两轮微任务/宏任务让 then 跑完
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  return dispose;
}

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

// —— 场景 1：无冲突 ——
{
  const box = makeSandbox();
  await mount(box.sandbox, box.tokenCalls);
  const skin = box.sandbox.window.__dsuSkinLab;
  check('无冲突：打上 data-dsu-skin', box.attributes.get('data-dsu-skin') === 'minimal', String(box.attributes.get('data-dsu-skin')));
  check('无冲突：推了 token', box.tokenCalls.length === 1);
  check('无冲突：注入了 tokens.css', box.styles.some((s) => s.getAttribute('data-dsu') === 'skin-lab'));
  check('无冲突：状态=运行中', skin?.status?.() === '运行中', skin?.status?.());
  check('无冲突：登记了皮肤锁', box.sandbox.window.__dshSkinLock?.owner === 'dsh-ui-skin-lab');
}

// —— 场景 2：协议锁被 maid 占着 ——
{
  const box = makeSandbox({ lockOwner: 'maid-atelier' });
  await mount(box.sandbox, box.tokenCalls);
  const skin = box.sandbox.window.__dsuSkinLab;
  check('协议锁：不打 data-dsu-skin', (box.attributes.get('data-dsu-skin') ?? null) === null);
  check('协议锁：不推 token', box.tokenCalls.length === 0);
  check('协议锁：不注入 tokens.css', !box.styles.some((s) => s.getAttribute('data-dsu') === 'skin-lab'));
  check('协议锁：状态说明被谁接管', String(skin?.status?.()).includes('maid-atelier'), skin?.status?.());
  check('协议锁：不抢锁', box.sandbox.window.__dshSkinLock?.owner === 'maid-atelier');
  check('协议锁：enable() 返回 false', skin?.enable?.() === false);
}

// —— 场景 3：html 上有已知皮肤标记 ——
{
  const box = makeSandbox({ maidOnHtml: true });
  await mount(box.sandbox, box.tokenCalls);
  check('特征标记(html)：不打 data-dsu-skin', (box.attributes.get('data-dsu-skin') ?? null) === null);
  check('特征标记(html)：不推 token', box.tokenCalls.length === 0);
}

// —— 场景 4：body 上有已知皮肤标记 ——
{
  const box = makeSandbox({ maidOnBody: true });
  await mount(box.sandbox, box.tokenCalls);
  check('特征标记(body)：不打 data-dsu-skin', (box.attributes.get('data-dsu-skin') ?? null) === null);
}

// —— 场景 5：开关存了 off ——
{
  const box = makeSandbox({ enabledFlag: 'off' });
  await mount(box.sandbox, box.tokenCalls);
  const skin = box.sandbox.window.__dsuSkinLab;
  check('开关关闭：不打 data-dsu-skin', (box.attributes.get('data-dsu-skin') ?? null) === null);
  check('开关关闭：不推 token', box.tokenCalls.length === 0);
  check('开关关闭：状态=已手动停用', skin?.status?.() === '已手动停用', skin?.status?.());
  // 重新启用
  check('开关关闭：enable() 返回 true', skin?.enable?.() === true);
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  check('开关关闭：启用后打上属性', box.attributes.get('data-dsu-skin') === 'minimal');
  check('开关关闭：启用后推 token', box.tokenCalls.length === 1);
  check('开关关闭：启用后注入 CSS', box.styles.some((s) => s.getAttribute('data-dsu') === 'skin-lab'));
}

// —— 场景 6：运行中停用，痕迹要清干净 ——
{
  const box = makeSandbox();
  await mount(box.sandbox, box.tokenCalls);
  const skin = box.sandbox.window.__dsuSkinLab;
  skin.disable?.();
  check('停用：属性撤掉', (box.attributes.get('data-dsu-skin') ?? null) === null);
  check('停用：样式删掉', !box.styles.some((s) => s.getAttribute('data-dsu') === 'skin-lab'));
  check('停用：交还皮肤锁', box.sandbox.window.__dshSkinLock === undefined);
  check('停用：状态=已手动停用', skin?.status?.() === '已手动停用', skin?.status?.());
  check('停用：设置行样式还在（否则没法再打开）', box.styles.some((s) => s.getAttribute('data-dsu') === 'skin-lab-settings'));
}

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
