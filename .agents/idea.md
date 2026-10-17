# Idea: Sarvam AI Docs Reader

## What we are building
One site where the reader never leaves: you give it a docs website URL and your
Sarvam API key, it studies the site, shows the **live site in a window inside our
page**, and lets you navigate that window by voice. MVP scope — keep it small.

## The flow
1. **Setup screen (our dashboard)** — two inputs: **Website URL** + **Sarvam API
   key**. Key validated (cheap ping), kept in session, never stored.
2. **Pipeline triggers on submit** — Capture (server-side headless Chromium):
   page tree, whether the site allows framing (X-Frame-Options / CSP), and page
   PDFs in ≤10-page chunks. Then **Study**: Sarvam Vision digitise → Markdown
   corpus (grounding for explanations; fast path for sites with `.md` twins).
3. **The window** — the live site renders in an **iframe inside our page**; the
   user stays on our site.
4. **Voice navigation (MVP: page level)** — "open the Bulbul page", "go back" →
   set `iframe.src` to the target page. Listen = Saaras, speak = Bulbul, intent
   and explanations = Sarvam-105B grounded in the corpus.
5. **Fallback** — if the site refuses framing (known at capture time), show the
   digitised reader view for that site instead of the iframe.

## Locked stack (Sarvam only — nothing else)
| Job | Model | API |
| --- | --- | --- |
| Study / read documents | Sarvam Vision | `/doc-ai/v1/job/digitise` |
| Listen (speech in) | Saaras v3 / v4 | `/speech-to-text` |
| Speak (speech out) | Bulbul v3 / v4-flash | `/text-to-speech` (REST / stream) |
| Understand & explain / intent | Sarvam-105B | `/v1/chat/completions` |

No non-Sarvam providers, no legacy models. Auth: `api-subscription-key`.
Capture tooling: Playwright (headless Chromium). Dev/QA: agent-browser.

## App (v0)
- Next.js 16 App Router + Tailwind 4 + shadcn.
- Setup screen → pipeline → reader page: **live-site iframe** as the primary
  window, digitised markdown as the fallback view + explanation corpus.
- Mic button drives the voice loop (push-to-talk).

## Known limits (accepted for MVP)
- Cross-origin iframe: page jumps only — no highlighting, no section-level
  jumps, no scroll-position reading.
- Sites that send `X-Frame-Options: DENY` cannot be embedded → fallback view.

## Open questions
- First target site (framing unknown until we test it).
- Push-to-talk only for v0, or always-listening Realtime later?
- Does the agent act on navigation directly, or confirm before moving?
