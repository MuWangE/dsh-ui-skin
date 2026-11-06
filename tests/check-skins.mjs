/**
 * 多皮肤契约检查（M5「多皮肤」项，板块 B 的验收）。
 *
 * 在一个假 DOM 里同时加载两套皮肤（lab + plain），验证：
 *   1. 两套都在 hub 里登记，设置页能列出；
 *   2. 默认没选过 = 默认皮肤（lab）生效；
 *   3. 选中另一套 → 新的上色、旧的自撤（token 层、DOM 属性、皮肤锁）；
 *   4. **让位方不许删别人的属性**（hub 通知按注册顺序派发，这是顺序依赖 bug 的护栏）；
 *   5. 卸载一套 → hub 里只剩另一套。
 *
 * 两个包的 hub 实现是两份拷贝，这个测试也是唯一能把两份拷贝放在一起跑的地方。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = path.resolve(HERE, '..', 'packages');
const LAB = path.join(PKG_ROOT, 'dsh-ui-skin-lab', 'lib', 'client.js');
const PLAIN = path.join(PKG_ROOT, 'dsh-ui-skin-plain', 'lib', 'client.js');

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`, detail ?? '');
};

/** 造一套全新的沙箱，两个包共用（模拟同一个浏览器窗口）。 */
function makeSandbox() {
  const registrations = [];
  const attributes = new Map();
  const styles = [];
  const requests = [];
  const themeCalls = { lab: [], plain: [] };

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
        return {
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
      return Promise.resolve({ ok: true, text: async () => 'html[data-dsu-skin]{color:red}' });
    },
    Request: class {},
    URL,
    encodeURIComponent,
  };

  return { sandbox, registrations, attributes, styles, requests, themeCalls };
}

const fakeRequire = () => ({});

/** 给一套皮肤造 ctx；theme 服务记录 override/dispose，slots 直接不给（设置行跳过）。 */
function makeCtx(themeCalls, bucket) {
  return {
    logger: { info() {} },
    inject(deps, callback) {
      if (Array.isArray(deps) && deps.includes('theme')) {
        callback({
          theme: {
            overrideTokens(source, layer) {
              const record = { source, layer, disposed: false };
              themeCalls[bucket].push(record);
              return () => {
                record.disposed = true;
              };
            },
          },
          effect(cb) {
            return cb();
          },
        });
      }
      // slots 不给：设置行会走 skipped 分支，不影响皮肤本身。
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

async function loadPair(order) {
  const env = makeSandbox();
  vm.runInNewContext(fs.readFileSync(LAB, 'utf8'), env.sandbox, { filename: 'lab-client.js' });
  vm.runInNewContext(fs.readFileSync(PLAIN, 'utf8'), env.sandbox, { filename: 'plain-client.js' });

  const defs = Object.fromEntries(env.registrations.map((def) => [def.id, def]));
  const byId = {
    'dsh-ui-skin-lab': { def: defs['dsh-ui-skin-lab'], bucket: 'lab' },
    'dsh-ui-skin-plain': { def: defs['dsh-ui-skin-plain'], bucket: 'plain' },
  };
  const applied = {};
  for (const id of order) {
    const { def, bucket } = byId[id];
    applied[id] = def.factory(fakeRequire).apply(makeCtx(env.themeCalls, bucket));
    await flush();
  }
  return { ...env, applied, order };
}

// —— 场景一：lab 先加载（正常顺序） ——
{
  const env = await loadPair(['dsh-ui-skin-lab', 'dsh-ui-skin-plain']);
  const hub = env.sandbox.window.__dshSkinHub;
  const attr = () => env.attributes.get('data-dsu-skin') ?? null;

  check('两套皮肤都注册进 hub', hub?.list?.().length === 2, hub?.list?.().map((item) => item.id).join(','));
  check('hub 记录两套的 id', ['dsh-ui-skin-lab', 'dsh-ui-skin-plain'].every((id) => hub.list().some((item) => item.id === id)));
  check('默认没选过 = 默认皮肤（lab）', attr() === 'minimal', attr());

  hub.setActive('dsh-ui-skin-plain');
  await flush();
  check('切到素色：属性变成 plain', attr() === 'plain', attr());
  // 每次 syncTokens 都会整层替换，旧的 dispose 是 no-op —— 只看最后一次是否被撤。
  check('切到素色：lab 的 token 层已撤', env.themeCalls.lab.at(-1)?.disposed === true);
  check('切到素色：素色的 token 层已推', env.themeCalls.plain.at(-1)?.disposed === false);
  check('切到素色：lab 的组件样式已删', env.styles.filter((el) => el.getAttribute('data-dsu') === 'skin-lab').length === 0);

  hub.setActive('dsh-ui-skin-lab');
  await flush();
  check('切回 lab：属性回到预设值', attr() === 'minimal' || attr() === 'pixel', attr());
  check('切回 lab：素色的 token 层已撤', env.themeCalls.plain.at(-1)?.disposed === true);

  env.applied['dsh-ui-skin-plain']?.();
  await flush();
  check('卸载素色：hub 里只剩 lab', hub.list().length === 1 && hub.list()[0].id === 'dsh-ui-skin-lab', hub.list().map((item) => `${item.id}`).join(','));
}

// —— 场景二：plain 先加载（顺序反了，让位方会先被通知） ——
{
  const env = await loadPair(['dsh-ui-skin-plain', 'dsh-ui-skin-lab']);
  const hub = env.sandbox.window.__dshSkinHub;
  const attr = () => env.attributes.get('data-dsu-skin') ?? null;

  check('反序加载：默认仍是 lab', attr() === 'minimal', attr());
  hub.setActive('dsh-ui-skin-plain');
  await flush();
  // plain 先注册 → 先上色；lab 后让位。lab 若不看属性归属，会把 plain 刚打上的属性删掉。
  check('反序切换：让位方没删掉别人的属性', attr() === 'plain', attr());
  check('反序切换：plain 的 token 层在', env.themeCalls.plain.at(-1)?.disposed === false);
}

// —— 场景三：脏值 / 未知皮肤 ——
{
  const env = await loadPair(['dsh-ui-skin-lab', 'dsh-ui-skin-plain']);
  const hub = env.sandbox.window.__dshSkinHub;
  const attr = () => env.attributes.get('data-dsu-skin') ?? null;

  hub.setActive('nonexistent-skin');
  await flush();
  check('选中不存在的皮肤：没人上色（不猜）', attr() === null, attr());
  hub.setActive('dsh-ui-skin-lab');
  await flush();
  check('选回已知皮肤：恢复正常', attr() === 'minimal', attr());
}

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
