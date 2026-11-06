/**
 * 交互组件覆盖纪律检查（M5 补：气泡 / 按钮 / tab / 菜单 / 对话框）。
 *
 * 为什么要有这个测试：官方按钮高度只有 24px、tab 只有 25px。
 * 给它们加 `border` / `padding` / `margin` 会改变盒模型——页面上 268 个 button
 * 一起变，整版就歪了，而且这种回归肉眼很难归因。
 * 所以 tokens.css 第 4 节（交互组件形态）里的声明只允许「不参与布局」的属性。
 *
 * 2026-11-05 真机实测（pixel 皮肤，读计算样式）：
 *   气泡 40x42、输入区按钮 28x28、侧栏按钮 256x24、tab 26x25 —— 覆盖前后完全一致。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.resolve(HERE, '..', 'packages', 'dsh-ui-skin-lab');
const CSS = fs.readFileSync(path.join(PKG, 'tokens.css'), 'utf8');

let failures = 0;
function check(name, ok, detail) {
  if (ok) console.log(`PASS  ${name}`, detail ?? '');
  else {
    failures += 1;
    console.log(`FAIL  ${name}`, detail ?? '');
  }
}

/** 取出第 4 节（交互组件形态）的正文：从它所在注释的开头，到下一个 `5.` 标题注释的开头。 */
const START = '4. 交互组件形态';
const END = '5. 系统级动效降级';
const startAt = CSS.indexOf(START);
const endAt = CSS.indexOf(END);
check('tokens.css 有「交互组件形态」一节', startAt >= 0);
check('第 4 节在系统级降级之前（媒体查询要留最末）', startAt >= 0 && endAt > startAt);

// 从注释起点开始截，否则会留下半个注释让「去注释」失效。
const section =
  startAt >= 0 && endAt > startAt
    ? CSS.slice(Math.max(0, CSS.lastIndexOf('/*', startAt)), Math.max(0, CSS.lastIndexOf('/*', endAt)))
    : '';
const withoutComments = section.replace(/\/\*[\s\S]*?\*\//g, '');

// —— 1. 只允许不参与布局的声明（只看 `{}` 里面的，别把选择器里的 button:not() 当声明）——
const ALLOWED = new Set([
  'box-shadow',
  'outline',
  'outline-offset',
  'background',
  'background-color',
  'color',
  'border-radius',
  'opacity',
  'fill',
  'stroke',
  'transition',
]);
const bodies = [...withoutComments.matchAll(/\{([^{}]*)\}/g)].map((match) => match[1]);
const declarations = bodies.flatMap((body) => [...body.matchAll(/([a-z-]+)\s*:/g)].map((match) => match[1]));
const illegal = [...new Set(declarations.filter((name) => !ALLOWED.has(name)))];
check(
  '第 4 节没有占布局的声明（border/padding/margin/width/height）',
  illegal.length === 0,
  illegal.join(', '),
);

// —— 2. 关键锚点都在，且都带卸载前缀 ——
const selectors = [...withoutComments.matchAll(/([^{}]+)\{/g)]
  .map((match) => match[1].trim())
  .filter((selector) => selector !== '' && !selector.startsWith('@'));
const badPrefix = selectors.filter((selector) => !selector.startsWith('html[data-dsu-skin'));
check('第 4 节所有规则带 html[data-dsu-skin 前缀', badPrefix.length === 0, badPrefix.join(' | '));

const joined = selectors.join(' | ');
const required = [
  ['用户气泡', '[data-chat-flow-kind="user"] [class*="bubble"]'],
  ['输入区按钮集群', '[data-composer-card] button'],
  ['按钮悬停反馈', 'button:not([disabled]):hover'],
  ['tab', '[role="tab"]'],
  ['菜单', '[role="menu"]'],
  ['对话框', '[role="dialog"]'],
  ['菜单项', '[role="menuitem"]'],
];
for (const [label, needle] of required) {
  check(`覆盖了${label}`, joined.includes(needle));
}

// —— 3. 按钮不许全局常驻描边（实测 268 个一起加会让侧栏每个项变方框） ——
const globalButton = selectors.some(
  (selector) => /^html\[data-dsu-skin[^\]]*\]\s*button:not\(\[disabled\]\)\s*$/.test(selector),
);
check('按钮没有全局常驻描边（只在按钮集群里）', globalButton === false);

console.log(failures === 0 ? '全部通过' : `${failures} 项失败`);
process.exit(failures === 0 ? 0 : 1);
