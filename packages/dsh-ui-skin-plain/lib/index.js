/**
 * `dsh-ui-skin-plain` — Host half。
 *
 * 什么都不提供：没有资源路由、没有组件级 CSS、没有诊断日志。
 * 视觉全部走 `lib/client.js` 的 overrideTokens（两个品牌 token）。
 * 留着这个入口只是为了让包符合 DSH bundle 的最小形状。
 *
 * 唯一的动作：启动时读一遍 `skin.json` 并打一条日志——清单要有人消费，
 * 否则就是躺着的死文件。浏览器侧拿不到包内文件，只有 Host 能读。
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'skin.json');

export const name = 'dsh-ui-skin-plain';

export function apply(ctx) {
  ctx.logger?.info?.('dsh-ui-skin-plain: 素色基准皮肤已加载');
  void (async () => {
    try {
      const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
      const required = ['id', 'name', 'tagline', 'tags', 'accent', 'bodyAttr', 'package', 'dshCompatibility'];
      const missing = required.filter((key) => manifest[key] === undefined);
      if (missing.length > 0) {
        ctx.logger?.warn?.(`dsh-ui-skin-plain: manifest missing=${missing.join(',')}`);
        return;
      }
      ctx.logger?.info?.(`dsh-ui-skin-plain: manifest ok id=${manifest.id} attr=${manifest.bodyAttr}`);
    } catch (error) {
      ctx.logger?.warn?.(`dsh-ui-skin-plain: manifest 读不到 ${String(error?.message ?? error)}`);
    }
  })();
}
