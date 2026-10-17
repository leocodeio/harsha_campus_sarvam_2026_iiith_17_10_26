import { createHmac, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

const NAME = "sess"
const MAX_AGE = 60 * 60 * 12

const sign = (s: string) => {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET missing")
  return createHmac("sha256", secret).update(s).digest("base64url")
}
// Constant-time compare of arbitrary strings (hash both to equal length first).
const same = (a: string, b: string) =>
  timingSafeEqual(Buffer.from(sign(a)), Buffer.from(sign(b)))

const accessKeys = () =>
  (process.env.ACCESS_KEYS ?? "")
    .split(",")
    .map((p) => p.trim().split(":"))
    .filter(([label, key]) => label && key)
    .map(([label, key]) => ({ label, key }))

export function matchKey(input: string) {
  let found: string | null = null
  for (const { label, key } of accessKeys()) if (same(input, key)) found = label
  return found
}

export async function startSession(label: string) {
  const payload = Buffer.from(JSON.stringify({ label, exp: Date.now() + MAX_AGE * 1000 })).toString("base64url")
  ;(await cookies()).set(NAME, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  })
}

export async function clearSession() {
  ;(await cookies()).delete(NAME)
}

/** Returns the session label if the cookie is valid, unexpired and the label is still issued. */
export async function requireSession(route?: string) {
  const [payload, sig] = ((await cookies()).get(NAME)?.value ?? "").split(".")
  if (!payload || !sig || !same(sig, sign(payload))) return null
  try {
    const { label, exp } = JSON.parse(Buffer.from(payload, "base64url").toString())
    if (Date.now() > exp || !accessKeys().some((k) => k.label === label)) return null
    if (route) console.log(`[${route}] ${label}`)
    return label as string
  } catch {
    return null
  }
}

export const unauthorized = () => Response.json({ error: "unauthorized" }, { status: 401 })
