---
name: tr-route-spike
description: "spike route steps; load when route.md says route: spike."
---
## Steps

1. Run the `CONSTRAINTS.md` checks of the touched roots. Red: stop and report.
2. Cut `spike/<slug>` from this branch (`git switch -c spike/<slug>`). Load `prototype` with the Skill tool. Write the question you must answer at the top of `workflow/changes/<slug>/spike.md`.
3. Write throwaway code on `spike/<slug>`. One run command, no stored data, no real credentials.
4. Run it. Finish `spike.md` with: question, answer, evidence (the command and its output), what to keep.
5. Commit the code and `spike.md` on `spike/<slug>`.
6. Run the workflow `tr-ship` with the args JSON object (`/tr:start` step 7) and `spike: true`. It opens a draft PR labelled `spike`.

## Ends with

`spike.md` and a draft PR labelled `spike`, which the guard refuses to merge. Keep-worthy code goes into a new `feature` route.

## Skip only when

- Step 3: the answer needs no code (reading, measuring). Write `skipped: code — <reason> (<date>)` in `route.md`.

## Switch

On a switch signal, load tr-route-switch. Signals: the answer is yes and the person wants it shipped (start `feature`); a new dependency.

## Spectex

Load tr-spectex for the tools of this route.
