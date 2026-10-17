"use server"

import { redirect } from "next/navigation"
import { clearSession, matchKey, startSession } from "@/lib/session"

export async function unlock(_: string | null, form: FormData) {
  const label = matchKey(String(form.get("key") ?? "").trim())
  if (!label) {
    await new Promise((r) => setTimeout(r, 800))
    return "invalid access key"
  }
  await startSession(label)
  redirect("/app")
}

export async function logout() {
  await clearSession()
  redirect("/")
}
