---
name: tr-route-quick
description: "quick route steps; load when route.md says route: quick."
---
## Steps

1. Run the `CONSTRAINTS.md` checks of the touched roots. Red: stop and report. Do not build on red.
2. Make the change. Load `test-driven-development` with the Skill tool when it touches code with tests.
3. Run the checks again. Load `verification-before-completion` with the Skill tool before you say it is done.
4. Commit on `feat/<slug>` with a conventional message.
5. Run the workflow `tr-ship` with the args JSON object (`/tr:start` step 7) (review is correctness only on this route).

## Ends with

The PR opened by `/tr-ship`.

## Skip only when

- Step 2 test-driven-development: no code under test (text, config). Write `skipped: test-driven-development — <reason> (<date>)` in `route.md`.

## Switch

On a switch signal, load tr-route-switch. Signals: the diff passes the route ceiling (the guard's `routeCeilings`) or the "one sentence" no longer holds; two failed fixes in a row; a new dependency.

## Spectex

Load tr-spectex for the tools of this route.
