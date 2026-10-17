import { NextResponse, type NextRequest } from "next/server"

// Optimistic presence check only; route handlers verify the signature via requireSession().
export function proxy(request: NextRequest) {
  if (request.cookies.has("sess")) return NextResponse.next()
  if (request.nextUrl.pathname.startsWith("/api/"))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  return NextResponse.redirect(new URL("/", request.url))
}

export const config = { matcher: ["/app/:path*", "/api/:path*"] }
