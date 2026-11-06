---
name: tr-route-docs
description: "docs route steps; load when route.md says route: docs."
---
## Steps

1. Run the `CONSTRAINTS.md` checks of the touched roots. Red: stop and report.
2. Load `grilling` with the Skill tool. Ask who reads it, what they do after. Record answers in `workflow/changes/<slug>/grill.md`, not `decisions.md`. List what only the person can do (installs, accounts, downloads, keys; never paste secrets) in ONE message; keep working.
3. Write from `docs/templates/PRD.md` or `docs/templates/ADR.md` when present. Else headings: Context, Decision, Alternatives, Consequences (ADR); Problem, Goals, Non-goals, Requirements (PRD).
4. Run subagent `tr-goldfish` on the new text. NOT READY: fix, run again.
5. Run the `CONSTRAINTS.md` lint and link checks; fix findings.
6. Choices a later session must not undo (up to 3 lines `YYYY-MM-DD · decision · why · file`; none is fine) go in `workflow/changes/<slug>/decisions.md`, in English.
7. Commit on `feat/<slug>`. Run workflow `tr-ship` with the args JSON object (`/tr:start` step 7) (spec lens only).

## Ends with

The docs PR opened by `/tr-ship`.

## Skip only when

- Step 2: the request already names reader, purpose and content. Write `skipped: grilling — <reason> (<date>)` in `route.md`.

## Switch

On a switch signal, load tr-route-switch. Signals: the text turns out to need code changes; the doc is really a decision nobody made yet (ask the person).

## Spectex

Load tr-spectex for the tools of this route.
