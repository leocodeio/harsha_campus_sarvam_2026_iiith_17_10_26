import { safeFetch } from "@/lib/fetch"
import { requireSession, unauthorized } from "@/lib/session"
import type { Page, SiteMap } from "@/lib/types"

export const maxDuration = 60

const MAX_PAGES = 40
const tryFetch = (u: string) => safeFetch(u).catch(() => null)
const strip = (s: string) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim()
const clean = (u: string) => {
  const x = new URL(u)
  x.hash = ""
  x.search = ""
  return x.href.replace(/\.md$/, "").replace(/\/$/, "")
}

function frameable(h: Headers) {
  if (h.get("x-frame-options")) return false
  const fa = h.get("content-security-policy")?.match(/frame-ancestors([^;]*)/)?.[1].trim()
  return !fa || fa.split(/\s+/).includes("*")
}

function htmlToMd(html: string) {
  const body = html.match(/<main[\s\S]*?<\/main>/i)?.[0] ?? html.match(/<body[\s\S]*<\/body>/i)?.[0] ?? html
  return body
    .replace(/<(script|style|nav|header|footer|svg|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${"#".repeat(+n)} ${strip(t)}\n\n`)
    .replace(/<(p|li|pre|tr|div|br)[^>]*>/gi, "\n")
    .split("\n")
    .map(strip)
    .filter(Boolean)
    .join("\n")
}

async function capturePage(url: string, hint?: string): Promise<Page> {
  const [html, md] = await Promise.all([tryFetch(url), tryFetch(`${url}.md`)])
  const h = html?.res.ok ? html.text : ""
  const sections = [...h.matchAll(/<h([1-4])[^>]*\sid="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map(([, , anchor, t]) => ({ id: anchor, anchor, title: strip(t) }))
    .filter((s) => s.title)
  const isMd = md?.res.ok && !md.res.headers.get("content-type")?.includes("html") && !md.text.trimStart().startsWith("<")
  const text = isMd ? md!.text : h ? htmlToMd(h) : undefined
  const title = (isMd && md!.text.match(/^#\s+(.+)$/m)?.[1]) || hint || strip(h.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || url
  return { id: new URL(url).pathname || "/", url, title: title.trim(), sections, md: text?.slice(0, 60_000) }
}

export async function POST(request: Request) {
  if (!(await requireSession("capture"))) return unauthorized()
  try {
    const { url } = await request.json()
    const rootRes = await safeFetch(String(url))
    const root = clean(rootRes.url)
    const { origin, pathname } = new URL(rootRes.url)
    const prefix = origin + pathname.slice(0, pathname.lastIndexOf("/") + 1) // "/a/b/" keeps b, "/a/b" keeps a

    // Page tree: llms.txt links + sitemap.xml + same-prefix links on the root page.
    const titles = new Map<string, string>()
    const [llms, sitemap] = await Promise.all([tryFetch(`${origin}/llms.txt`), tryFetch(`${origin}/sitemap.xml`)])
    for (const [, t, href] of (llms?.res.ok ? llms.text : "").matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g))
      titles.set(clean(new URL(href, origin).href), t)
    const found = [
      ...titles.keys(),
      ...[...(sitemap?.res.ok ? sitemap.text : "").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]),
      ...[...rootRes.text.matchAll(/href="([^"#]+)/g)].map((m) => new URL(m[1], root).href),
    ]
    const urls = [root, ...new Set(found.flatMap((u) => { try { return [clean(u)] } catch { return [] } }))]
      .filter((u, i, a) => (u === root || u.startsWith(prefix)) && a.indexOf(u) === i && !/\.(png|jpe?g|svg|css|js|ico|xml|txt|pdf)$/i.test(u))
      .slice(0, MAX_PAGES)

    const pages: Page[] = []
    for (let i = 0; i < urls.length; i += 8)
      pages.push(...(await Promise.all(urls.slice(i, i + 8).map((u) => capturePage(u, titles.get(u))))))

    const map: SiteMap = { root, frameable: rootRes.res.ok && frameable(rootRes.res.headers), pages }
    return Response.json(map)
  } catch (e) {
    console.error(e)
    return Response.json({ error: "couldn't read that site" }, { status: 400 })
  }
}
