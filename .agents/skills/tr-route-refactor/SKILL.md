---
name: tr-route-refactor
description: "refactor route steps; load when route.md says route: refactor."
---
## Steps

1. Run the `CONSTRAINTS.md` checks of the touched roots. Red: stop and report. Do not refactor on red.
2. Load `tr-spectex` with the Skill tool. Get the blast radius, callers and contracts of what you will move. Write them in `workflow/changes/<slug>/scope.md`.
3. Tests go on `feat/<slug>-tests`, cut from the target branch (`git switch -c feat/<slug>-tests refs/heads/<target_branch>`). Write characterization tests that pass on base and pin today's behaviour for every caller found. Commit them alone, with `route.md` and `scope.md`.
4. Run the workflow `tr-ship` for that branch: tests only, so red then green does not apply. It opens the tests PR, its own PR.
5. Stop. Ask the person to merge the tests PR. Say once: "Context is large; you can type /clear and then /tr:start <slug> to continue with a fresh context — everything is in workflow/changes/<slug>/." `/tr:start <slug>` then continues: fetch, and cut `feat/<slug>` from the fetched base (`git switch -c feat/<slug> refs/remotes/origin/<target_branch>`). It has no commits yet: an empty one of that name goes first (`git branch -d`).
6. Refactor in small steps. Run the characterization tests after each step and commit it. Never edit those tests.
7. Run the checks. Run the workflow `tr-ship` with the args JSON object (`/tr:start` step 7); the review adds the behaviour-unchanged axis.

## Ends with

Two PRs: the tests first, then the refactor.

## Skip only when

- Step 3: the code already has tests covering every caller. Write `skipped: characterization tests — <reason> (<date>)` in `route.md`, and go to step 6.

## Switch

On a switch signal, load tr-route-switch. Signals: a characterization test needs a change to pass; the behaviour has to change; a new dependency.

## Spectex

Load tr-spectex for the tools of this route.
