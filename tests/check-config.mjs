/**
 * 配置导出 / 导入 / 多套方案（E 板块验收：「导出再导入一致」）。
 *
 * 验证四件事：
 *   1. 导出的 JSON 结构合法（format / version / prefs）；
 *   2. **往返一致**：导出 → 清空存储 → 导入 → 再导出，两次 prefs 完全相同；
 *   3. 脏数据被拒：格式错 / 版本错 / 非 JSON 返回 false，非法字段整条跳过、绝不写进存储；
 *   4. 多套方案：存 / 列 / 套用 / 删。
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
    return Promise.resolve({ ok: true, text: async () => '' });
  },
  Request: class {},
  URL,
  encodeURIComponent,
  JSON,
  Date,
};

vm.runInNewContext(code, sandbox, { filename: 'client.js' });

let failures = 0;
const check = (name, ok, detail) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`, detail ?? '');
};

const definition = registrations[0];
const fakeRequire = () => ({});
const ctx = {
  logger: { info() {} },
  inject() {},
};
definition.factory(fakeRequire).apply(ctx);

const api = sandbox.window.__dsuSkinLab;
check('apply 后拿到 __dsuSkinLab', api !== undefined && api !== null);

// —— 1. 先设一组偏好，导出结构要反映它们 ——
sandbox.localStorage.setItem('dsh-ui-skin-lab.preset', 'pixel');
sandbox.localStorage.setItem('dsh-ui-skin-lab.brand', '#be185d');
sandbox.localStorage.setItem('dsh-ui-skin-lab.radius', 'square');
sandbox.localStorage.setItem('dsh-ui-skin-lab.motion', 'off');

const first = api.exportConfig('夜间');
check('导出 format 正确', first.format === 'dsh-ui-skin-lab.config', first.format);
check('导出 version 是数字', first.version === 1, String(first.version));
check('导出带 name', first.name === '夜间');
check('导出 prefs.preset 反映存储', first.prefs.preset === 'pixel', first.prefs.preset);
check('导出 prefs.brand 反映存储', first.prefs.brand === '#be185d', first.prefs.brand);
check('导出 prefs 不含 font（字号交给官方）', first.prefs.font === undefined, String(first.prefs.font));
check('导出 prefs.radius 反映存储', first.prefs.radius === 'square', first.prefs.radius);
check('导出 prefs.motion 反映存储', first.prefs.motion === false, String(first.prefs.motion));
check('导出 schemes 是数组', Array.isArray(first.schemes));

// —— 2. 往返一致：清空 → 导入 → 再导出 ——
const snapshot = JSON.stringify(first.prefs);
for (const key of [
  'dsh-ui-skin-lab.preset',
  'dsh-ui-skin-lab.brand',
  'dsh-ui-skin-lab.radius',
  'dsh-ui-skin-lab.motion',
]) {
  sandbox.localStorage.removeItem(key);
}
check('清空后 prefs 回默认', api.exportConfig().prefs.preset === 'minimal', api.exportConfig().prefs.preset);

const imported = api.importConfig(JSON.stringify(first));
check('导入返回 true', imported === true);
check('往返后 prefs 完全一致', JSON.stringify(api.exportConfig().prefs) === snapshot, api.exportConfig().prefs.preset);

// —— 3. 脏数据被拒 ——
check('非 JSON 返回 false', api.importConfig('{不是 json') === false);
check('缺 format 返回 false', api.importConfig({ version: 1, prefs: {} }) === false);
check('版本不对返回 false', api.importConfig({ format: 'dsh-ui-skin-lab.config', version: 99, prefs: {} }) === false);
check('缺 prefs 返回 false', api.importConfig({ format: 'dsh-ui-skin-lab.config', version: 1 }) === false);

const beforeDirty = JSON.stringify(api.exportConfig().prefs);
api.importConfig({
  format: 'dsh-ui-skin-lab.config',
  version: 1,
  prefs: { brand: 'red', font: '12em', radius: 'huge', preset: 'nope' },
});
check('非法字段不写进存储', JSON.stringify(api.exportConfig().prefs) === beforeDirty, api.exportConfig().prefs.brand);

// —— 4. 多套方案 ——
check('存方案成功', api.saveScheme('夜间') === true);
check('方案出现在列表里', api.schemes.some((item) => item.name === '夜间'), JSON.stringify(api.schemes.map((s) => s.name)));
check('空名字被拒', api.saveScheme('   ') === false);

const schemeBefore = JSON.stringify(api.schemes.find((item) => item.name === '夜间').prefs);
sandbox.localStorage.setItem('dsh-ui-skin-lab.brand', '#15803d');
check('改设置后 prefs 变了', api.exportConfig().prefs.brand === '#15803d');
check('套用方案成功', api.applyScheme('夜间') === true);
check('套用后回到方案里的值', api.exportConfig().prefs.brand === JSON.parse(schemeBefore).brand, api.exportConfig().prefs.brand);
check('套用不存在的方案返回 false', api.applyScheme('没有这个') === false);
check('删方案成功', api.deleteScheme('夜间') === true);
check('删完列表空了', api.schemes.length === 0, String(api.schemes.length));

// —— 5. 导入会整体替换方案列表（契约，不是 bug：配置文件是完整快照） ——
api.saveScheme('甲');
api.saveScheme('乙');
check('存了两套方案', api.schemes.length === 2, String(api.schemes.length));
api.importConfig({
  format: 'dsh-ui-skin-lab.config',
  version: 1,
  prefs: { preset: 'pixel' },
  schemes: [{ name: '只此一套', prefs: {} }],
});
check('导入后方案被整体替换', api.schemes.length === 1 && api.schemes[0].name === '只此一套', JSON.stringify(api.schemes.map((s) => s.name)));

api.saveScheme('丁');
api.importConfig({ format: 'dsh-ui-skin-lab.config', version: 1, prefs: {} });
check('导入不带 schemes 时保留本地方案', api.schemes.some((item) => item.name === '丁'), JSON.stringify(api.schemes.map((s) => s.name)));

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
