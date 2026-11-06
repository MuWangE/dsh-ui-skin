/**
 * 选择器契约检查。
 *
 * 1. tokens.css 里每条规则必须以 html[data-dsu-skin] 或 html[data-dsu-degraded] 开头；
 *    这是「卸载后样式全失效」的保证。
 * 2. CSS 与 client.js 里出现的官方 data-* 属性，必须登记在 selectors.json。
 * 3. selectors.json 里 risk=high 的条目必须有 fallback。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..', 'packages', 'dsh-ui-skin-lab');
const CSS = fs.readFileSync(path.join(PKG, 'tokens.css'), 'utf8');
const CLIENT = fs.readFileSync(path.join(PKG, 'lib', 'client.js'), 'utf8');
const CONTRACT = JSON.parse(fs.readFileSync(path.join(PKG, 'selectors.json'), 'utf8'));

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`PASS  ${name}`, detail ?? '');
  else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail ?? '');
  }
}

const registered = new Set(CONTRACT.entries.map((entry) => entry.selector));

// —— 1. 前缀纪律 ——
const withoutComments = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)]
  .map((match) => match[1].trim())
  .filter((selector) => selector !== '' && !selector.startsWith('@'));

const badPrefix = selectors.filter(
  (selector) => !selector.startsWith('html[data-dsu-skin') && !selector.startsWith('html[data-dsu-degraded]'),
);
check('所有规则带 html[data-dsu-skin] 前缀', badPrefix.length === 0, badPrefix.join(' | '));

// —— 2. 官方 data-* 必须登记 ——
// 两头都去注释再扫：注释里举例写的 [data-xxx] 不是选择器，不该要求登记。
// （2026-11-05 踩了两次：tokens.css 注释一次、client.js 注释一次。）
const CLIENT_NO_COMMENTS = CLIENT.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const usedAttributes = new Set();
for (const source of [withoutComments, CLIENT_NO_COMMENTS]) {
  for (const match of source.matchAll(/\[(data-[a-z][a-z0-9-]*)/g)) {
    if (match[1].startsWith('data-dsu')) continue;
    usedAttributes.add(`[${match[1]}]`);
  }
}
const unregistered = [...usedAttributes].filter((selector) => !registered.has(selector));
check('官方选择器已登记', unregistered.length === 0, unregistered.join(', '));

// —— 3. 高风险条目必须有 fallback ——
const missingFallback = CONTRACT.entries.filter((entry) => entry.risk === 'high' && !entry.fallback);
check('高风险条目都有 fallback', missingFallback.length === 0, missingFallback.map((entry) => entry.id).join(', '));

// —— 4. client.js 的 querySelector 必须已登记 ——
const queried = [...CLIENT.matchAll(/querySelector\('([^']+)'\)/g)].map((match) => match[1]);
const unknownQueries = queried.filter((selector) => !registered.has(selector));
check('client 里的 querySelector 已登记', unknownQueries.length === 0, unknownQueries.join(', '));

// —— 5. 所有 !important 必须登记在 selectors.json 的 force 里 ——
// ARCHITECTURE §5.3 的红线：!important 只允许在登记条目里用。
// 判定：含 !important 的规则，每个选择器成分都要以某个 force 条目的 selector 开头，
// 且 reduce 媒体块内外的登记不能混用——否则将来有人写一句裸的
// `html[data-dsu-skin] { transition: none !important }`，会被 reduce 的前缀「顺带放行」。
const FORCE = CONTRACT.force ?? [];
const reducedBlock = (() => {
  const m = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/.exec(withoutComments);
  if (m === null) return null;
  const brace = m.index + m[0].length - 1;
  let depth = 0;
  for (let i = brace; i < withoutComments.length; i += 1) {
    if (withoutComments[i] === '{') depth += 1;
    else if (withoutComments[i] === '}') {
      depth -= 1;
      if (depth === 0) return { start: m.index, brace, end: i };
    }
  }
  return null;
})();

// 移除整个 @media 块时**连 `@media (...)` 前缀一起删**（start 取 m.index 而不是 `{`）。
// 只删 `{...}` 会留下 `@media (...)` 残骸，和后面的裸规则拼成一个以 `@media` 开头的
// 假选择器，被 `startsWith('@')` 跳过——2026-11-06 变异实测栽过一次。
const outside = reducedBlock === null
  ? withoutComments
  : withoutComments.slice(0, reducedBlock.start) + withoutComments.slice(reducedBlock.end + 1);
const inside = reducedBlock === null ? '' : withoutComments.slice(reducedBlock.brace + 1, reducedBlock.end);

const forceMismatch = [];
function scanForce(source, inReduced) {
  for (const m of source.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = m[1].trim();
    if (selector.startsWith('@') || !m[2].includes('!important')) continue;
    const parts = selector.split(',').map((s) => s.trim()).filter(Boolean);
    const ok = parts.every((part) => FORCE.some((entry) => {
      if ((entry.scope === 'reduced-motion') !== inReduced) return false;
      return part.startsWith(entry.selector);
    }));
    if (!ok) forceMismatch.push(`${selector}${inReduced ? '（@media reduce 内）' : ''}`);
  }
}
scanForce(outside, false);
scanForce(inside, true);
check('所有 !important 都在 force 登记里', forceMismatch.length === 0, forceMismatch.join(' | '));

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
