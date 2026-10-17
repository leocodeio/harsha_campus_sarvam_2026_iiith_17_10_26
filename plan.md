# plan.md — Sarvam AI Docs Reader (end-to-end, Vercel-hosted)

> Source of truth for *what*: `.agents/idea.md`. API details: `.agents/documentation.md`.
> Stack: `.agents/DESIGN.md` (Next 16.4 App Router, React 19.3, Tailwind 4, shadcn base-nova).
> Rules: `.agents/AGENTS.md`. Write as little code as possible and ship fast. Read
> `node_modules/next/dist/docs/` before touching any Next API.

---

## 0. Goal

A single Next.js app deployed on **Vercel** (project already linked: `.vercel/project.json`).
Anyone with a link **and a Sarvam API key that I hand out** can:

1. Unlock the app by entering the key (the **gate**). Nothing is reachable without it.
2. Paste a docs URL. The app studies the site.
3. Read the live site in an iframe inside our page, or in a digitised reader view if the
   site can't be framed.
4. Talk to it with push-to-talk. It listens (Saaras), understands, explains, and navigates
   (Sarvam-105B), then answers out loud (Bulbul).

Sarvam only. No other model providers, no database, no user accounts.

---

## 1. Current state (what exists)

| Item | State |
| --- | --- |
| Scaffold | Next 16.4.0 + shadcn, `app/page.tsx` is still the template placeholder |
| UI kit | `components/ui/button.tsx` only, `components/theme-provider.tsx` (press `d` for dark) |
| Deploy | `vercel.json` (pnpm build), `.vercel/` linked to `harsha_campus_sarvam_2026_iiith_17_10_26` |
| API code | none |
| Git | nothing committed yet; old `next-app/` removal is unstaged |

---

## 2. Auth model: "enter the API key I give you"

**Decision:** the gate key **is** a Sarvam API key. I create keys in
dashboard.sarvam.ai and give one to each person (or group). The key is the only credential.
That gives us:
- **Authentication**: the key is checked live against Sarvam. A revoked key stops working
  everywhere at once.
- **Usage and billing per person**: every Sarvam call runs on that person's key, so usage
  shows up per key in the Sarvam dashboard.
- **No server secret to leak**: there is no `SARVAM_API_KEY` env var in production.

**Optional allowlist (one env var, no DB):** `ALLOWED_KEY_HASHES` = comma-separated
SHA-256 hashes of the keys I've issued. If it's set, a valid Sarvam key that isn't on the list
is rejected, so a random Sarvam user can't burn the deployment's compute. If it's empty,
any valid Sarvam key gets in.

### Flow
```
/ (gate)  ──POST key──▶  server action `unlock`
                          1. (if set) sha256(key) ∈ ALLOWED_KEY_HASHES ?
                          2. ping Sarvam: POST /v1/chat/completions
                             {model:"sarvam-105b", max_tokens:1, reasoning_effort:null}
                             403 → "invalid key"; 429 → "valid but rate-limited" (allow)
                          3. set cookie `sk` = AES-GCM(key, SESSION_SECRET)
                             httpOnly, secure, sameSite=lax, maxAge 12h
                          4. redirect /app
/logout   ──▶ delete cookie, redirect /
```

### Enforcement
- **`proxy.ts`** (the Next 16 rename of middleware, see `03-file-conventions/proxy.md`): if
  `sk` is missing, redirect `/app/**` to `/` and return 401 for `/api/**`. This is an optimistic
  presence check only.
- **`lib/session.ts`** with `getKey()`: every route handler decrypts the cookie and gets the
  raw key. Missing or undecryptable means 401. This is the real check.
- The key **never** reaches client JS, localStorage, or logs. Use Web Crypto (`crypto.subtle`)
  for AES-GCM, so there's no new dependency (no jose or iron-session needed).
- Any Sarvam `403` mid-session clears the cookie and sends the user back to the gate.

### Env vars (Vercel → Project → Settings → Environment Variables)
| Var | Purpose |
| --- | --- |
| `SESSION_SECRET` | 32-byte base64, `openssl rand -base64 32`. Required. |
| `ALLOWED_KEY_HASHES` | Optional allowlist. |
| `SARVAM_API_KEY` | **Local dev only** (`.env.local`), used by the curl smoke tests. Never `NEXT_PUBLIC_`. |

---

## 3. Architecture

```
Browser (client components)                    Vercel Functions (route handlers)          Sarvam
───────────────────────────                    ─────────────────────────────────          ──────
Gate form ───────────────────────────────────▶ action unlock ───────────────────────────▶ /v1/chat (ping)
Setup: URL ──────────────────────────────────▶ /api/capture   (map + frameable + md)
          ◀── SiteMap + corpus (JSON) ───────
          (if no .md twins) ────────────────▶ /api/study      start ─────────────────────▶ /doc-ai digitise
          poll every 3s ────────────────────▶ /api/study?job  status/results ────────────▶ /doc-ai status/results
Reader: iframe | markdown view
Mic (MediaRecorder webm) ────────────────────▶ /api/stt ─────────────────────────────────▶ /speech-to-text
          ◀── transcript
transcript + current page + corpus slice ────▶ /api/agent (json_schema intent) ──────────▶ /v1/chat/completions
          ◀── {action, target, text}
navigate iframe (src / #anchor)
text ────────────────────────────────────────▶ /api/tts (stream mp3 passthrough) ────────▶ /text-to-speech/stream
          ◀── audio stream → <audio>
```

### No database: the client holds the corpus
Vercel functions are stateless. The **SiteMap and corpus live in browser memory**, with a
`sessionStorage` mirror so a refresh doesn't lose them. Each `/api/agent` call sends the
transcript, the current page id, and a **corpus slice** (current page markdown plus the
page/section index). A docs section stays well inside the 128K context of `sarvam-105b`.
Add Vercel Blob or KV later, only if corpora get too big.

### Data shapes (`lib/types.ts`)
```ts
type Section  = { id: string; title: string; anchor: string }      // anchor = real DOM id
type Page     = { id: string; url: string; title: string; sections: Section[]; md?: string }
type SiteMap  = { root: string; frameable: boolean; pages: Page[] }
type Intent   = { action: "navigate" | "explain" | "answer" | "read";
                  pageId?: string; anchor?: string; text: string }
```

---

## 4. Capture and study on Vercel (the hard part)

Headless Chromium on Vercel is heavy: the function bundle is capped at 250 MB, there are
cold starts, and it needs `@sparticuz/chromium` + `playwright-core`. So go **fetch-first and
Chromium-last**:

| Step | v0 (no browser) | Later (only if needed) |
| --- | --- | --- |
| Page tree | `GET {root}/llms.txt`, then `sitemap.xml`, then same-prefix `<a href>` from root HTML. Restrict to the URL prefix and cap at ~40 pages. | Playwright crawl for JS-rendered navs |
| Frameable? | `HEAD`/`GET` root: `X-Frame-Options` (DENY/SAMEORIGIN means not frameable) and CSP `frame-ancestors` (anything but `*` or our origin means not frameable) | — |
| Anchors | Regex over fetched HTML: `<h[1-4][^>]*id="…">title`. Real ids only. | DOM eval in Playwright |
| Corpus, fast path | `GET {pageUrl}.md` (Sarvam docs, Mintlify/Fern sites, etc.). Accept it if `200` and not HTML. | — |
| Corpus, slow path | Pages with no `.md`: upload page HTML rendered as PDF → **Sarvam Vision digitise** | `page.pdf()` via `@sparticuz/chromium` in ≤10-page PDFs |

**v0 Sarvam Vision path without Chromium:** Vision accepts PDF/PNG/JPG/ZIP, so we need a
render. Plan: ship the fast path plus the HTML-text fallback first (strip tags into rough
markdown so the app works on any site). Then add a `/api/study` route that runs the
Chromium-to-PDF-to-digitise pipeline for sites without `.md` twins. That keeps Vision in
the "Study" step as the idea specifies without blocking v0 on Chromium.

**Doc AI is async, so polling lives in the client** (no long-running functions):
- `POST /api/study` starts the job: `/doc-ai/v1/job/digitise` with `language=en-IN`
  (always explicit), returns `job_id`.
- `GET /api/study?job=…` calls status, and once it's terminal, calls `results?format=md` and
  returns `documents[].pages[].content`.
- Client polls every 3s and shows progress from `usage.pages_processed/pages_total`.
- Set `export const maxDuration = 60` on capture and study routes (see
  `02-route-segment-config/maxDuration.md`).

---

## 5. Routes and files (complete list, nothing else)

```
proxy.ts                         gate enforcement (cookie presence)
lib/session.ts                   encrypt/decrypt cookie, getKey(), clearKey()
lib/sarvam.ts                    sarvam(path, key, init) fetch wrapper: base URL, header,
                                 403 → AuthError, 429/5xx → 1 retry with backoff
lib/types.ts                     shapes above
app/page.tsx                     GATE: key input + "Unlock" (server action)
app/actions.ts                   unlock(), logout()
app/app/page.tsx                 SETUP: URL input, then pipeline progress, then READER
components/reader.tsx            client: iframe or markdown pane + page list + current page state
components/mic.tsx               client: push-to-talk, MediaRecorder → stt → agent → tts → play
app/api/capture/route.ts         POST {url} → SiteMap (+ md where fast path hits)
app/api/study/route.ts           POST start digitise / GET poll + results
app/api/stt/route.ts             POST multipart passthrough → /speech-to-text
app/api/agent/route.ts           POST {transcript, pageId, map, md} → Intent
app/api/tts/route.ts             POST {text} → stream /text-to-speech/stream body back
```
New dependencies: **none for v0.** Add `react-markdown` only if the fallback view needs real
rendering (`<pre className="whitespace-pre-wrap">` is fine on day 1). Add shadcn components
only as needed (`input`, `card`, `progress`).

### Per-route Sarvam settings
| Route | Settings |
| --- | --- |
| stt | `model=saaras:v4`, `mode=transcribe`, `language_code=en-IN`, `keyterms` = page titles (≤50), clip ≤30s (enforced client side) |
| agent | `model=sarvam-105b`, `temperature 0.2`, `reasoning_effort: "low"`, `max_tokens 1024`, `response_format` json_schema = `Intent`. System prompt: "You control a docs viewer. Only use pageIds/anchors from MAP. Explain only from CORPUS; say when it's not covered." |
| tts | `model=bulbul:v4-flash`, `speaker=simran_en_customer`, `language_code=en-IN`, `output_audio_codec=mp3`, text truncated to 3,500 chars. Pipe `res.body` straight back. |

### Voice loop (client, `mic.tsx`)
1. Hold the button and `MediaRecorder` records `audio/webm`. Release (or 30s) stops it.
2. `/api/stt` returns the transcript, shown as a caption.
3. `/api/agent` returns an Intent.
   - `navigate`: `iframe.src = page.url + (anchor ? "#"+anchor : "")`. Validate that pageId
     and anchor exist in the SiteMap and ignore anything invented. In the fallback view,
     scroll to the section heading instead.
   - `explain` / `answer` / `read`: speak `text`.
4. `/api/tts` plays the audio. Cancel playback when the user presses the mic again.

Open-question defaults (from idea.md), so nothing blocks: **push-to-talk only**,
**navigate directly** (no confirm), **accept no highlighting**, **no proxy** in v0.

---

## 6. UI (three screens, one URL each)

1. **Gate `/`**: centered card with the title, a password-type input "Sarvam API key", and an
   Unlock button. Inline error (invalid / rate-limited / not on the allowlist).
2. **Setup `/app`**: URL input with a "Study site" button, then a step list (Mapping →
   Checking framing → Reading pages n/N → Ready).
3. **Reader `/app`** (same page, once ready): left rail lists pages and sections (clickable,
   same navigate function). The main area is the iframe or markdown. A bottom bar has the
   mic button, the live caption, the last answer text, and a "Fallback view" toggle. The
   header has the site root, "New site", and "Lock" (logout).

Mobile: rail collapses into a sheet, and the mic is a floating button. Dark mode already
works through the theme provider.

---

## 7. Build order (each step ends deployable)

| # | Step | Done when |
| --- | --- | --- |
| 0 | Commit current scaffold; `.env.local` with `SARVAM_API_KEY`; run the 4 curl smoke tests from `documentation.md §7` | all 4 APIs answer with my key |
| 1 | `lib/session.ts`, `lib/sarvam.ts`, gate page + `unlock`/`logout`, `proxy.ts` | wrong key rejected; right key reaches `/app`; `/api/*` returns 401 without the cookie |
| 2 | **Deploy to Vercel now** (set `SESSION_SECRET`), test the gate in prod | prod gate works end to end |
| 3 | `/api/capture` (llms.txt/sitemap/links, frame check, anchors, `.md` fast path) + setup UI | docs.sarvam.ai section → SiteMap with md for every page |
| 4 | Reader: iframe or fallback, rail navigation | clicking a section jumps the iframe to `#anchor` |
| 5 | `/api/stt` + `/api/tts` + mic loop (echo transcript back as speech) | speak → hear it back |
| 6 | `/api/agent` with json_schema intent + navigation + grounded explain | "open the Bulbul page" navigates; "what does saaras do" answers aloud |
| 7 | `/api/study` Sarvam Vision path (PDF → digitise → poll → md) for sites without `.md` | a non-Mintlify docs site gets a corpus |
| 8 | Hardening (§8) + redeploy | checklist green |

Steps 0–6 are the demo. Step 7 completes the "Sarvam Vision studies the site" story.

---

## 8. Hardening checklist

- [ ] **SSRF guard** in capture: allow only `http(s)`, reject localhost, private IP ranges, and
      `169.254.*`; follow redirects manually and re-check each hop; set a 10s timeout and a 2 MB
      size cap per fetch.
- [ ] Map Sarvam errors to friendly messages: `403` (relock), `422` (clip too long/bad audio),
      `429` (wait), `413`, `5xx` (one retry).
- [ ] Never log request bodies or headers (the key is in the cookie). No `console.log(key)`.
- [ ] Cookie `secure` in prod, `sameSite=lax`, 12h expiry, cleared on logout or 403.
- [ ] Our own response headers: `X-Frame-Options: DENY` / `frame-ancestors 'none'` for our
      pages (we frame others, nobody frames us); `Referrer-Policy: no-referrer`.
- [ ] Per-key soft rate limit isn't needed in v0 because Sarvam rate-limits per key already.
- [ ] `pnpm typecheck && pnpm lint && pnpm build` pass before every deploy.

---

## 9. Deploy (Vercel)

1. `vercel env add SESSION_SECRET production` (and preview), plus `ALLOWED_KEY_HASHES` if
   I'm using the allowlist (`echo -n sk_... | sha256sum`).
2. `git push` to the linked repo or run `vercel --prod`. Framework, install, and build are
   already in `vercel.json`.
3. Prod smoke test: gate with a bad key (rejected), gate with a good key, study
   `https://docs.sarvam.ai/api-reference/...`, navigate by voice, ask a question, lock.
4. **Issuing access**: create a Sarvam key per person, send it with the URL, and (if using
   the allowlist) add its hash and redeploy. **Revoking**: delete the key in the Sarvam
   dashboard, which takes effect immediately.

Vercel limits to keep in mind: function duration (set `maxDuration`, and polling keeps every
call short), the 4.5 MB request body limit (STT clips ≤30s webm are well under), and the
250 MB bundle limit (only matters at step 7 with Chromium).

---

## 10. Verification (QA)

- Curl smoke tests per API (step 0).
- agent-browser drives the full flow (gate → setup → reader → mic) with screenshots,
  locally and on the prod URL. It's dev/QA only and never runs in prod.
- Manual: one frameable site (iframe path) and one `X-Frame-Options: DENY` site (fallback
  path).

---

## 11. Risks and open items

| Risk | Mitigation |
| --- | --- |
| docs.sarvam.ai refuses framing | Fallback view is first-class; capture detects it up front |
| Hallucinated navigation targets | Server validates pageId/anchor against the SiteMap before returning |
| Reasoning tokens eat `max_tokens` | `reasoning_effort: "low"`, `max_tokens 1024`; drop to `null` if it's slow |
| Doc AI account access (402 / beta) | Check at step 0; the `.md` fast path keeps the demo alive regardless |
| Chromium on Vercel (step 7) | Isolated to one route; if it's too heavy, upload ≤10-page PDFs generated another way, or run Vision only on user-supplied PDFs |
| Shared key leaks | Per-person keys + allowlist + instant revocation in the Sarvam dashboard |

**Needs my confirmation:**
1. The gate key = a **Sarvam** API key I hand out (assumed). If instead you want a separate
   app access code plus one server-side Sarvam key, only §2 changes: `ACCESS_KEYS` env and
   `SARVAM_API_KEY` in Vercel. Everything else stays the same.
2. First target docs slice (default: Sarvam API reference, speech-to-text section).
