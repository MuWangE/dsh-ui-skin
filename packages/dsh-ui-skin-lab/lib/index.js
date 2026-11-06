/**
 * `dsh-ui-skin-lab` — Host half.
 *
 * 唯一的职责：把 tokens.css（组件级覆盖）以只读路由发给浏览器。
 * 这里不写任何视觉逻辑——token 值在 lib/client.js 的 PRESET_TOKENS，
 * 组件结构在 tokens.css。Host 改动没有热重载，要生效得禁用再启用插件。
 */

import { appendFile, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = path.join(ROOT, 'tokens.css');
const MANIFEST = path.join(ROOT, 'skin.json');
const ROUTE = '/dsu-skin';
/** 诊断日志：浏览器有没有来取 CSS / 探活。排查「装了但没生效」用。 */
const DEBUG_LOG = path.join(ROOT, 'debug.log');

/** 日志上限：超过就清空重来，长期运行不至于把磁盘写满。 */
const MAX_LOG_BYTES = 1024 * 1024;

async function note(line) {
  try {
    const info = await stat(DEBUG_LOG).catch(() => null);
    if (info !== null && info.size > MAX_LOG_BYTES) {
      await writeFile(DEBUG_LOG, '', 'utf8');
    }
    await appendFile(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`, 'utf8');
  } catch {
    /* 记不下就算了 */
  }
}

export const name = 'dsh-ui-skin-lab';
export const inject = ['webServer', 'connection', 'clientModules'];

export function apply(ctx) {
  // 诊断：本包有没有进浏览器的启动图（client-modules 的扫描结果）。
  try {
    const clientPath = ctx.clientModules.clientPath('dsh-ui-skin-lab');
    void note(`boot clientPath=${clientPath ?? 'MISSING'}`);
    const graph = ctx.clientModules.graph();
    const ids = Array.isArray(graph?.entries) ? graph.entries.map((entry) => entry.id) : [];
    void note(`graph-ids(${ids.length})=${ids.join(',')}`);
    const batches = Array.isArray(graph?.batches)
      ? graph.batches.map((batch) => `${batch.phase}:${(batch.entries ?? []).length}`)
      : [];
    const mine = (graph?.batches ?? []).some((batch) => (batch.entries ?? []).includes('dsh-ui-skin-lab'));
    void note(`batches=${batches.join('|')} mine-in-batch=${mine}`);

    // bundle 本身能不能被 /plugins 提供？这是页面加载它的前提。
    void (async () => {
      try {
        const row = (graph?.entries ?? []).find((entry) => entry.id === 'dsh-ui-skin-lab');
        if (row === undefined) {
          await note('bundle row missing');
          return;
        }
        const response = await ctx.clientModules.fetchBundle(new Request(new URL(row.url, 'http://localhost')));
        const text = await response.text();
        await note(`bundle status=${response.status} len=${text.length} head=${text.slice(0, 48).replace(/\s+/g, ' ')}`);
      } catch (error) {
        await note(`bundle error=${String(error?.message ?? error)}`);
      }
    })();
  } catch (error) {
    void note(`boot error=${String(error?.message ?? error)}`);
  }
  // 皮肤清单（skin.json）：启动时读一遍，缺字段就在日志里喊出来。
  // 这是「清单不是死文件」的证明——Host 是唯一能读包内文件的一侧，浏览器拿不到。
  void (async () => {
    try {
      const manifest = JSON.parse(await readFile(MANIFEST, 'utf8'));
      const required = ['id', 'name', 'tagline', 'tags', 'accent', 'bodyAttr', 'package', 'dshCompatibility'];
      const missing = required.filter((key) => manifest[key] === undefined);
      if (missing.length > 0) {
        await note(`manifest missing=${missing.join(',')}`);
        return;
      }
      await note(`manifest ok id=${manifest.id} attr=${manifest.bodyAttr} v=${manifest.dshCompatibility}`);
    } catch (error) {
      await note(`manifest err=${String(error?.message ?? error)}`);
    }
  })();

  ctx.effect(() =>
    ctx.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: async (req, res) => {
        // 先过 DSH 的同源校验，别成为开放代理（官方资源路由的通行做法）。
        const connection = ctx.connection;
        if (connection !== undefined && connection !== null && typeof connection.requestRejection === 'function') {
          const rejection = connection.requestRejection(req);
          if (rejection !== undefined) {
            res.statusCode = rejection;
            res.end();
            return;
          }
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
          res.writeHead(405, { Allow: 'GET, HEAD' }).end();
          return;
        }

        const pathname = new URL(req.url ?? '/', 'http://localhost').pathname;
        void note(`${req.method} ${req.url}`);
        if (pathname === `${ROUTE}/ping`) {
          res.writeHead(204).end();
          return;
        }
        if (pathname !== `${ROUTE}/tokens.css`) {
          res.writeHead(404).end();
          return;
        }

        let body;
        try {
          body = await readFile(TOKENS, 'utf8');
        } catch {
          res.writeHead(404).end();
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/css; charset=utf-8',
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(req.method === 'HEAD' ? undefined : body);
      },
    }),
  );
}
