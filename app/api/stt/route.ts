import { fail, sarvam } from "@/lib/sarvam"
import { requireSession, unauthorized } from "@/lib/session"

export async function POST(request: Request) {
  if (!(await requireSession("stt"))) return unauthorized()
  try {
    const file = (await request.formData()).get("file")
    if (!(file instanceof Blob) || file.size > 3_000_000)
      return Response.json({ error: "clip missing or too large" }, { status: 413 })
    const form = new FormData()
    form.set("file", file, "clip.webm")
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
