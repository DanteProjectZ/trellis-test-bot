---
name: tr-route-docs
description: "docs route steps; load when route.md says route: docs."
---
## Steps

1. Run the `CONSTRAINTS.md` checks of the touched roots. Red: stop and report.
2. Load `grilling` with the Skill tool. Ask the person who reads it and what they must do after. Record answers in `workflow/changes/<slug>/decisions.md`.
3. Write from `docs/templates/PRD.md` or `docs/templates/ADR.md` when present. Else use these headings: Context, Decision, Alternatives, Consequences (ADR); Problem, Goals, Non-goals, Requirements (PRD).
4. Run the subagent `tr-goldfish` on the new text. NOT READY: fix the text, run it again.
5. Run the markdown lint and link checks from `CONSTRAINTS.md`. Fix every finding.
6. Commit on `feat/<slug>`. Run the workflow `tr-ship` with the args JSON object (`/tr:start` step 7) (spec lens only).

## Ends with

The docs PR opened by `/tr-ship`.

## Skip only when

- Step 2: the request already names reader, purpose and content. Write `skipped: grilling — <reason> (<date>)` in `route.md`.

## Switch

On a switch signal, load tr-route-switch. Signals: the text turns out to need code changes; the doc is really a decision nobody made yet (ask the person).

## Spectex

Load tr-spectex for the tools of this route.
