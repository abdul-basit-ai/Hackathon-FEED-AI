import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createApp } from './supabase/functions/_shared/feedintel/app.js';

try { process.loadEnvFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const app = createApp({ env: (name) => process.env[name] });
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');

const server = createServer(async (incoming, outgoing) => {
  try {
    const options = { method: incoming.method, headers: incoming.headers };
    if (!['GET', 'HEAD'].includes(incoming.method)) {
      options.body = Readable.toWeb(incoming);
      options.duplex = 'half';
    }
    const response = await app(new Request(new URL(incoming.url, `http://${host}:${port}`), options));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(await response.text());
  } catch {
    outgoing.writeHead(500, { 'Content-Type': 'application/json' });
    outgoing.end(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unable to process request.' } }));
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.on('error', (error) => { console.error(`Server failed to start (${error.code}). Check the port and permissions.`); process.exitCode = 1; });
server.listen(port, host, () => console.log(`FeedIntel backend: http://${host}:${port} (${process.env.FEEDINTEL_MODE || 'live'} mode)`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { server.close(); server.closeIdleConnections(); });
