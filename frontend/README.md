# FeedIntel frontend

The FeedIntel web app: Competitor Spy, Trend Detector, evidence-backed reports with print/PDF output, and analysis history. Built with TanStack Start, React Query, Tailwind, shadcn-style components, and Recharts.

This UI was created in [Lovable](https://lovable.dev) ([Lovable editor](https://lovable.dev/projects/71604730-a5ca-4927-90cf-d5c6bb9eba35)) and integrated here with the FeedIntel backend in the repository root. Read `AGENTS.md` before editing.

## Run locally

Requires Node.js 22.16+ and npm. From this `frontend/` folder:

```sh
cp .env.example .env.local   # then fill in the public values below
npm ci
npm run dev
```

Or from the repository root: `npm run dev:ui` (serves `http://127.0.0.1:5173`).

| Command | Purpose |
| --- | --- |
| `npm ci` | Install the exact versions in `package-lock.json` |
| `npm run dev` | Development server with hot reload |
| `npm test` | Adapter, auth, and routing tests (Vitest) |
| `npm run typecheck` | TypeScript check without emitting files |
| `npm run build` | Production build into `.output/` |

Use npm and `package-lock.json` consistently. The original Lovable export used Bun; switching between package managers can install different versions.

## Configuration

Settings go in the ignored `.env.local` locally, or in the hosting provider's environment settings. Every `VITE_*` value is compiled into the public browser bundle, so **only public values belong here**. Never add the Oriane, OpenAI, or Anthropic keys, the Supabase secret/service-role key, or any account password.

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL, e.g. `https://neubatybcqqhrcqqssqp.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **publishable** (anon) client key |
| `VITE_FEEDINTEL_API_URL` | Backend base URL; defaults to `https://neubatybcqqhrcqqssqp.supabase.co/functions/v1/feedintel` |
| `VITE_FEEDINTEL_MODE` | Leave unset for the live backend. Set to `demo` only for an offline UI with fictional sample data |

In live mode, users sign in with an approved Supabase account (there is no signup page). The session token is sent to the backend, which runs all provider calls server-side. If the backend fails, the UI shows the backend's error message. It never substitutes fictional data.

## Deploying

The UI lives in the `frontend/` subfolder of this repository, so configure the host with:

- **Root directory:** `frontend`
- **Install command:** `npm ci`
- **Build command:** `npm run build`
- **Environment:** the public `VITE_*` values above

The build uses Nitro with Cloudflare as its default target (`.output/` plus a generated `wrangler.json`).

Before the deployed site can call the backend, add its exact origin (for example `https://your-app.lovable.app`, no trailing slash, no wildcard) to the backend's `ALLOWED_ORIGINS` Edge Function secret. Otherwise the browser blocks requests with a CORS error.
