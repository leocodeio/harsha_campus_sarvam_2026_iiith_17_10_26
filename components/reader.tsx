"use client"

import { useEffect, useState } from "react"
import { logout } from "@/app/actions"
import { MaximizeIcon, MinimizeIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api, Mic } from "@/components/mic"
import { ThemeToggle } from "@/components/theme-provider"
import type { Intent, Page, SiteMap } from "@/lib/types"

const STORE = "sitemap"
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

// Turn Sarvam Vision markdown pages into a SiteMap (no live site to frame).
function fromPdf(name: string, pages: string[]): SiteMap {
  return {
    root: name,
    frameable: false,
    pages: pages.map((md, i): Page => {
      const heads = [...md.matchAll(/^#{1,4}\s+(.+)$/gm)].map((m) =>
        m[1].trim()
      )
      return {
        id: `page-${i + 1}`,
        url: "",
        title: heads[0] ?? `Page ${i + 1}`,
        sections: heads.map((t) => ({
          id: slug(t),
          anchor: slug(t),
          title: t,
        })),
        md,
      }
    }),
  }
}

export function Reader() {
  const [map, setMap] = useState<SiteMap | null>(null)
  const [status, setStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [at, setAt] = useState<{ pageId?: string; anchor?: string }>({})
  const [text, setText] = useState(false) // text view instead of the live site
  const [full, setFull] = useState(false)

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORE)
      if (saved) load(JSON.parse(saved))
    } catch {}
  }, [])

  function load(m: SiteMap | null) {
    setMap(m)
    setAt({ pageId: m?.pages[0]?.id })
    setText(!m?.pages[0]?.url) // PDF corpora have no live site
    try {
      if (m) sessionStorage.setItem(STORE, JSON.stringify(m))
      else sessionStorage.removeItem(STORE)
    } catch {}
  }

  async function capture(form: FormData) {
    setBusy(true)
    setStatus("Mapping pages, checking framing, reading pages…")
    try {
      const m = await api<SiteMap>("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.get("url") }),
      })
      setStatus(`Ready: ${m.pages.length} pages`)
      load(m)
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "failed")
    }
    setBusy(false)
  }

  async function study(file: File) {
    setBusy(true)
    setStatus("Uploading to Sarvam Vision…")
    try {
      const body = new FormData()
      body.set("file", file)
      const { job } = await api<{ job: string }>("/api/study", {
        method: "POST",
        body,
      })
      for (;;) {
        await new Promise((r) => setTimeout(r, 3000))
        const r = await api<{
          pages?: string[]
          done?: number
          total?: number
        }>(`/api/study?job=${job}`, {})
        if (r.pages) {
          load(fromPdf(file.name, r.pages))
          break
        }
        setStatus(`Sarvam Vision reading pages ${r.done}/${r.total || "?"}…`)
      }
      setStatus("")
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "failed")
    }
    setBusy(false)
  }

  const page = map?.pages.find((p) => p.id === at.pageId)
  const go = (i: Intent | { pageId?: string; anchor?: string }) =>
    i.pageId && setAt({ pageId: i.pageId, anchor: i.anchor })

  useEffect(() => {
    if (text && at.anchor)
      document
        .getElementById(`a-${at.anchor}`)
        ?.scrollIntoView({ behavior: "smooth" })
  }, [text, at])

  if (!map)
    return (
      <main className="flex min-h-svh items-center justify-center p-6">
        <ThemeToggle className="fixed top-4 right-4" />
        <div className="w-full max-w-lg space-y-4 rounded-xl border p-6">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-medium">Study a docs site</h1>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                Lock
              </Button>
            </form>
          </div>
          <form action={capture} className="flex gap-2">
            <input
              name="url"
              type="url"
              required
              defaultValue="https://docs.sarvam.ai/api-reference/speech-to-text/transcribe"
              aria-label="Docs URL"
              className="h-9 min-w-0 flex-1 rounded-lg border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
            />
            <Button type="submit" size="lg" disabled={busy}>
              Study site
            </Button>
          </form>
          <label className="block text-sm text-muted-foreground">
            Or digitise a PDF (≤10 pages) with Sarvam Vision:{" "}
            <input
              type="file"
              accept="application/pdf"
              disabled={busy}
              className="text-xs"
              onChange={(e) => e.target.files?.[0] && study(e.target.files[0])}
            />
          </label>
          {status && (
            <p className="text-sm" role="status">
              {status}
            </p>
          )}
        </div>
      </main>
    )

  const titleFor = (line: string) =>
    page?.sections.find((s) => s.title === line.replace(/^#+\s*/, "").trim())

  return (
    <div className="flex h-svh flex-col">
      {full ? (
        <Button
          variant="outline"
          size="sm"
          className="fixed top-3 right-3 z-50 shadow-lg"
          onClick={() => setFull(false)}
        >
          <MinimizeIcon /> Exit full screen
        </Button>
      ) : (
        <header className="flex items-center gap-2 border-b px-4 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">
            {map.root}
          </span>
          {page?.url && (
            <Button variant="outline" size="sm" onClick={() => setText(!text)}>
              {text ? "Live view" : "Text view"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setFull(true)}>
            <MaximizeIcon /> Full screen
          </Button>
          <Button variant="outline" size="sm" onClick={() => load(null)}>
            New site
          </Button>
          <form action={logout}>
            <Button type="submit" variant="ghost" size="sm">
              Lock
            </Button>
          </form>
          <ThemeToggle />
        </header>
      )}
      <div className="flex min-h-0 flex-1">
        <aside
          className={
            full
              ? "hidden"
              : "hidden w-64 shrink-0 overflow-y-auto border-r p-2 text-sm md:block"
          }
        >
          {map.pages.map((p) => (
            <div key={p.id} className="mb-1">
              <button
                onClick={() => go({ pageId: p.id })}
                className={`w-full truncate rounded px-2 py-1 text-left hover:bg-muted ${p.id === at.pageId ? "bg-muted font-medium" : ""}`}
              >
                {p.title}
              </button>
              {p.id === at.pageId &&
                p.sections.map((s) => (
                  <button
                    key={s.anchor}
                    onClick={() => go({ pageId: p.id, anchor: s.anchor })}
                    className="block w-full truncate rounded py-0.5 pl-5 text-left text-muted-foreground hover:bg-muted"
                  >
                    {s.title}
                  </button>
                ))}
            </div>
          ))}
        </aside>
        <main className="min-w-0 flex-1 overflow-y-auto">
          {!page ? null : text ? (
            <article className="mx-auto max-w-3xl p-6 pb-40 text-sm leading-relaxed">
              {(page.md ?? "No text captured for this page.")
                .split("\n")
                .map((line, i) =>
                  line.startsWith("#") ? (
                    <h2
                      key={i}
                      id={
                        titleFor(line)
                          ? `a-${titleFor(line)!.anchor}`
                          : undefined
                      }
                      className="mt-6 mb-2 scroll-mt-4 font-semibold"
                    >
                      {line.replace(/^#+\s*/, "")}
                    </h2>
                  ) : (
                    <p key={i} className="whitespace-pre-wrap">
                      {line}
                    </p>
                  )
                )}
            </article>
          ) : (
            <iframe
              key={page.url}
              // Sites that refuse framing are rendered through our script-free proxy.
              src={
                (map.frameable
                  ? page.url
                  : `/api/view?url=${encodeURIComponent(page.url)}`) +
                (at.anchor ? `#${at.anchor}` : "")
              }
              sandbox={
                map.frameable
                  ? undefined
                  : "allow-popups allow-popups-to-escape-sandbox"
              }
              title={page.title}
              className="h-full w-full bg-white"
            />
          )}
        </main>
      </div>
      <Mic map={map} pageId={at.pageId} onIntent={go} />
    </div>
  )
}
