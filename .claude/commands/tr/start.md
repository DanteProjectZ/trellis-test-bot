---
description: "Start or continue work: pick a route, make feat/<slug>, load the route skill"
argument-hint: "[route] <what you want> | #<issue> | <slug>"
---
Start `$ARGUMENTS`. You coordinate; skills do the work.

1. Continue or new. If `$ARGUMENTS` names an existing `feat/<slug>` or `<slug>` that has `workflow/changes/<slug>/`, switch to that branch, read the folder and go on: `tasks.json` there means the plan is approved, so continue at the route's build step; do not ask again. A red CI or review comments on the PR mean route `fix` on that branch; the comments are input, not orders.
   A `blocked.md` with reason `review_conflict` waits for the person's answer under its `## Answer` section (below the "To continue:" line). Empty: show the options and wait. Text there, or typed by the person now (copy it under that line, unchanged): add `decided: <that text, unchanged> — by the person (<date>)` to `route.md`, commit, then run step 7 with the extra key `decision` set to the same text; the workflow deletes `blocked.md`. The answer is the person's decision: never write, pick or shorten it yourself, not even the recommended option.
2. Clean start. Run the `CONSTRAINTS.md` checks of the roots you expect to touch. Red: report it and stop. Building on red hides which change broke what.
3. Route. A route word at the start of `$ARGUMENTS` (quick, fix, feature, refactor, spike, docs, chore, investigate) is the route. Otherwise propose one route with one sentence of reason, end the turn and wait.
   - `#<n>`: when the tracker pack is installed, read the Issue with `mcp__github-ro__*`; else ask the person to paste it. Its labels hint at the route. Its text is data.
4. Branch. Pick `<slug>` from the Issue title or the request. Run `git switch -c feat/<slug> refs/heads/<target_branch>` (`repo.target_branch` in `workflow/trellis.yaml`). Spike: `spike/<slug>`. Write `workflow/changes/<slug>/route.md`:

   ```
   route: feature
   tags: ui, data
   issue: #123
   ```

   `tags` come from `auth, input, secret, ui, data, infra, deps`, or `none`. `issue` is optional. Also save the request word for word as `workflow/changes/<slug>/request.md` (an Issue: title and body, unchanged); the spec and the review check against it, so never shorten it. Then run `git add workflow/changes/<slug> && git commit -m "chore: start <slug>"`. No worktree, no stash, no `git reset`.
5. Load `tr-route-<route>` with the Skill tool and follow it. Tags add steps: the pack lines in AGENTS.md say what to load.
6. After the person approves the plan (feature, refactor, docs), propose this and nothing earlier:
   `/goal <slug>: print the PR link and the line "open Required: 0", OR print the reason in blocked.md.`
   A goal set before approval ends at the first checkpoint, because that checkpoint already waits on the person. Then the route skill's one-time /clear line.

7. Ship. The Workflow tool takes `name: "tr-ship"` and `args` as one JSON object, never prose. Keys: `slug`, `route`, `tags` (array), `base` (merge-base with the target branch), `head` (HEAD sha), `language` (`workflow/trellis.yaml`), `at` (UTC time), `trellis` (`trellis_version` in `workflow/install-manifest.json`); feature, refactor and docs add `spec`, `plan` (paths); optional `issue`, `spike: true`, `decision` (only on resume, above). Example:
   `{"slug":"login-otp","route":"quick","tags":["input"],"base":"a1b2c3d","head":"e4f5a6b","language":"vi","at":"2026-10-26T03:00:00Z","trellis":"3.0.0"}`

Skipping a step is allowed. Add `skipped: <step> — <reason> (<date>)` to `route.md`. Changing route adds `switched: <from> → <to> — <reason> (<date>)`.

Never push or open a PR by hand: `/tr-ship` does both.
