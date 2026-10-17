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

## 3. Next steps
1. Run scaffold command (below).
2. `pnpm dev` — verify.
3. Improvise: pages, components, data, auth, etc. (TBD).

## 4. Scaffold command
```bash
pnpm dlx shadcn@latest init --preset b7Uc9EOwq --template next
```

## 5. Notes
- This MD is intentionally thin. Expand as we decide features/routes/design.
- Do not gold-plate. Smallest working change wins (see `.agents/AGENTS.md`).
