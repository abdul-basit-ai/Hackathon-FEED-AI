import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const template = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
try {
  await writeFile(new URL('../.env', import.meta.url), template.replace('DEMO_ACCESS_TOKEN=', `DEMO_ACCESS_TOKEN=${randomBytes(32).toString('hex')}`), { flag: 'wx', mode: 0o600 });
  console.log('Created ignored .env with a random local demo token. No external API keys are needed for demo mode.');
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
  console.log('.env already exists; left it unchanged.');
}
