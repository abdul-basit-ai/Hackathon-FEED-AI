import { createApp } from '../_shared/feedintel/app.js';

Deno.serve(createApp({ env: (name: string) => Deno.env.get(name) }));
