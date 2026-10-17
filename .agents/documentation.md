# Documentation Reference — Sarvam AI Docs Reader

Everything needed to implement the project described in `idea.md`.
One place for: credentials, the four Sarvam APIs, Next.js 16 rules, SDK refs,
and the implementation map.

---

## 0. How to read Sarvam docs (meta)

- Any docs page has a clean Markdown twin: append `.md` to the URL.
- Full index: https://docs.sarvam.ai/llms.txt
- Machine-readable specs: OpenAPI https://docs.sarvam.ai/openapi.json ·
  AsyncAPI (WebSockets) https://docs.sarvam.ai/asyncapi.json
- MCP server for AI clients: https://docs.sarvam.ai/_mcp/server

## 1. Credentials & environment

**Get the key:** sign up at https://dashboard.sarvam.ai → API Keys → create.
The value is shown **once**; save it immediately.
(You said you'll provide this — it goes in the env file below.)

**Env file (Next.js):** create `.env.local` in the repo root (auto-loaded,
gitignored):

```bash
SARVAM_API_KEY=sk_...
```

Rules:
- **Never** prefix with `NEXT_PUBLIC_` — the key must stay server-side.
- All Sarvam calls go through server Route Handlers (`app/api/**/route.ts`).
- Local Next guide: `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`

**Auth header:** `api-subscription-key: $SARVAM_API_KEY` on every request.
Alternative for OpenAI-style tooling: `Authorization: Bearer $SARVAM_API_KEY`.
**Auth failures return HTTP 403** (not 401), `error.code: invalid_api_key_error`.
Source: https://docs.sarvam.ai/api-reference/authentication.md

**Base URL:** `https://api.sarvam.ai`

**SDKs (optional):** `npm install sarvamai` (JS/TS) · `pip install sarvamai` (Python).
For v0 we can use plain `fetch` (no new deps); the SDK matters if we later add
the realtime WebSocket.

```ts
import { SarvamAIClient } from "sarvamai";
const client = new SarvamAIClient({ apiSubscriptionKey: process.env.SARVAM_API_KEY });
```

---

## 2. The four APIs we use

### 2.1 Speech to Text — Saaras (feature: **listen**)

Docs: REST https://docs.sarvam.ai/api-reference/speech-to-text/transcribe.md ·
Realtime WS https://docs.sarvam.ai/api-reference/speech-to-text/transcribe/realtime/ws.md ·
Guide https://docs.sarvam.ai/api/api-guides-tutorials/speech-to-text/rest-api.md

**A) REST — push-to-talk (v0 choice)**

`POST /speech-to-text` · `multipart/form-data`

| Field | Value for us |
| --- | --- |
| `file` | audio clip, ≤ 30 s (WAV, MP3, OGG, OPUS, **WebM**, M4A, FLAC, …; 16 kHz best) |
| `model` | `saaras:v4` (default, recommended) or `saaras:v3` |
| `mode` | `transcribe` (default) — also `translate`/`verbatim`/`translit`/`codemix` (final only) |
| `language_code` | `en-IN` (or `unknown` for auto-detect) |
| `keyterms` | v4 only, ≤ 50 terms — bias toward doc words ("Saaras", "Bulbul", "WebSocket") |
| `with_timestamps` | optional chunk-level timestamps |

Response: `{ request_id, transcript, language_code, language_probability? }`.

```bash
curl -X POST https://api.sarvam.ai/speech-to-text \
  -H "api-subscription-key: $SARVAM_API_KEY" \
  -F model="saaras:v4" -F mode="transcribe" -F language_code="en-IN" \
  -F file=@clip.webm
```

Browser capture: `MediaRecorder` → `audio/webm` blob → POST to our route handler.

**B) Realtime — live mic (later)**

`wss://api.sarvam.ai/speech-to-text-realtime/ws`
- Models: `saaras:v3-realtime` (default) or `saaras:v4`.
- Query params: `language_code` (required, `en-IN`), `model`, `stream_type`
  (`fast`/`balanced`/`simulated`), `mode` (final transcript only), `endpointing`
  (`vad` default / `manual`), `encoding` (`linear16`, mono), `sample_rate`
  (`16000`/`8000`), `return_timestamps`.
- Server events: `session.begin`, `vad.speech_start`/`end`, `transcript.partial`,
  `transcript.final`, `config.updated`, `pong`, `session.end`, `error`.
- Client messages: `audio_input` `{event, audio: base64}`, plus `speech_start`/
  `speech_end`/`flush` (manual), `config.update`, `end`, `ping`.
- Auth: header `API-SUBSCRIPTION-KEY`, or in-browser subprotocol
  `api-subscription-key.<key>` — **do not put the key in the browser**; proxy the
  WS through the server if we go realtime.

### 2.2 Text to Speech — Bulbul (feature: **speak**)

Docs: REST https://docs.sarvam.ai/api-reference/text-to-speech/convert.md ·
Stream https://docs.sarvam.ai/api-reference/text-to-speech/convert-stream.md ·
Voices https://docs.sarvam.ai/api/api-guides-tutorials/text-to-speech/voices.md

**A) REST — short clips**

`POST /text-to-speech` · JSON

| Field | Value for us |
| --- | --- |
| `text` | ≤ 2,500 chars (v3/v4) |
| `language_code` | `en-IN` |
| `model` | `bulbul:v4-flash` (latest, recommended) or `bulbul:v3` (default) |
| `speaker` | v4 persona e.g. `simran_en_customer`, `ishita_en_customer`, `shubh_en_audiobook`, `ritu_en_edtech`; v4 default `shubh_enhi_ads`; v3 uses short names (`shubh`, `priya`) |
| `pace` | 0.5–2.0 (default 1) |
| `output_audio_codec` | `wav` (default) / `mp3` / `aac` / `flac` / `linear16` (`opus` currently errors on v3/v4) |
| `speech_sample_rate` | default 22050; REST also allows 32k/44.1k/48k |

Response: `{ audios: [base64 WAV] }` → decode → play via `Audio` from a Blob.

**B) Stream — lower latency for spoken answers**

`POST /text-to-speech/stream` · JSON (`text` ≤ 3,500 chars, `output_audio_codec:
mp3`, `output_audio_bitrate: 128k`) → raw binary audio stream, play/save directly.

```bash
curl -X POST https://api.sarvam.ai/text-to-speech/stream \
  -H "api-subscription-key: $SARVAM_API_KEY" -H "Content-Type: application/json" \
  -d '{"text":"Saaras turns speech into text.","language_code":"en-IN","model":"bulbul:v4-flash","speaker":"simran_en_customer","output_audio_codec":"mp3"}' --output out.mp3
```

**WebSocket TTS** (bidirectional, ignore for v0):
https://docs.sarvam.ai/api-reference/text-to-speech/stream.md

### 2.3 Chat Completion — Sarvam-105B (feature: **understand & explain**)

Docs: V1 https://docs.sarvam.ai/api-reference/chat/chat-completions-v1.md ·
Guide https://docs.sarvam.ai/api/api-guides-tutorials/chat-completion/overview.md

**Use V1** — non-beta, serves exactly our model:

`POST /v1/chat/completions` · JSON

| Field | Value for us |
| --- | --- |
| `model` | `sarvam-105b` (128K ctx, reasoning) — `sarvam-105b-conversations` (32K) for voice-speed dialogue |
| `messages` | standard roles: `system` / `user` / `assistant` |
| `temperature` | default 0.2 |
| `reasoning_effort` | `low`/`medium`/`high`, **on by default**; set `null` to disable (faster, cheaper) |
| `max_tokens` | default 2048 — raise it; reasoning tokens count here and can eat the budget |
| `stream` | `true` → SSE `chat.completion.chunk`s, ends with `data: [DONE]` |
| `response_format` | `{"type":"json_schema","json_schema":{...}}` for a structured `{action, target, text}` intent |

> V2 (`/v2/chat/completions`, open-weight models) **requires beta whitelisting** —
> skip: https://docs.sarvam.ai/api-reference/chat/chat-completions-v2.md

```bash
curl -X POST https://api.sarvam.ai/v1/chat/completions \
  -H "api-subscription-key: $SARVAM_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"sarvam-105b","messages":[{"role":"user","content":"Explain this: POST /speech-to-text"}]}'
```

Response: `choices[0].message.content` (and `reasoning_content` when thinking).

### 2.4 Document AI — Sarvam Vision (feature: **study the docs**

Docs: overview https://docs.sarvam.ai/api/api-guides-tutorials/document-intelligence/overview.md ·
model https://docs.sarvam.ai/api/getting-started/models/sarvam-vision.md

**Async job flow — digitise:**

1. `POST /doc-ai/v1/job/digitise` · `multipart/form-data`
   - `file` (repeatable) **or** `upload_ids` (exactly one of the two)
   - `language`: **set `en-IN`** explicitly (defaults to Indic!)
   - returns `201 { job_id, status, run_id }`
2. `GET /doc-ai/v1/job/{job_id}/status`
   - terminal: `completed` / `partially_completed` / `failed` / `rejected`
   - gives `usage.pages_total/processed/succeeded/failed`
3. `GET /doc-ai/v1/job/{job_id}/results?format=md` (or `html` / `json`)
   - digitise shape: `documents[].pages[].content` — the **Markdown corpus we render**
   - `409` if the job isn't terminal yet
4. Optional ZIP: `GET /doc-ai/v1/job/{job_id}/download-url` (presigned URL)

Pre-upload path (large files / many docs):
`POST /doc-ai/v1/job/upload` `{content_type}` → `upload_id` + presigned `PUT`.

**Inputs/limits:** PDF, PNG, JPG, ZIP · max **10 pages per PDF** ·
200 MB per file · 23 languages incl. `en-IN`.

```bash
# 1) start a job
curl -X POST https://api.sarvam.ai/doc-ai/v1/job/digitise \
  -H "api-subscription-key: $SARVAM_API_KEY" \
  -F language="en-IN" -F file=@speech-to-text-pages.pdf
# 2) poll, 3) fetch markdown
curl -H "api-subscription-key: $SARVAM_API_KEY" \
  "https://api.sarvam.ai/doc-ai/v1/job/<job_id>/results?format=md"
```

SDK (JS/TS): `client.docAi.digitise(...)` / `.getStatus(jobId)` / `.getResults(jobId, "md")`.

---

## 3. Errors, limits, models

- Errors & troubleshooting: https://docs.sarvam.ai/api/getting-started/errors-troubleshooting.md
- Rate limits: https://docs.sarvam.ai/api/getting-started/ratelimits.md
- Models overview: https://docs.sarvam.ai/api/getting-started/models.md
- Codes we must handle: `400` bad request · `403 invalid_api_key_error` ·
  `413` too large · `422` (STT bad audio / >30 s) · `429 rate_limit_exceeded_error` ·
  `500/502/503` retry with backoff.

## 4. Next.js 16 — local docs (authoritative)

> ⚠️ This Next.js (16.4.0) has breaking changes; the local docs shipped in the
> package are the source of truth. **Read the relevant guide before writing code.**

Paths under `node_modules/next/dist/docs/01-app/`:

| Topic | Local guide |
| --- | --- |
| Route Handlers (our API layer) | `01-getting-started/15-route-handlers.md` |
| Server & Client Components | `01-getting-started/05-server-and-client-components.md` |
| Layouts & Pages | `01-getting-started/03-layouts-and-pages.md` |
| Fetching Data | `01-getting-started/06-fetching-data.md` |
| Decorators/CSS (Tailwind 4) | `01-getting-started/11-css.md` |
| Environment Variables | `02-guides/environment-variables.md` |
| Interactive Apps (client state) | `02-guides/interactive-apps.md` |
| `route.ts` file convention | `03-api-reference/03-file-conventions/default.md` + `dynamic-routes.md` |

Key facts:
- Route handlers: `app/api/<name>/route.ts`, `export async function POST(request: Request)`,
  return `Response.json(...)` or a `Response` with a stream body; **not cached by default**.
- `.env.local` is auto-loaded; `process.env.SARVAM_API_KEY` only in server code.
- Client components (`"use client"`) for the mic button, audio playback, reader state.
- Existing scaffold: Next 16 App Router + Tailwind 4 + shadcn (`components/ui/*`),
  `app/page.tsx`, `app/layout.tsx`.

## 5. Implementation map + live-window architecture

| Feature | Endpoint / tech | Server route (proposed) | Client |
| --- | --- | --- | --- |
| Setup / key validation | 1-token `sarvam-105b` ping | `app/api/validate/route.ts` | URL + API key form |
| Capture + study | Playwright → `POST /doc-ai/v1/job/digitise` → poll → `results?format=md` | `app/api/ingest/route.ts` | progress status |
| Live window | `<iframe src>` (primary view) | — | iframe + nav controller |
| Fallback view | render the digitised Markdown corpus | — | markdown renderer pane |
| Listen | `POST /speech-to-text` | `app/api/stt/route.ts` | mic button (MediaRecorder) |
| Speak | `POST /text-to-speech/stream` | `app/api/tts/route.ts` | audio playback |
| Understand / explain / navigate | `POST /v1/chat/completions` (json_schema intent) | `app/api/agent/route.ts` | iframe page jumps + spoken answers |

### Live-site window: how voice controls a cross-origin iframe

- **Capture harvests the map**: Playwright records the site's page tree and
  framing headers (`X-Frame-Options`, `Content-Security-Policy:
  frame-ancestors`) for every page.
- **Navigation (MVP: page level)**: set `iframe.src = pageUrl` to open a page
  ("open the Bulbul page", "go back"). Section anchors are a later, optional
  upgrade — don't build them now.
- **Never read `iframe.contentDocument`** (blocked cross-origin).
- **Explanations are unaffected**: answered from the digitised corpus (Sarvam
  Vision output), not from the iframe DOM.
- **Framing fallback**: capture reports `frameable: false` → render the
  digitised reader view for that site; iframe is never mounted.
- **Key handling**: API key stays in the session; each server route call uses it
  per-request; nothing persisted.

### Production capture

Playwright (headless Chromium) is the capture tool inside the app pipeline.
Dev/QA uses agent-browser to drive the full flow (setup form → pipeline →
iframe → voice) with screenshots. Keep them separate: agent-browser never runs
in production.

## 6. Tooling & extra refs

- Sarvam cookbook (examples): https://github.com/sarvamai/sarvam-ai-cookbook
- Sarvam agent skills: `npx skills add sarvamai/skills --skill chat` (chat code gen)
- SDKs: https://docs.sarvam.ai/api/getting-started/sdks.md
- Quickstart: https://docs.sarvam.ai/api/getting-started/quickstart.md

## 7. First-call validation (once the key exists)

Run one call per API to prove the key + quota work:

1. Chat: curl `sarvam-105b` "Say hi in one word" → text back.
2. TTS: curl `/text-to-speech` `en-IN` → base64 `audios[0]` decodes to WAV.
3. STT: record a 5 s clip, curl `-F file=@clip.webm` → `transcript`.
4. Doc AI: 1-page PDF → digitise → poll → `results?format=md` → markdown.

## 8. Open items

- `.env.local` with `SARVAM_API_KEY` (you provide).
- Pick the docs slice + capture it to PDF/screenshots (step 1 of `idea.md`).
- If Doc AI returns `402`/beta errors, check account access to `sarvam-vision`.
