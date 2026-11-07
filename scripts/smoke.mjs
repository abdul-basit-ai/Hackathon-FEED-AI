import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';

// A separate process exercises the real Node HTTP adapter, not just the handler.
const token = randomBytes(32).toString('hex');
const port = process.env.SMOKE_PORT || '3107';
const child = spawn(process.execPath, ['server.js'], {
  cwd: new URL('../', import.meta.url),
  env: { ...process.env, HOST: '127.0.0.1', PORT: port, FEEDINTEL_MODE: 'demo', DEMO_ACCESS_TOKEN: token },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let stderr = '';
child.stderr.on('data', (data) => { stderr += data; });
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server startup timed out.')), 10000);
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); reject(new Error(`Server exited (${code}): ${stderr}`)); });
    child.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
  });
  const base = `http://127.0.0.1:${port}`;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/analyses`)).status, 401);
  for (const skill of ['competitor_spy', 'trend_detector']) {
    const response = await fetch(`${base}/analyze`, {
      method: 'POST', headers,
      body: JSON.stringify({ skill, query: 'Nike', compare_with: skill === 'competitor_spy' ? 'Adidas' : null, period_days: 90, max_videos: 6 }),
    });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.kpis.videos, 6);
    assert.equal(result.insights.length, 3);
    const saved = await fetch(`${base}/analyses/${result.analysis_id}`, { headers });
    assert.deepEqual(await saved.json(), result);
    console.log(`PASS ${skill}: HTTP analysis, KPIs, evidence, and saved retrieval`);
  }
  const history = await fetch(`${base}/analyses`, { headers });
  assert.equal((await history.json()).analyses.length, 2);
  console.log('PASS health, unauthorized access, and history listing');
  console.log('Demo HTTP smoke test passed. No external providers were called.');
} finally {
  if (child.exitCode === null) {
    await new Promise((resolve) => {
      child.once('exit', resolve);
      child.kill('SIGTERM');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      timer.unref();
    });
  }
}
