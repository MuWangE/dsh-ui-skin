/**
 * 对比度检查（WCAG 2.1）：正文/次要文字 ≥ 4.5:1，品牌色 ≥ 3:1。
 * 数据来源：packages/dsh-ui-skin-lab/lib/client.js 的 PRESET_TOKENS（token 层唯一真源）。
 * 眼睛会骗人，脚本不会。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..', 'packages', 'dsh-ui-skin-lab');

function loadPresetTokens() {
  const client = fs.readFileSync(path.join(PKG, 'lib', 'client.js'), 'utf8');
  const match = client.match(/const PRESET_TOKENS = (\{[\s\S]*?\n {6}\});/);
  if (match === null) return null;
  return new Function(`return ${match[1]}`)();
}

const DATA = { presets: loadPresetTokens() };

const PRESETS = ['minimal', 'pixel'];

function hexToRgb(hex) {
  const value = String(hex).trim().replace('#', '');
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
}

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

let failures = 0;
function check(name, ratio, minimum) {
  const ok = ratio >= minimum;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`, `${ratio.toFixed(2)}:1（要求 ≥ ${minimum}）`);
}

for (const preset of PRESETS) {
  for (const mode of ['light', 'dark']) {
    const block = DATA.presets?.[preset]?.[mode];
    if (block === undefined) {
      console.log(`FAIL  ${preset}/${mode} 变量块缺失`);
      failures += 1;
      continue;
    }

    const bg = hexToRgb(block['--dsw-alias-bg-base']);
    const sidebar = hexToRgb(block['--dsw-specific-sidebar-fill']);
    const label = hexToRgb(block['--dsw-alias-label-primary']);
    const secondary = hexToRgb(block['--dsw-alias-label-secondary']);
    const brand = hexToRgb(block['--dsw-alias-brand-primary']);
    // 浮层层（陪看面板这类）上的文字要跟层底色比，不是跟 bg-base 比。
    // 派生表达式（var / color-mix）读不出十六进制就跳过，那类由 check-tokens 管。
    const layer2 = hexToRgb(block['--dsw-alias-bg-layer-2'] ?? '');
    const layer3 = hexToRgb(block['--dsw-alias-bg-layer-3'] ?? '');

    const unparsable = [
      ['bg-base', bg],
      ['sidebar-fill', sidebar],
      ['label-primary', label],
      ['label-secondary', secondary],
      ['brand-primary', brand],
    ]
      .filter(([, rgb]) => rgb === null)
      .map(([name]) => name);
    if (unparsable.length > 0) {
      console.log(`FAIL  ${preset}/${mode} 颜色不是十六进制`, unparsable.join(', '));
      failures += 1;
      continue;
    }

    check(`${preset}/${mode} 正文对比度`, contrast(label, bg), 4.5);
    check(`${preset}/${mode} 次要文字对比度`, contrast(secondary, bg), 4.5);
    check(`${preset}/${mode} 品牌色对比度`, contrast(brand, bg), 3);
    check(`${preset}/${mode} 侧栏正文对比度`, contrast(label, sidebar), 4.5);
    // 这两条原先在 check-sense-contrast.mjs 里（跨包读陪看的 CSS）。2026-11-06 拆包时
    // 内化成通用组合：任何消费方把次要文字浮在层 2 / 层 3 上都必须够读，不再依赖具体插件。
    if (layer2 === null) console.log(`SKIP  ${preset}/${mode} layer-2 不是硬色值`);
    else check(`${preset}/${mode} 次要文字在层 2 上`, contrast(secondary, layer2), 4.5);
    if (layer3 === null) console.log(`SKIP  ${preset}/${mode} layer-3 不是硬色值`);
    else check(`${preset}/${mode} 次要文字在层 3 上`, contrast(secondary, layer3), 4.5);
  }
}

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
