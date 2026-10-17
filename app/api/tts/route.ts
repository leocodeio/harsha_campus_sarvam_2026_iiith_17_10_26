import { fail, sarvam } from "@/lib/sarvam"
import { requireSession, unauthorized } from "@/lib/session"

export async function POST(request: Request) {
  if (!(await requireSession("tts"))) return unauthorized()
  try {
    const { text } = await request.json()
    const res = await sarvam("/text-to-speech/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: String(text).slice(0, 3500),
        language_code: "en-IN",
        model: "bulbul:v4-flash",
        speaker: "simran_en_customer",
        output_audio_codec: "mp3",
      }),
    })
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg" } })
  } catch (e) {
    return fail(e)
  }
}
