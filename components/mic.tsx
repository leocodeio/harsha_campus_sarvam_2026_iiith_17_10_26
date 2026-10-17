"use client"

import { useRef, useState } from "react"
import { Loader2Icon, MicIcon, Volume2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Intent, SiteMap } from "@/lib/types"

export async function api<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (res.status === 401) location.reload() // server redirects to the gate
  if (!res.ok)
    throw new Error(
      (await res.json().catch(() => null))?.error ?? "request failed"
    )
  return res.json()
}

export function Mic({
  map,
  pageId,
  onIntent,
}: {
  map: SiteMap
  pageId?: string
  onIntent: (i: Intent) => void
}) {
  const [state, setState] = useState<
    "idle" | "listening" | "thinking" | "speaking"
  >("idle")
  const [caption, setCaption] = useState("")
  const [answer, setAnswer] = useState("")
  const rec = useRef<MediaRecorder | null>(null)
  const audio = useRef<HTMLAudioElement | null>(null)
  const held = useRef(false)

  async function start() {
    held.current = true
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
      if (!held.current) r.stop() // released before the mic opened
    } catch {
      setCaption("Microphone unavailable")
    }
  }

  async function run(clip: Blob) {
    setState("thinking")
    try {
      const form = new FormData()
      form.set("file", clip, "clip.webm")
      const { transcript } = await api<{ transcript: string }>("/api/stt", {
        method: "POST",
        body: form,
      })
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
      if (!res.ok)
        throw new Error(
          (await res.json().catch(() => null))?.error ?? "speech failed"
        )
      audio.current = new Audio(URL.createObjectURL(await res.blob()))
      audio.current.onended = () => setState("idle")
      setState("speaking")
      await audio.current.play()
    } catch (e) {
      setAnswer(e instanceof Error ? e.message : "something went wrong")
      setState("idle")
    }
  }

  const stop = () => {
    held.current = false
    if (rec.current?.state === "recording") rec.current.stop()
  }
  const Icon =
    state === "thinking"
      ? Loader2Icon
      : state === "speaking"
        ? Volume2Icon
        : MicIcon
  const label = {
    idle: "Hold to talk",
    listening: "Listening… release to send",
    thinking: "Thinking…",
    speaking: "Speaking",
  }[state]

  return (
    <div className="pointer-events-none fixed right-6 bottom-6 z-50 flex items-end gap-4">
      {(caption || answer || state !== "idle") && (
        <div className="pointer-events-auto mb-2 w-80 max-w-[calc(100vw-9rem)] space-y-2 rounded-2xl border bg-background/95 p-4 text-sm shadow-xl backdrop-blur">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </p>
          {caption && (
            <p className="text-muted-foreground italic">“{caption}”</p>
          )}
          {answer && (
            <p className="max-h-40 overflow-y-auto leading-relaxed">{answer}</p>
          )}
        </div>
      )}
      <div className="pointer-events-auto flex flex-col items-center gap-2">
        <button
          type="button"
          onPointerDown={start}
          onPointerUp={stop}
          onPointerLeave={stop}
          onContextMenu={(e) => e.preventDefault()}
          disabled={state === "thinking"}
          aria-label="Hold to talk"
          className={cn(
            "relative flex size-20 touch-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition select-none hover:scale-105 active:scale-95 disabled:opacity-70",
            state === "listening" && "scale-110 bg-destructive text-white"
          )}
        >
          {state === "listening" && (
            <span className="absolute inset-0 animate-ping rounded-full bg-destructive/40" />
          )}
          <Icon
            className={cn(
              "relative size-8",
              state === "thinking" && "animate-spin"
            )}
          />
        </button>
        <span className="rounded-full bg-background/90 px-2 py-0.5 text-xs text-muted-foreground shadow">
          {state === "idle" ? "Hold to talk" : state}
        </span>
      </div>
    </div>
  )
}
