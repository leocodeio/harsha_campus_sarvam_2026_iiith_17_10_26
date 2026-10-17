"use client"

import { useRef, useState } from "react"
import { MicIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Intent, SiteMap } from "@/lib/types"

export async function api<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (res.status === 401) location.reload() // server redirects to the gate
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "request failed")
  return res.json()
}

export function Mic({ map, pageId, onIntent }: { map: SiteMap; pageId?: string; onIntent: (i: Intent) => void }) {
  const [state, setState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle")
  const [caption, setCaption] = useState("")
  const [answer, setAnswer] = useState("")
  const rec = useRef<MediaRecorder | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)

  async function start() {
    audio.current?.pause()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const r = new MediaRecorder(stream)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        run(new Blob(chunks, { type: r.mimeType }))
      }
      r.start()
      rec.current = r
      setState("listening")
      setTimeout(() => r.state === "recording" && r.stop(), 30_000)
    } catch {
      setCaption("Microphone unavailable")
    }
  }

  async function run(clip: Blob) {
    setState("thinking")
    try {
      const form = new FormData()
      form.set("file", clip, "clip.webm")
      const { transcript } = await api<{ transcript: string }>("/api/stt", { method: "POST", body: form })
      setCaption(transcript)
      if (!transcript?.trim()) return setState("idle")
      const intent = await api<Intent>("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, pageId, map }),
      })
      onIntent(intent)
      setAnswer(intent.text)
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: intent.text }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "speech failed")
      audio.current = new Audio(URL.createObjectURL(await res.blob()))
      audio.current.onended = () => setState("idle")
      setState("speaking")
      await audio.current.play()
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "something went wrong")
      setState("idle")
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button
        size="lg"
        variant={state === "listening" ? "destructive" : "default"}
        onPointerDown={start}
        onPointerUp={() => rec.current?.state === "recording" && rec.current.stop()}
        disabled={state === "thinking"}
        aria-label="Hold to talk"
      >
        <MicIcon /> {state === "idle" ? "Hold to talk" : state}
      </Button>
      <div className="min-w-0 text-sm">
        {caption && <p className="truncate text-muted-foreground">“{caption}”</p>}
        {answer && <p className="line-clamp-2">{answer}</p>}
      </div>
    </div>
  )
}
