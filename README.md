# FeedIntel backend

Backend implementation of Plan B for the initial MVP: Competitor Spy, Trend Detector, calculated KPIs, AI interpretation, video evidence, structured reports, and saved history. The frontend and PDF rendering belong to the separate Lovable project.

There are no runtime npm dependencies. Node.js 22.16+ is required. Shared standard-Web-API JavaScript also runs in the Supabase Edge Function.

Intelligence is selectable: use an existing OpenAI API project, Claude API access, or your Lovable project's managed AI connector. See [Lovable intelligence setup and ready-to-paste prompt](docs/lovable-intelligence.md). `POST /analyze` accepts optional `intelligence_provider: "openai" | "claude" | "lovable"`; `GET /intelligence-options` exposes configuration availability to the authenticated frontend. Omitting the field uses `INTELLIGENCE_PROVIDER` (default `openai`). Lovable-managed AI requires deploying a bridge in your existing Lovable project; that remote setup is not done by the local code.

## Run locally, without credentials

Run these commands from this folder:

```sh
npm run setup:demo
npm test
npm run smoke
npm start
```

- `npm run setup:demo` creates an ignored `.env` from `.env.example`, generating a random local demo token. It never overwrites an existing `.env`. The token is not printed. This is a local access token, not a provider API key.
- `npm test` runs automated backend tests using Node's built-in test runner.
- `npm run smoke` starts a separate local server on port 3107, exercises both skills through real HTTP requests, and stops it. It uses a temporary in-memory token and does not need `.env` or real providers. Set `SMOKE_PORT` if that port is occupied.
- `npm start` starts the backend at `http://127.0.0.1:3000`. Stop it with Ctrl+C.
- `npm run dev` starts the server with automatic restarts after file changes.
- `npm run check:node` retains the original `test.mjs` check.
- `npm run check:live` checks the configured Supabase connection and table, performs small real Oriane searches, and makes one paid OpenAI analysis request. It prints status/counts only and leaves the selected mode unchanged. Use it after configuring live credentials and credits; it does not apply migrations or save an analysis.

Demo mode returns clearly labeled **fictional** fixtures, not real videos or AI findings. Its example.com links are placeholders. History is held in memory, resets on restart, and retains the latest 100 analyses. Live mode never falls back to demo mode.

To make a local request without printing or putting your demo token in command history:

```sh
node --env-file=.env --input-type=module -e '
const response = await fetch("http://127.0.0.1:3000/analyze", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.DEMO_ACCESS_TOKEN}`
  },
  body: JSON.stringify({
    skill: "competitor_spy", query: "Nike", compare_with: "Adidas",
    period_days: 90, max_videos: 40
  })
});
console.log(response.status, await response.json());
'
```

This command loads the ignored environment file, calls your running server, and prints the response. Switch to `skill: "trend_detector"`, set `query` to your topic, and set `compare_with: null` for topic analysis.

## Live configuration and Supabase setup

1. Create a Supabase project in your own account. In Authentication settings, disable public signup and anonymous sign-ins. Manually create a restricted demo account. This uses existing Supabase Auth rather than implementing user management.
2. Run the migration `supabase/migrations/202611070001_feedintel.sql` once in the Supabase SQL editor. It creates private tables and service-role-only functions. Alternatively use `supabase db push` after linking with the Supabase CLI. Database changes require a configured project; the repository does not create an account or provision a remote project automatically.
3. Configure the environment variables below privately in `.env` for local live development, or in the Supabase Edge Function Secrets dashboard for deployment. Never paste their values into source code, chat, or frontend settings. `.env.example` contains names only, with blank credentials.
4. Set `ORIANE_AUTH_HEADER=Authorization` and `ORIANE_AUTH_TEMPLATE=Bearer {key}`. This format was verified against the official endpoint on 2026-11-07 using the locally configured account. The public OpenAPI schema omits security declarations; this confirmation comes from a successful live request, not a documented security declaration. The backend substitutes the server-side key.
5. Test a real Oriane query and inspect fields before declaring the live acceptance test complete. The implemented search contract comes from the public schema, but credentials, entitlement, real records, and permalink availability must be verified with your account.

| Variable | Purpose |
| --- | --- |
| `FEEDINTEL_MODE` | `live` for real providers; default is live |
| `SUPABASE_URL` | Your project's HTTPS URL |
| `SB_SECRET_KEY` | Server-only Supabase secret key; legacy `SUPABASE_SERVICE_ROLE_KEY` also supported |
| `DEMO_USER_IDS` | Comma-separated UUIDs of approved Supabase demo users |
| `ORIANE_API_KEY` | Server-only Oriane credential |
| `ORIANE_AUTH_HEADER` | Authentication header name confirmed from your account |
| `ORIANE_AUTH_TEMPLATE` | Confirmed header value format with `{key}` placeholder |
| `INTELLIGENCE_PROVIDER` | Default: `openai`, `claude`, or `lovable` |
| `OPENAI_API_KEY` | Server-only credential, required only for direct OpenAI |
| `OPENAI_MODEL` | Structured-output Responses model; defaults to `gpt-4o-mini` |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Direct Claude credential and a structured-output model available to your account |
| `LOVABLE_ANALYSIS_URL`, `LOVABLE_BRIDGE_TOKEN` | Your deployed Lovable AI bridge URL and a private shared service token |
| `ALLOWED_ORIGINS` | Comma-separated exact frontend origins, no wildcard or trailing slash |

The key itself remains only in the ignored local environment file. A live one-video connector check successfully normalized a source record and calculated KPIs. Original-link availability, OpenAI analysis, and Supabase persistence still require separate verification.

If using the Supabase CLI (install separately), the deployment commands are:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy feedintel
```

`login` authenticates your CLI, `link` chooses the project, `db push` applies the migration, and `functions deploy` uploads the shared code and Edge entry point. Use the dashboard to enter secrets privately; Supabase supplies its project URL automatically. Do not run `db push` again if you applied the SQL manually without reconciling migration history.

The Edge function's gateway JWT check is disabled in `config.toml` because the application itself verifies the bearer session with Supabase Auth and checks `DEMO_USER_IDS`. This does **not** make analysis or history public. Only `/health` and allowed-origin preflight requests are unauthenticated. No automatic user creation or login UI is included.

The three core tables have RLS enabled with no browser access policies. Owner filtering happens in service-only RPCs. Quota state also lives in the database, so the limit of five analyses per user per minute works across Edge instances. All attempts that reach the pipeline consume quota, including failed provider calls. Local demo mode has an equivalent memory quota. Each instance processes at most two analyses simultaneously. Configure additional account-level provider spend caps as appropriate; these MVP limits are not a billing system.

## API contract

Local base URL: `http://127.0.0.1:3000`.

Deployed base URL: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/feedintel`.

| Method and path | Behavior |
| --- | --- |
| `GET /health` | Process health and selected mode; does not probe providers |
| `GET /intelligence-options` | Authenticated provider choices and configuration availability |
| `POST /analyze` | Validate, retrieve, normalize, calculate, interpret, persist, return |
| `GET /analyses/:id` | Retrieve an owned completed result without rerunning |
| `GET /analyses?limit=20&offset=0` | List owned history, newest first |

Protected routes require `Authorization: Bearer <session-access-token>`. In live mode use the approved account's Supabase session token. In local demo mode use the generated local token. Provider keys and Supabase server keys are never client credentials.

Request:

```json
{
  "skill": "competitor_spy",
  "query": "Nike",
  "compare_with": "Adidas",
  "period_days": 90,
  "max_videos": 40
}
```

`query` and competitor names are 1–200 characters. Distinct competitors are required for Competitor Spy. Trend Detector requires `compare_with: null` or omission. Period is 1–365 days, default 90. Maximum sample is 1–50 videos (minimum two for comparisons), default 40, **total across both competitors**. Odd budgets allocate one extra result to the first brand. Unknown fields are rejected. JSON bodies are limited to 16 KB.

Both skills return exactly these top-level fields: `analysis_id`, `skill`, `status`, `kpis`, `charts`, `insights`, `videos`, `report`, `limitations`, `generated_at`. See `docs/feedintelApi.ts` for the complete typed contract. Additional nested metrics include mean/median views, metric coverage, engagement per view, brand metrics, top videos, and themes by brand. IDs are UUIDs, not the illustrative `demo-001` in the initial plan. Dates use ISO UTC.

Errors use `{ "error": { "code": "...", "message": "...", "request_id": "..." } }`. Relevant statuses: 400 invalid input/JSON, 401 missing/invalid session, 403 forbidden account/origin, 404 missing route/owned result, 405 wrong method, 413 oversized body, 415 wrong content type, 422 empty results/refusal, 429 quota/concurrency, 502 provider/database failure, 503 missing configuration/auth unavailable. Raw upstream error bodies and credentials are never returned. An analysis is returned as completed only after successful transactional persistence. Failed attempts are not included in completed history.

## Calculation and evidence rules

- Overall counts deduplicate by platform + provider ID. A video matching both brand searches appears once overall and in each matching brand sample; results disclose the overlap.
- A metric total is `null` if any included record is missing that metric. Known zero remains zero. Mean/median views use the known-view subset; `views_sample_size` and `metric_coverage` explain coverage.
- Engagement per view = `(likes + comments + shares) / views × 100`, only when all required totals exist and views are positive. It is not follower engagement rate.
- Publication charts use Monday-based UTC calendar weeks, including zero-count weeks. Boundary weeks may be partial. They do not measure engagement growth.
- The search currently matches caption OR transcript text, restricted to video format and the requested publication interval. It is **not** visual-only discovery or an exhaustive brand audit. At most three provider pages per term are scanned, with at most 20 records per page.
- Full-projection records are normalized from documented Oriane fields. Invalid dates, unsupported formats, and records without usable platform identifiers are excluded. TikTok and YouTube links are derived from platform IDs and handles; Instagram numeric IDs are encoded to shortcode permalinks. Derived links may be unavailable, deleted, or private and require live verification.
- The model sees bounded captions, transcripts, visual captions, computed metrics, and internal UUIDs. Untrusted source text is marked as data. Structured output is validated; unknown evidence IDs fail the request. This checks references, not the truth of every interpretation. Human review remains necessary.
- Themes list source IDs; the backend calculates their frequencies. Themes may overlap. The model is instructed not to claim emerging trends, causation, or historical engagement growth from snapshots.
- Canonical source rows are deduplicated across analyses. Each saved result keeps its immutable video/metric snapshot. `analysis_videos.evidence_id` maps its original evidence IDs to canonical database video UUIDs.

## Connect Lovable

Copy `docs/feedintelApi.ts` into your frontend's services folder and create the service using your existing Supabase client:

```ts
const api = createFeedIntelApi(
  'https://YOUR_PROJECT_REF.supabase.co/functions/v1/feedintel',
  async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
);
const result = await api.analyze(formValues);
```

Only your project URL and publishable Supabase client key belong in frontend configuration. Use the approved demo account session; never embed an account password, local demo token, Oriane/OpenAI key, or Supabase secret/service-role key into a published frontend. Add the exact Lovable origin to `ALLOWED_ORIGINS` before calling the backend. Render missing metrics as “Unavailable”, display limitations, and build PDF content from the returned `report`, metrics, charts, insights, and evidence. PDF rendering remains frontend work.

## Verification and remaining live acceptance

`npm test` exercises both skills with fixtures and mocked provider HTTP, including arithmetic, evidence, validation, auth, ownership, paging, and failure handling. `npm run smoke` exercises the actual Node HTTP server with fictional fixtures. Neither claims to validate a paid provider.

Real acceptance still requires configured accounts and credentials: a successful Oriane search, computed KPI, actual OpenAI insight, verified original video URL, saved Supabase result, and retrieval by ID. The migration must also be exercised against your Supabase project and the Edge Function deployed/tested. No remote project, secrets, or deployment are provisioned by the local tests.

Live setup check on 2026-11-07: Oriane authentication, real retrieval, normalization, and KPI calculation passed. Supabase accepted the configured server key, but its Data API reported the analyses table missing (`PGRST205`). OpenAI returned HTTP 429 with `credit_balance_exhausted`; add project credits/check billing limits before retrying. The backend reports credit/quota exhaustion as `503 OPENAI_CREDITS_EXHAUSTED`. The approved demo user's UUID is also still required in `DEMO_USER_IDS`. No live AI result or database persistence has been verified.

Documentation consulted:

- [Oriane API schema and endpoint definitions](https://connect.oriane.xyz/rest/docs)
- [OpenAI Structured Outputs with Responses](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
- [Supabase Edge Function environment variables](https://supabase.com/docs/guides/functions/secrets)
