# Agent Guidelines

## Minimal code
Write as little code as possible. Prefer the smallest change that solves the
problem: no speculative abstractions, no extra dependencies, no unused
scaffolding. Delete more than you add when possible.

## Speed
Complete tasks as fast as possible. Take the shortest path to a working
result: avoid over-planning, skip unnecessary steps, and don't gold-plate.
Working fast matters more than making it perfect on the first pass.

## Docs
- Design: `./DESIGN.md` (Next.js stack, living doc — improvise).
- Idea: `./idea.md` (product idea).


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
