/**
 * 结构基线检查（F 板块「官方 DOM 变了要报警，别静默失效」）。
 *
 * 三件事：
 *   1. 登记表完整性：每条选择器有 expect（present / conditional / pseudo）；
 *   2. 单一来源：client.js 里跑探针的 STRUCT_ANCHORS，必须和 selectors.json
 *      里 expect=present|conditional 的条目**完全一致**（防止两份清单漂移）；
 *   3. 真机基线：读 debug.log 里最近一次 `struct=` 回传，present 的锚点命中 0
 *      就判失败（官方结构变了，CSS 会静默失效）。
 *
 * 没有回传时 SKIP 而不是失败——树莓/无网络环境也能跑，只是不知道现场。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..', 'packages', 'dsh-ui-skin-lab');
const CONTRACT = JSON.parse(fs.readFileSync(path.join(PKG, 'selectors.json'), 'utf8'));
const CLIENT = fs.readFileSync(path.join(PKG, 'lib', 'client.js'), 'utf8');
const LOG_PATH = path.join(PKG, 'debug.log');

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`PASS  ${name}`, detail ?? '');
  else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail ?? '');
  }
}

// —— 1. 登记表完整性 ——
const VALID_EXPECT = new Set(['present', 'conditional', 'pseudo']);
const badExpect = CONTRACT.entries.filter((entry) => !VALID_EXPECT.has(entry.expect));
check('每条登记都有合法的 expect', badExpect.length === 0, badExpect.map((e) => e.id).join(', '));
check(
  'present 条目都有 baselineHits 记录',
  CONTRACT.entries.filter((e) => e.expect === 'present').every((e) => typeof e.baselineHits === 'number'),
);

// —— 2. 两份清单必须一致 ——
const match = /const STRUCT_ANCHORS = \[([\s\S]*?)\];/.exec(CLIENT);
check('client.js 里有 STRUCT_ANCHORS 探针清单', match !== null);
const anchors = match
  ? [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1].replace(/\\"/g, '"').replace(/\\'/g, "'"))
  : [];
const expected = CONTRACT.entries
  .filter((entry) => entry.expect === 'present' || entry.expect === 'conditional')
  .map((entry) => entry.selector);
const missingInClient = expected.filter((selector) => !anchors.includes(selector));
const extraInClient = anchors.filter((selector) => !expected.includes(selector));
check('探针清单没漏登记条目', missingInClient.length === 0, missingInClient.join(' | '));
check('探针清单没有登记表外的条目', extraInClient.length === 0, extraInClient.join(' | '));

// —— 3. 真机基线 ——
if (!fs.existsSync(LOG_PATH)) {
  console.log('SKIP  没有 debug.log，先开着 DSH 跑一次再验');
  console.log(failures === 0 ? '全部通过（跳过真机基线）' : `${failures} 项失败`);
  process.exit(failures === 0 ? 0 : 1);
}

const lines = fs.readFileSync(LOG_PATH, 'utf8').split('\n').reverse();
const line = lines.find((row) => row.includes('?struct='));
if (line === undefined) {
  console.log('SKIP  debug.log 里没有 struct 回传（DSH 没在这个页面启动过？）');
  console.log(failures === 0 ? '全部通过（跳过真机基线）' : `${failures} 项失败`);
  process.exit(failures === 0 ? 0 : 1);
}

let counts = null;
try {
  const raw = line.slice(line.indexOf('?struct=') + '?struct='.length).trim();
  counts = JSON.parse(decodeURIComponent(raw));
} catch (error) {
  check('能解析 struct 回传', false, String(error?.message ?? error));
}

if (counts !== null) {
  const stamp = line.slice(0, 24);
  console.log(`      基线来自 ${stamp} 的回传`);
  const broken = [];
  for (const entry of CONTRACT.entries) {
    if (entry.expect === 'pseudo') continue;
    const hits = counts[entry.selector];
    if (hits === undefined) {
      broken.push(`${entry.id}（回传里没有）`);
      continue;
    }
    if (entry.expect === 'present' && hits < 1) {
      broken.push(`${entry.id} ${entry.selector} 命中 0（基线 ${entry.baselineHits}）`);
    }
  }
  check('present 锚点全部还在', broken.length === 0, broken.join(' | '));

  const drift = CONTRACT.entries
    .filter((entry) => entry.expect === 'present' && typeof entry.baselineHits === 'number')
    .filter((entry) => counts[entry.selector] !== undefined && counts[entry.selector] !== entry.baselineHits)
    .map((entry) => `${entry.id} ${entry.baselineHits}→${counts[entry.selector]}`);
  if (drift.length > 0) console.log(`      数量变化（内容相关，不算失败）：${drift.join(', ')}`);

  const conditionalHit = CONTRACT.entries
    .filter((entry) => entry.expect === 'conditional' && (counts[entry.selector] ?? 0) > 0)
    .map((entry) => `${entry.id}=${counts[entry.selector]}`);
  if (conditionalHit.length > 0) console.log(`      条件性锚点这次命中：${conditionalHit.join(', ')}`);
}

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
