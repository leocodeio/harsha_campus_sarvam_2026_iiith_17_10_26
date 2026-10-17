import { lookup } from "node:dns/promises"
import { isIP } from "node:net"

const MAX_BYTES = 2_000_000

function isPrivate(ip: string): boolean {
  if (ip.startsWith("::ffff:")) return isPrivate(ip.slice(7))
  if (isIP(ip) === 6) return ip === "::1" || ip === "::" || /^(fc|fd|fe80)/i.test(ip)
  const [a, b] = ip.split(".").map(Number)
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
}

/** SSRF-guarded GET: http(s) only, public IPs only (re-checked per redirect hop), 10s, 2 MB. */
export async function safeFetch(input: string) {
  let url = new URL(input)
  for (let hop = 0; hop < 5; hop++) {
    if (!/^https?:$/.test(url.protocol)) throw new Error("bad protocol")
    const addrs = await lookup(url.hostname, { all: true })
    if (url.hostname === "localhost" || addrs.some((a) => isPrivate(a.address))) throw new Error("blocked host")
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(10_000) })
    const loc = res.headers.get("location")
    if (res.status >= 300 && res.status < 400 && loc) {
      url = new URL(loc, url)
      continue
    }
    const reader = res.body?.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > MAX_BYTES) {
        await reader.cancel()
        break
      }
      chunks.push(value)
    }
    return { res, url: url.href, text: Buffer.concat(chunks).toString("utf8") }
  }
  throw new Error("too many redirects")
}
