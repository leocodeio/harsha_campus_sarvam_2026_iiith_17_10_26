export class SarvamError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const friendly: Record<number, string> = {
  413: "input too large",
  422: "couldn't process that audio (max 30s)",
  429: "busy right now, try again in a moment",
}

/** Server-only fetch to Sarvam with our key. 429/5xx retried once; 403 means our key is broken. */
export async function sarvam(path: string, init: RequestInit) {
  const key = process.env.SARVAM_API_KEY
  if (!key) throw new SarvamError(503, "service unavailable")
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.sarvam.ai${path}`, {
      ...init,
      headers: { ...init.headers, "api-subscription-key": key },
    })
    if (res.ok) return res
    if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 1000))
      continue
    }
    console.error(`sarvam ${path} -> ${res.status}`, (await res.text()).slice(0, 300))
    if (res.status === 403) throw new SarvamError(503, "service unavailable")
    throw new SarvamError(res.status, friendly[res.status] ?? "service error")
  }
}

export const fail = (e: unknown) => {
  if (!(e instanceof SarvamError)) console.error(e)
  return e instanceof SarvamError
    ? Response.json({ error: e.message }, { status: e.status })
    : Response.json({ error: "server error" }, { status: 500 })
}
