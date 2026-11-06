/**
 * 动效契约检查（M5「动效」项）。
 *
 * DESIGN §6 承诺了两件事：
 *   1. 皮肤内有「停用动效」手动开关（data-dsu-motion="off"）；
 *   2. 系统 `prefers-reduced-motion: reduce` 时自动降级为 0。
 * 第 2 条长期只在文档里、代码里没有——这个测试把它钉住。
 *
 * 另外一条结构约束：
 *   - 降级规则同样必须以 html[data-dsu-skin 开头（卸载保证）。
 *
 * 前缀这条 check-selectors 也会查（2026-11-05 变异验证实测：把块内
 * 选择器改成裸 `*`，它的「所有规则带前缀」会红）。这里再断一次，是
 * 因为动效契约值得独立成文件——哪天 check-selectors 的切法变了，
 * 这条还在。两个来源对得上，不是重复劳动。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..', 'packages', 'dsh-ui-skin-lab');
const CSS = fs.readFileSync(path.join(PKG, 'tokens.css'), 'utf8');
const CLIENT = fs.readFileSync(path.join(PKG, 'lib', 'client.js'), 'utf8');

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`PASS  ${name}`, detail ?? '');
  else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail ?? '');
  }
}

const CSS_NO_COMMENTS = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
const REDUCED = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)\s*\{/;

// —— 1. 系统级降级规则存在 ——
const match = REDUCED.exec(CSS_NO_COMMENTS);
check('有 prefers-reduced-motion: reduce 降级块', match !== null);

let block = '';
if (match !== null) {
  const open = match.index + match[0].length - 1; // 指向 `{`
  let depth = 0;
  for (let i = open; i < CSS_NO_COMMENTS.length; i += 1) {
    const ch = CSS_NO_COMMENTS[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        block = CSS_NO_COMMENTS.slice(open + 1, i);
        break;
      }
    }
  }
}

// —— 2. 三条压制齐全 ——
check('降级块里有 transition', /transition\s*:\s*none\s*!important/.test(block));
check('降级块里有 animation', /animation\s*:\s*none\s*!important/.test(block));
check('降级块里有 scroll-behavior', /scroll-behavior\s*:\s*auto\s*!important/.test(block));

// —— 3. 块内每条规则都以 html[data-dsu-skin 开头 ——
const innerSelectors = [...block.matchAll(/([^{}]+)\{/g)]
  .map((m) => m[1].trim())
  .filter((s) => s !== '' && !s.startsWith('@'));
const badInner = innerSelectors.filter((s) => !s.startsWith('html[data-dsu-skin'));
check('降级块内规则带卸载前缀', innerSelectors.length > 0 && badInner.length === 0, badInner.join(' | '));

// —— 4. 手动开关仍在（两种降级并存，不是相互替代） ——
check('手动停用动效规则仍在', /html\[data-dsu-skin\]\[data-dsu-motion="off"\]/.test(CSS_NO_COMMENTS));

// —— 5. client.js 侧：syncMotion 是函数声明，且 apply/停用/清理都调 ——
check('syncMotion 是函数声明（不是 const，避免 TDZ）', /function syncMotion\s*\(/.test(CLIENT));
const motionCalls = (CLIENT.match(/syncMotion\(\)/g) ?? []).length;
check('syncMotion 调用点 ≥ 4（apply / enable / disable / cleanup）', motionCalls >= 4, `${motionCalls} 处`);

// —— 6. pixel 硬切（DESIGN §6 承诺的 0ms） ——
// 多选择器列表的特征：`html[data-dsu-skin="pixel"],` 后面还有选择器。
// 单条 pixel 组件规则（如 [data-slot="sidebar"]）是 `{` 直接跟着，不会命中。
const pixelHard = /html\[data-dsu-skin="pixel"\],[^{]*\{([^}]*)\}/.exec(CSS_NO_COMMENTS);
check('有 pixel 硬切规则', pixelHard !== null);
if (pixelHard !== null) {
  const body = pixelHard[1];
  check('pixel 硬切压了 transition', /transition\s*:\s*none\s*!important/.test(body));
  check('pixel 硬切压了 scroll-behavior', /scroll-behavior\s*:\s*auto\s*!important/.test(body));
  // 反向断言：不许压 animation。官方 _spin / 状态点 / 骨架屏 / 打字点都是「进行中」信号，
  // 压掉等于让界面看起来卡死，是功能损失。变异验证：加一行 animation: none 立刻红。
  check('pixel 硬切没有压 animation（保留进行中动画）', !/animation\s*:\s*none/.test(body));
}

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
