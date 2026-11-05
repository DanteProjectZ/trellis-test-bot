---
paths:
  - "workflow/changes/**/acceptance.html"
---

# Acceptance page

1. Load `archify` with the Skill tool.
2. `T=$(mktemp -d)`. Write the draft to `$T/c.archify.md`, in plain words and the `language` of `workflow/trellis.yaml`: what changed, how to try it, what you chose alone, evidence per AC-n citing commands you actually ran with their output, what was not checked (environments not run, every `skipped:` line of `route.md`).
3. Finalize inside the temp dir: `node ~/.claude/skills/archify/bin/archify.mjs finalize explainer "$T/c.archify.md" "$T/acceptance.html" --repo-root "$PWD" --json`
4. Copy only the page: `cp "$T/acceptance.html" workflow/changes/<slug>/`. Never leave Archify's receipt files in the repo.
5. Commit that one file (`docs: acceptance <slug>`) before reading HEAD for `tr-ship`.
6. On any failure: write `skipped: acceptance — <reason> (<date>)` in `route.md`, commit `route.md`, and ship anyway.
