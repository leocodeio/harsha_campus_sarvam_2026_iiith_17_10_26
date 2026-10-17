# Project Design — Next.js (v1, improvising)

> Living doc. We will keep improvising. For now: Next.js only.

## 1. Stack (for now)
- **Framework:** Next.js (App Router, TypeScript)
- **Package manager:** pnpm
- **UI base:** shadcn — `pnpm dlx shadcn@latest init --preset b7Uc9EOwq --template next`
- **Styling:** Tailwind CSS (comes with preset/template)
- **Lint/Format:** default from template (improvise later)

## 2. Goal (placeholder — improvise)
- Scaffold full codebase via shadcn preset `b7Uc9EOwq` + `next` template.
- Keep it minimal and runnable: `pnpm dev`.
- Iterate on pages/components after scaffold.

## 3. Status (done 2026-10-17, moved to root 2026-10-17)
- Scaffolded via:
  ```bash
  pnpm dlx shadcn@latest init --preset b7Uc9EOwq --template next --name next-app
  cd next-app
  pnpm install
  pnpm dlx shadcn@latest init --preset b7Uc9EOwq --force --yes
  pnpm dlx shadcn@latest add button --yes
  ```
- Moved to standalone root: `mv next-app/* ./`, merged `AGENTS.md` (kept `@.agents/AGENTS.md` + Next.js managed block), `rm -rf next-app`.
- Verified: `pnpm typecheck` ✅, `pnpm lint` ✅, `pnpm build` ✅ (Next 16.4.0, App Router).
- Stack actual: Next 16.4.0, React 19.3.0, Tailwind v4, shadcn base-nova/taupe, next-themes.
- Run: `pnpm dev` (from repo root).

## 4. Scaffold command
```bash
pnpm dlx shadcn@latest init --preset b7Uc9EOwq --template next
```

## 5. Notes
- This MD is intentionally thin. Expand as we decide features/routes/design.
- Do not gold-plate. Smallest working change wins (see `AGENTS.md`).
- See also: `idea.md` (product idea).
