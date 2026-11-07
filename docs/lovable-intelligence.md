# Choose intelligence inside the Lovable app

FeedIntel supports three choices without changing its report/evidence contract:

| Choice | Access and billing | Server configuration |
| --- | --- | --- |
| Lovable-managed AI | Your project's built-in AI connector and Lovable credits | `LOVABLE_ANALYSIS_URL`, `LOVABLE_BRIDGE_TOKEN` |
| OpenAI API | Existing OpenAI API project | `OPENAI_API_KEY`, optional `OPENAI_MODEL` |
| Claude API | Existing Anthropic API project | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` |

Set `INTELLIGENCE_PROVIDER` to the default (`openai`, `claude`, or `lovable`). A request may override it with `intelligence_provider`. Old requests without that field continue to work. Only the selected provider's credentials are required. There is no automatic fallback that changes billing or the selected model behind the user's back.

`GET /intelligence-options` is protected like history and returns the default plus each option's `configured` boolean. That boolean checks presence/format of server configuration, **not** credit balance, model access, or connection health. In demo mode, all selections still produce fictional fixtures, and `report.intelligence.provider` is `demo`. In live mode that field records the selected route; history parameters also retain it. It identifies the integration, not a guarantee of a particular managed model version.

The backend does not accept API keys, model names, or endpoint URLs in frontend requests. Use existing provider access by configuring credentials once in server secrets. Browser users select an integration; this is not per-user key storage or a chat-subscription login flow.

## Lovable-managed integration

Lovable can generate a secure backend model call using its AI connector; it manages the project credential. This repository does not assume an undocumented public gateway URL or ask you to export its managed key. Instead it calls **your own** Lovable-hosted bridge. The bridge is a small internal integration endpoint with the contract below, not an official Lovable API endpoint.

1. Ask Lovable to enable its built-in AI connector in the existing project. Pick a supported text model available to that project/workspace. Current documentation restricts Claude to newer TanStack Start projects; older React + Vite projects need another supported model or an upgrade.
2. Have Lovable generate the bridge with its supported backend model-call mechanism. Protect it with a random shared `LOVABLE_BRIDGE_TOKEN`, stored only in the two backend secret stores. Never expose that token in a browser or use a user's Supabase session as this service token.
3. Set `LOVABLE_ANALYSIS_URL` in FeedIntel to the bridge's HTTPS URL. It must have no embedded credentials, query string, or fragment. If the bridge is a Supabase Edge Function, configure its gateway so the handler can verify the service token itself; do not accidentally require a user JWT before this service-token check runs.
4. Set `INTELLIGENCE_PROVIDER=lovable` to make it the default, or send `intelligence_provider: "lovable"` on a particular analysis. No `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is required on that route.
5. Verify with a real request after deployment. The bridge adapter is tested with simulated HTTP here; your Lovable project has not been modified or deployed from this repository.

Lovable AI requires its own enabled access and available credits. It does not inherit the balance of the separately configured OpenAI API project.

### Bridge request

FeedIntel sends an authenticated POST, with a 60-second timeout and redirects disabled:

```text
Authorization: Bearer <shared server token>
Content-Type: application/json
```

JSON contains:

- `instructions`: evidence-grounded analysis instructions.
- `data`: `{ request, computed_metrics, charts, videos }`.
- `output_schema`: the strict schema exported as `analysisSchema` in `supabase/functions/_shared/feedintel/providers.js`.

Keep the exact supplied video UUIDs. Ask the model for structured JSON matching the schema. Captions/transcripts/query text are data, not instructions. Numeric metrics are already computed. The bridge should enforce its own body limit (1 MB is sufficient for this MVP's bounded inputs), timeouts, and authenticated access.

### Bridge response

Return a plain JSON object with no markdown fence or extra response wrapper:

```ts
{
  executive_summary: string;
  recommendations: string[];
  insights: {
    title: string;
    explanation: string;
    evidence_video_ids: string[];
  }[];
  themes: { label: string; video_ids: string[] }[];
}
```

Require 3–5 insights, each supported by a nonempty list of supplied video IDs, and no more than 12 themes. Return a non-2xx error when AI generation fails; never send invented findings as a fallback. FeedIntel validates this output and evidence IDs again before saving anything.

## Prompt to paste into the existing Lovable project

```text
Add an “Intelligence” selector to the FeedIntel Competitor Spy and Trend Detector forms.
Use the shared feedintelApi.ts service. Call its authenticated getIntelligenceOptions()
method; display Lovable-managed AI, OpenAI API, and Claude API. Select the configured
backend default when available. Disable unconfigured live choices and explain that
the backend owner must configure them. In demo mode clearly label results as fictional.
Send the selected ID as intelligence_provider in POST /analyze. Do not add API key inputs.
Keep the existing report and evidence layout and render backend errors in the error state.

Enable your built-in AI connector for this project's actual runtime stack. Use an available
OpenAI or Claude text model supported by the project; do not assume Claude is available
on older React + Vite projects. Keep model access managed by Lovable on the backend.
Create a protected server-to-server AI bridge using docs/lovable-intelligence.md and the
analysisSchema export in the backend repository. Generate the native model call using
your supported AI connector; do not hardcode a guessed gateway endpoint.
Require a random shared LOVABLE_BRIDGE_TOKEN stored as a server secret and supplied
only by the FeedIntel backend. Check authorization before reading the body or calling AI.
Enforce a 1 MB request limit. Do not expose the token, managed AI credentials, prompts,
or provider keys in browser code. Follow the supplied schema and preserve video IDs.
Return only the structured interpretation object. On failure return a non-2xx error.

After deployment, provide the bridge's HTTPS URL so the backend owner can set
LOVABLE_ANALYSIS_URL. Set the same service token privately in both backend secret stores.
Do not show secrets in chat. Verify both skills against the deployed bridge, including
invalid-token rejection, provider failure, and unsupported evidence IDs.
```

## Sources

- [Lovable AI setup and managed credentials](https://docs.lovable.dev/features/ai)
- [Lovable text models and project-stack restrictions](https://docs.lovable.dev/features/ai-chat)
- [Claude structured JSON outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Claude Messages API](https://platform.claude.com/docs/en/api/messages/create)
