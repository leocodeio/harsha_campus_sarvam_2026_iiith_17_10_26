# Idea: Sarvam AI Docs Reader

## Goal
A dedicated reading experience for Sarvam AI documentation that makes the docs
easier to read, explore and understand.

## Core concept
Use a whole Sarvam-style docs page as the unit of reading. For each page the
reader can:

1. **Read** the documentation in a clean layout.
2. **Explore** related concepts, APIs and examples linked from the page.
3. **Get explanations** of any section or code sample in plain language.

## Workflow
1. Source the documentation as Markdown.
2. Render the page in a clean reading layout.
3. Add an explanation layer: select a section or snippet and get a plain-language
   explanation.
4. Keep explanations documented alongside the source so they can be reviewed and
   improved.

## Scope (v0)
- Language: English (`en`) only.
- Content: this idea only. Docs source is undecided.
- Tech stack: to be decided later.

## Open questions
- Where does the doc content come from (live Sarvam docs vs. own Markdown)?
- Which Sarvam service handles the explanations?
- Web app, static site, or an agent-driven workflow?
