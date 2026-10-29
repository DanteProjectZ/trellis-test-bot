---
name: tr-route-feature
description: "feature route steps; load when route.md says route: feature."
---
## Steps

1. Run the `CONSTRAINTS.md` checks of the touched roots. Red: stop and report. Do not build on red.
2. Vague request: Load `grilling` with the Skill tool. Ask the person; record answers in `workflow/changes/<slug>/decisions.md`.
3. Load `brainstorming` with the Skill tool. Compare directions; the person picks one. Save the design as `workflow/changes/<slug>/spec.md` with numbered `AC-n` criteria. Its section `## Fixed by the request` quotes from `request.md`, unchanged, every part marked fixed, interface, must or exact, and every name, signature, type, file path, return shape and number. A deviation is a question to the person at the plan checkpoint, never a silent change.
4. Load `writing-plans` with the Skill tool. Save as `workflow/changes/<slug>/plan.md`. Commit after each task on `feat/<slug>`; never push.
5. Tags: `ui` and `data` load the steps in the pack lines of AGENTS.md. `deps` (new dependency): compare 3 options and licences in `research.md`.
6. Run the subagent `tr-goldfish` on `spec.md` and `plan.md`. NOT READY: fix the text, run it again.
7. Stop. Ask the person to approve the plan in chat; list every deviation from `request.md` first. Then write `workflow/changes/<slug>/tasks.json` from `plan.md` (tasks.v1: `{"schemaVersion":1,"slug":…,"tasks":[{"id":"T1","title":…,"ac":["AC-1"],"passes":false}]}`). Afterwards only flip `passes` from `false` to `true`, never another field. Then propose the `/goal` line from `/tr:start`. Say once: "Context is large; you can type /clear and then /tr:start <slug> to continue with a fresh context — everything is in workflow/changes/<slug>/."
8. Load `subagent-driven-development` with the Skill tool, and `test-driven-development` for each task. No worktree.
9. Load `verification-before-completion`, then run `/verify`. Every `AC-n` needs a test or evidence.
10. Archify installed: write `acceptance.html` now, so it is in the PR diff.
11. Run the workflow `tr-ship` with the args JSON object (`/tr:start` step 7).

## Ends with

The PR opened by `/tr-ship`, with `spec.md` and `plan.md` in the diff.

## Skip only when

Whenever a step is skipped, write a `skipped: <step> — <reason> (<date>)` line in `route.md`.

- Step 2: the request is already precise.
- Step 3 brainstorming: one reasonable direction. Write `skipped: brainstorming — <reason> (<date>)` in `route.md`.

## Switch

On a switch signal, load tr-route-switch. A plan assumption turned out wrong: write `blocked.md` with `plan_wrong` and stop.

## Spectex

Load tr-spectex for the tools of this route.
