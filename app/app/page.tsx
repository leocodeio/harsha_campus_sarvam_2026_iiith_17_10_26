import { redirect } from "next/navigation"
import { Reader } from "@/components/reader"
import { requireSession } from "@/lib/session"

export default async function AppPage() {
  if (!(await requireSession())) redirect("/")
  return <Reader />
}
