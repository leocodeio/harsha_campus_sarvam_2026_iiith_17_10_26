import { fail, sarvam } from "@/lib/sarvam"
import { requireSession, unauthorized } from "@/lib/session"

export const maxDuration = 60

const DOC = "/doc-ai/v1/job"

// Start a Sarvam Vision digitise job for a PDF (<= 10 pages). The client polls GET.
export async function POST(request: Request) {
  if (!(await requireSession("study"))) return unauthorized()
  try {
    const file = (await request.formData()).get("file")
    if (!(file instanceof Blob) || file.size > 4_000_000)
      return Response.json({ error: "PDF missing or too large" }, { status: 413 })
    const form = new FormData()
    form.set("file", file, "docs.pdf")
    form.set("language", "en-IN")
    const { job_id } = await (await sarvam(`${DOC}/digitise`, { method: "POST", body: form })).json()
    return Response.json({ job: job_id })
  } catch (e) {
    return fail(e)
  }
}

export async function GET(request: Request) {
  if (!(await requireSession())) return unauthorized()
  try {
    const job = encodeURIComponent(new URL(request.url).searchParams.get("job") ?? "")
    const { status, usage } = await (await sarvam(`${DOC}/${job}/status`, {})).json()
    if (!["completed", "partially_completed", "failed", "rejected"].includes(status))
      return Response.json({ status, done: usage?.pages_processed ?? 0, total: usage?.pages_total ?? 0 })
    if (status === "failed" || status === "rejected") return Response.json({ error: `job ${status}` }, { status: 422 })
    const results = await (await sarvam(`${DOC}/${job}/results?format=md`, {})).json()
    const pages: string[] = (results.documents ?? []).flatMap((d: { pages: { content: string }[] }) =>
      d.pages.map((p) => p.content)
    )
    return Response.json({ status, pages })
  } catch (e) {
    return fail(e)
  }
}
