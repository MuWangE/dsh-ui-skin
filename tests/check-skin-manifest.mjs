/**
 * 皮肤清单（skin.json）一致性检查（板块 B 原始产出物）。
 *
 * UI-PROJECT §1.4 定义的清单字段：id / 名称 / 作者 / tagline / 标签 / accent /
 * bodyAttr / 兼容版本 / 预览图 / 桌面图标。这份测试保证清单**和代码是同一个人说的**：
 *
 *   1. 字段齐、类型对；
 *   2. `package` 与 package.json 的 name 一致；
 *   3. `wiring.id` 与 cordis.patch.yml 里 insert 的 id 一致；
 *   4. `id` 与 client.js 里实际注册到 hub 的皮肤 id 一致；
 *   5. `bodyAttr` 与 tokens.css 用的属性前缀一致；
 *   6. `files` 里必须包含 skin.json（不然打包丢文件）；
 *   7. **写了 preview / desktopIcon 就必须有那个文件**——不写不存在的路径。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PACKAGES = ['dsh-ui-skin-lab', 'dsh-ui-skin-plain'];

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`PASS  ${name}`, detail ?? '');
  else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail ?? '');
  }
}

const REQUIRED = ['id', 'name', 'tagline', 'tags', 'accent', 'bodyAttr', 'package', 'dshCompatibility', 'wiring'];

for (const pkgName of PACKAGES) {
  const dir = path.join(ROOT, 'packages', pkgName);
  const manifestPath = path.join(dir, 'skin.json');

  if (!fs.existsSync(manifestPath)) {
    check(`${pkgName} 有 skin.json`, false);
    continue;
  }

  let manifest = null;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    check(`${pkgName} skin.json 是合法 JSON`, false, String(error?.message ?? error));
    continue;
  }

  const missing = REQUIRED.filter((key) => manifest[key] === undefined);
  check(`${pkgName} 必填字段齐`, missing.length === 0, missing.join(', '));
  check(`${pkgName} tags 是数组且有内容`, Array.isArray(manifest.tags) && manifest.tags.length > 0);
  check(`${pkgName} accent 是 6 位 hex`, /^#[0-9a-f]{6}$/i.test(String(manifest.accent ?? '')), manifest.accent);

  const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  check(`${pkgName} package 字段与 package.json name 一致`, manifest.package === pkg.name, `${manifest.package} vs ${pkg.name}`);
  check(`${pkgName} files 里包含 skin.json`, Array.isArray(pkg.files) && pkg.files.includes('skin.json'));

  // 兼容声明必须和 peerDependencies 是同一个人说的——两份区间漂移了，
  // 装的时候 pnpm 看一份、DSH 看另一份，谁也发现不了不一致。
  const peerRange = pkg.peerDependencies?.['@deepseek-ai/dsh'] ?? null;
  check(
    `${pkgName} dshCompatibility 与 peerDependencies 一致`,
    manifest.dshCompatibility === peerRange,
    `${manifest.dshCompatibility} vs ${peerRange}`,
  );
  check(
    `${pkgName} dshCompatibility 是合法 semver range`,
    /^[><=~^]*\s*\d+\.\d+\.\d+(-[0-9a-z.-]+)?(\s+[><=~^]*\s*\d+\.\d+\.\d+(-[0-9a-z.-]+)?)?$/i.test(
      String(manifest.dshCompatibility ?? ''),
    ),
    manifest.dshCompatibility,
  );

  // wiring.id 对 cordis.patch.yml
  const yml = fs.readFileSync(path.join(dir, 'cordis.patch.yml'), 'utf8');
  const ymlId = /id:\s*([a-z0-9-]+)/.exec(yml)?.[1] ?? null;
  check(`${pkgName} wiring.id 与 cordis.patch.yml 一致`, manifest.wiring?.id === ymlId, `${manifest.wiring?.id} vs ${ymlId}`);

  // id 对 client.js 里注册到 hub 的那个
  const client = fs.readFileSync(path.join(dir, 'lib', 'client.js'), 'utf8');
  const clientId =
    /const SKIN_ID = '([^']+)'/.exec(client)?.[1] ??
    /const DEFAULT_SKIN = '([^']+)'/.exec(client)?.[1] ??
    null;
  check(`${pkgName} id 与 client.js 注册的皮肤 id 一致`, manifest.id === clientId, `${manifest.id} vs ${clientId}`);

  // bodyAttr 对 tokens.css 前缀（只有 lab 有组件级 CSS）
  const tokensPath = path.join(dir, 'tokens.css');
  if (fs.existsSync(tokensPath)) {
    const tokens = fs.readFileSync(tokensPath, 'utf8');
    check(
      `${pkgName} bodyAttr 与 tokens.css 前缀一致`,
      tokens.includes(`html[${manifest.bodyAttr}`),
      `html[${manifest.bodyAttr}`,
    );
  }

  // 写了就必须有文件
  if (manifest.preview !== undefined) {
    for (const [mode, relative] of Object.entries(manifest.preview)) {
      check(`${pkgName} preview.${mode} 文件存在`, fs.existsSync(path.join(dir, relative)), relative);
    }
  }
  if (manifest.desktopIcon !== undefined) {
    check(`${pkgName} desktopIcon 文件存在`, fs.existsSync(path.join(dir, manifest.desktopIcon)), manifest.desktopIcon);
  }
}

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
