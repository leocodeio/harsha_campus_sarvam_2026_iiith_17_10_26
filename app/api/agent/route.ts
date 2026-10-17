import { fail, sarvam } from "@/lib/sarvam"
import { requireSession, unauthorized } from "@/lib/session"
import type { Intent, SiteMap } from "@/lib/types"

const CORPUS_CHARS = 30_000

const SCHEMA = {
  name: "intent",
  schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["navigate", "explain", "answer", "read"] },
      pageId: { type: "string" },
      anchor: { type: "string" },
      text: { type: "string" },
    },
    required: ["action", "text"],
  },
}

const SYSTEM = `You control a docs viewer and speak answers aloud.
Reply ONLY with JSON: {"action": "navigate"|"explain"|"answer"|"read", "pageId"?: string, "anchor"?: string, "text": string}.
- navigate: the user wants to open a page or section. Use only pageIds and anchors from MAP. text = a short spoken confirmation.
- explain / answer / read: text = a concise spoken reply (2-5 sentences, no markdown) based only on CORPUS. Say so if CORPUS doesn't cover it.`

export async function POST(request: Request) {
  if (!(await requireSession("agent"))) return unauthorized()
  try {
    const { transcript, pageId, map } = (await request.json()) as { transcript: string; pageId?: string; map: SiteMap }
    const index = map.pages
      .map((p) => `${p.id} | ${p.title}${p.sections.length ? ` | anchors: ${p.sections.map((s) => `${s.anchor} (${s.title})`).join(", ")}` : ""}`)
      .join("\n")
    // Current page first, then the rest, up to the corpus budget.
    let corpus = ""
    for (const p of [...map.pages.filter((p) => p.id === pageId), ...map.pages.filter((p) => p.id !== pageId)])
      if (p.md && corpus.length < CORPUS_CHARS) corpus += `\n\n=== ${p.id} | ${p.title} ===\n${p.md}`.slice(0, CORPUS_CHARS - corpus.length)

    const res = await sarvam("/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "sarvam-105b",
        temperature: 0.2,
        reasoning_effort: null, // reasoning tokens ate max_tokens on large corpora
        max_tokens: 1024,
        response_format: { type: "json_schema", json_schema: SCHEMA },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `MAP:\n${index}\n\nCURRENT PAGE: ${pageId ?? "none"}\n\nCORPUS:${corpus}\n\nUSER SAID: ${String(transcript).slice(0, 1000)}` },
        ],
      }),
    })
    const content: string = (await res.json()).choices?.[0]?.message?.content ?? ""
    let intent: Intent
    try {
      intent = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] ?? "")
    } catch {
      intent = { action: "answer", text: content || "Sorry, I didn't get that." }
    }
    // Never trust invented targets.
    const page = map.pages.find((p) => p.id === intent.pageId)
    if (!page) delete intent.pageId
    if (!page?.sections.some((s) => s.anchor === intent.anchor)) delete intent.anchor
    if (intent.action === "navigate" && !page) intent.action = "answer"
    return Response.json(intent)
  } catch (e) {
    return fail(e)
  }
}
