import { redirect } from "next/navigation"
import { GateForm } from "@/components/gate-form"
import { requireSession } from "@/lib/session"

export default async function Page() {
  if (await requireSession()) redirect("/app")
  return (
    <main className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border p-6">
        <div>
          <h1 className="text-lg font-medium">Sarvam AI Docs Reader</h1>
          <p className="text-sm text-muted-foreground">Enter your access key to continue.</p>
        </div>
        <GateForm />
      </div>
    </main>
  )
}
