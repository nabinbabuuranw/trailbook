// Local harness: runs the same Worker (api/src/worker.ts) over a SQLite database (node:sqlite, the engine under D1),
// and serves dist/site as the ASSETS binding. For browser checks only. Usage: node tools/local-server.ts [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleRequest, type Env } from '../api/src/worker.ts';
import { createNodeD1 } from '../api/test/d1-node.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'site');
const port = Number(process.argv[2] || 8791);
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json', '.txt': 'text/plain',
};

const env: Env = {
  DB: createNodeD1(),
  ASSETS: {
    async fetch(req: Request) {
      const u = new URL(req.url);
      const p = path.join(root, decodeURIComponent(u.pathname));
      if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) return new Response('not found', { status: 404 });
      return new Response(fs.readFileSync(p), { status: 200, headers: { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' } });
    },
  },
};

http.createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const url = `http://localhost:${port}${req.url || '/'}`;
  const init: RequestInit = { method: req.method, headers };
  if (chunks.length && req.method !== 'GET' && req.method !== 'HEAD') init.body = Buffer.concat(chunks);
  const out = await handleRequest(new Request(url, init), env, new Date());
  res.statusCode = out.status;
  out.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await out.arrayBuffer()));
}).listen(port, () => console.log(`trailbook local on http://localhost:${port}`));
