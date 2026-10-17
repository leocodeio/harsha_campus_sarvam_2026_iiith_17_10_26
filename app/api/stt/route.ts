import { fail, sarvam } from "@/lib/sarvam"
import { requireSession, unauthorized } from "@/lib/session"

export async function POST(request: Request) {
  if (!(await requireSession("stt"))) return unauthorized()
  try {
    const file = (await request.formData()).get("file")
    if (!(file instanceof Blob) || file.size > 3_000_000)
      return Response.json({ error: "clip missing or too large" }, { status: 413 })
    const form = new FormData()
    // Sarvam rejects codec params like "audio/webm;codecs=opus"; send the bare mime type.
    form.set("file", new Blob([file], { type: file.type.split(";")[0] || "audio/webm" }), "clip.webm")
    form.set("model", "saaras:v4")
    form.set("mode", "transcribe")
    form.set("language_code", "en-IN")
    const res = await sarvam("/speech-to-text", { method: "POST", body: form })
    const { transcript } = await res.json()
    return Response.json({ transcript })
  } catch (e) {
    return fail(e)
  }
}
