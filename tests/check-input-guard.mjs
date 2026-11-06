/**
 * 输入守卫：localStorage 里的脏值不能被写成 token。
 *
 * 这些值来自浏览器存储，可能是旧版本残留、手改、或者别的插件写错键。
 * 一旦写进 overrideTokens，所有正文/按钮颜色会跟着废掉——而且没有报错，
 * 表现是「页面看起来怪怪的」。
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

const code = fs.readFileSync(path.join(HERE, '..', 'packages', 'dsh-ui-skin-lab', 'lib', 'client.js'), 'utf8');

function makeSandbox(store) {
  const attributes = new Map();
  const data = new Map(Object.entries(store));
  let definition = null;

  const sandbox = {
    console,
    window: {
      __ModuleLoader__: { load: (d) => (definition = d) },
      addEventListener() {},
      removeEventListener() {},
      setTimeout: () => 1,
      clearTimeout() {},
    },
    document: {
      documentElement: {
        setAttribute: (n, v) => attributes.set(n, v),
        removeAttribute: (n) => attributes.delete(n),
        getAttribute: (n) => attributes.get(n) ?? null,
        hasAttribute: (n) => attributes.has(n),
      },
      body: { hasAttribute: () => false },
      readyState: 'complete',
      createElement: () => ({ setAttribute() {}, getAttribute: () => null, remove() {} }),
      head: { appendChild() {} },
      querySelector: () => ({}),
      querySelectorAll: () => [],
    },
    localStorage: {
      getItem: (k) => data.get(k) ?? null,
      setItem: (k, v) => data.set(k, v),
      removeItem: (k) => data.delete(k),
    },
    fetch: () => Promise.resolve({ ok: true, text: async () => '' }),
    Request: class {},
    URL,
    encodeURIComponent,
  };
  vm.runInNewContext(code, sandbox, { filename: 'client.js' });
  return { sandbox, attributes, definition };
}

async function run(store) {
  const box = makeSandbox(store);
  const ctx = {
    logger: { info() {} },
    inject(deps, callback) {
      if (deps.includes('theme')) {
        callback({
          theme: {
            overrideTokens(source, layer) {
              box.sandbox.__layer = layer;
              return () => {};
            },
          },
          effect() {},
        });
      }
      if (deps.includes('slots')) callback({ slots: { inject: (n, fn) => fn(), register: () => () => {} } });
    },
  };
  const fakeRequire = (id) => {
    if (id === 'react') return { createElement: () => ({}) };
    if (id === '@deepseek-ai/dsh-client-store') return { defineStore: (s) => ({ init: s.init, actions: s.actions }) };
    return {};
  };
  box.definition.factory(fakeRequire).apply(ctx);
  await new Promise((r) => setImmediate(r));
  return box;
}

let failures = 0;
const check = (name, ok, detail = '') => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

// —— 脏主色 ——
{
  const box = await run({ 'dsh-ui-skin-lab.brand': 'red' });
  const layer = box.sandbox.__layer;
  check('脏主色（"red"）被忽略', layer?.['--dsw-alias-brand-primary']?.light === '#3b6ef5', layer?.['--dsw-alias-brand-primary']?.light);
}

// —— 字号：2026-11-06 起交给官方「通用 → 字体大小」，旧键不再被读 ——
{
  const box = await run({ 'dsh-ui-skin-lab.font': '12em' });
  check('旧字号键不再进 token 层（交给官方）', box.sandbox.__layer?.['--dsh-content-font-size'] === undefined);
}

// —— 脏圆角 ——
{
  const box = await run({ 'dsh-ui-skin-lab.radius': 'huge' });
  check('脏圆角被忽略（保持预设 16px）', box.sandbox.__layer?.['--dsw-radius-xl']?.light === '16px', box.sandbox.__layer?.['--dsw-radius-xl']?.light);
}

// —— 脏预设 ——
{
  const box = await run({ 'dsh-ui-skin-lab.preset': 'nonexistent' });
  check('脏预设回退到 minimal', box.attributes.get('data-dsu-skin') === 'minimal', box.attributes.get('data-dsu-skin'));
}

// —— 脏动效开关 ——
{
  const box = await run({ 'dsh-ui-skin-lab.motion': 'maybe' });
  // 注意 Map.get 不存在时返回 undefined，不是 null（这个坑踩过两次）
  check('脏动效值不当作关闭', (box.attributes.get('data-dsu-motion') ?? null) === null, box.attributes.get('data-dsu-motion'));
}

// —— 合法值仍然生效（确认不是一律忽略）——
{
  const box = await run({ 'dsh-ui-skin-lab.brand': '#aa2211' });
  check('合法主色生效', box.sandbox.__layer?.['--dsw-alias-brand-primary']?.light === '#aa2211');
}

// —— 入口校验：readBrand 管「读」，applyBrand 管「写」，两边都要挡（2026-11-05 补）——
// 为什么补：做变异验证时发现，把 applyBrand 的格式校验删掉，这个测试**仍然全绿**——
// 说明之前只测了「读脏值」，没测「写脏值」。写入路径同样是攻击面（控制台 / 导入配置）。
{
  const box = await run({});
  const api = box.sandbox.window.__dsuSkinLab;
  check('setBrand 拒绝 "red"', api.setBrand('red') === false);
  check('setBrand 拒绝后存储没被污染', box.sandbox.localStorage.getItem('dsh-ui-skin-lab.brand') === null);
  check('setBrand 接受合法值', api.setBrand('#aa2211') === true);
  check('setRadius 拒绝 "huge"', api.setRadius('huge') === false);
  check('setRadius 拒绝后存储没被污染', box.sandbox.localStorage.getItem('dsh-ui-skin-lab.radius') === null);
}

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
