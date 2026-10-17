"use client"

import { useActionState } from "react"
import { unlock } from "@/app/actions"
import { Button } from "@/components/ui/button"

export function GateForm() {
  const [error, action, pending] = useActionState(unlock, null)
  return (
    <form action={action} className="space-y-3">
      <input
        name="key"
        type="password"
        placeholder="Access key"
        aria-label="Access key"
        required
        autoFocus
        className="h-9 w-full rounded-lg border bg-transparent px-3 text-sm outline-none focus:ring-2 focus:ring-ring/50"
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Checking…" : "Unlock"}
      </Button>
    </form>
  )
}
