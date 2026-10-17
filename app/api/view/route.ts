import { safeFetch } from "@/lib/fetch"
import { requireSession, unauthorized } from "@/lib/session"

// Render a site that refuses framing: fetch it server-side and serve it from our origin.
// Scripts are stripped (and blocked by CSP) so third-party JS never runs on our origin.
export async function GET(request: Request) {
  if (!(await requireSession())) return unauthorized()
  try {
    const { url, text } = await safeFetch(
      new URL(request.url).searchParams.get("url") ?? ""
    )
    const html = text
      .replace(/<script[\s\S]*?<\/script>|<script[^>]*\/>|<base[^>]*>/gi, "")
      .replace(
        /<head([^>]*)>/i,
        `<head$1><base href="${url.replace(/"/g, "&quot;")}" target="_blank">`
      )
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "script-src 'none'; frame-ancestors 'self'",
      },
    })
  } catch {
    return new Response("Couldn't load this page.", { status: 400 })
  }
}
