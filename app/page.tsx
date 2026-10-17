import { redirect } from "next/navigation"
import { GateForm } from "@/components/gate-form"
import { ThemeToggle } from "@/components/theme-provider"
import { requireSession } from "@/lib/session"

export default async function Page() {
  if (await requireSession()) redirect("/app")
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <ThemeToggle className="fixed top-4 right-4" />
      <div className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <div>
          <h1 className="text-lg font-medium">Sarvam AI Docs Reader</h1>
          <p className="text-sm text-muted-foreground">Enter your access key to continue.</p>
        </div>
        <GateForm />
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Paste a docs link, then talk to it.</li>
          <li>Voice agent reads the docs with you and navigates for you.</li>
          <li>Hold the mic, ask — it opens pages and answers out loud.</li>
          <li>
            <a href="/demo.mp4" className="underline" target="_blank" rel="noreferrer">
              Watch live demo
            </a>
          </li>
        </ul>
      </div>
    </main>
  )
}
