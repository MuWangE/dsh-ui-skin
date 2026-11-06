/**
 * token 契约检查：每个预设 × 浅/深，14 个官方 token 必须齐全，且只能用官方存在过的名字。
 *
 * 数据来源：
 *   packages/dsh-ui-skin-lab/lib/client.js 里的 PRESET_TOKENS 常量 —— 皮肤提供的值
 *   tests/official-tokens.json               —— 官方主题层定义过的 token 名（2026-11-05 从
 *                                               @deepseek-ai/dsh-client-ui-theme/lib/client.js 抽取）
 *
 * 为什么值放在 client.js 而不放单独的 JSON：Host 侧 index.js 没有热重载（改代码要禁用再启用），
 * 而 token 值会频繁调整——放进 client.js 才能跟 HMR 一起即时生效。
 *
 * 为什么要拦名字：ctx.theme.overrideTokens 不校验 token 名，拼错的变量会被静默写入
 * body 内联样式，但没有任何规则消费它 —— 页面看起来「什么都没发生」，很难查。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..', 'packages', 'dsh-ui-skin-lab');

/** 从 client.js 里把 PRESET_TOKENS 字面量读出来（它是唯一真源）。 */
function loadPresetTokens() {
  const client = fs.readFileSync(path.join(PKG, 'lib', 'client.js'), 'utf8');
  const match = client.match(/const PRESET_TOKENS = (\{[\s\S]*?\n {6}\});/);
  if (match === null) return null;
  return new Function(`return ${match[1]}`)();
}

/** 同样把两套预设共用的派生规则读出来（var/color-mix 表达式）。 */
function loadSharedTokens() {
  const client = fs.readFileSync(path.join(PKG, 'lib', 'client.js'), 'utf8');
  const match = client.match(/const SHARED_TOKENS = (\{[\s\S]*?\n {6}\});/);
  if (match === null) return null;
  return new Function(`return ${match[1]}`)();
}

const DATA = { presets: loadPresetTokens() };
const SHARED = loadSharedTokens();
const OFFICIAL = new Set(JSON.parse(fs.readFileSync(path.join(HERE, 'official-tokens.json'), 'utf8')).tokens);

/** 14 个必须被皮肤接管的语义 token（cordis_inspect_query → client/Theme.listTokens）。 */
const REQUIRED_TOKENS = [
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-idle-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
];

const PRESETS = ['minimal', 'pixel'];

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`PASS  ${name}`, detail ?? '');
  else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail ?? '');
  }
}

check('tokens.json 有 presets 表', typeof DATA.presets === 'object' && DATA.presets !== null);

for (const preset of PRESETS) {
  const entry = DATA.presets?.[preset];
  check(`${preset} 预设存在`, entry !== undefined);
  if (entry === undefined) continue;

  const light = entry.light ?? null;
  const dark = entry.dark ?? null;
  check(`${preset}/light 变量块存在`, light !== null);
  check(`${preset}/dark 变量块存在`, dark !== null);
  if (light === null || dark === null) continue;

  for (const [mode, block] of [
    ['light', light],
    ['dark', dark],
  ]) {
    const missing = REQUIRED_TOKENS.filter((token) => !(token in block));
    check(`${preset}/${mode} 14 个 token 齐全`, missing.length === 0, missing.join(', '));

    const empty = Object.entries(block)
      .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
      .map(([name]) => name);
    check(`${preset}/${mode} 没有空值`, empty.length === 0, empty.join(', '));

    const unknown = Object.keys(block).filter((token) => !OFFICIAL.has(token));
    check(`${preset}/${mode} token 名都在官方白名单里`, unknown.length === 0, unknown.join(', '));
  }

  const lightKeys = Object.keys(light);
  const darkKeys = Object.keys(dark);
  const consistent = lightKeys.length === darkKeys.length && lightKeys.every((key) => darkKeys.includes(key));
  check(`${preset} light/dark 键一致`, consistent, consistent ? '' : `light ${lightKeys.length} / dark ${darkKeys.length}`);

  const shape = ['--dsw-radius-md', '--dsw-radius-panel', '--dsw-font-family'];
  const missingShape = shape.filter((token) => !(token in light));
  check(`${preset} 形态变量齐全`, missingShape.length === 0, missingShape.join(', '));
}

// 共用派生规则也要校验：名字白名单 + 没有空值。
check('SHARED_TOKENS 存在', SHARED !== null);
if (SHARED !== null) {
  const unknownShared = Object.keys(SHARED).filter((token) => !OFFICIAL.has(token));
  check('SHARED_TOKENS token 名都在官方白名单里', unknownShared.length === 0, unknownShared.join(', '));

  const emptyShared = Object.entries(SHARED)
    .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
    .map(([name]) => name);
  check('SHARED_TOKENS 没有空值', emptyShared.length === 0, emptyShared.join(', '));

  const badShape = Object.entries(SHARED)
    .filter(([, value]) => !value.includes('var(') && !value.includes('color-mix(') && value !== 'transparent')
    .map(([name]) => name);
  check('SHARED_TOKENS 都是派生表达式或 transparent', badShape.length === 0, badShape.join(', '));

  check('SHARED_TOKENS 有实质内容（≥ 30 条）', Object.keys(SHARED).length >= 30, `${Object.keys(SHARED).length} 条`);
}

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
