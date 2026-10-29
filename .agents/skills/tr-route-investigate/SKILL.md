---
name: tr-route-investigate
description: "investigate route steps; load when route.md says route: investigate."
---
## Steps

1. Run the `CONSTRAINTS.md` checks of the touched roots. Note red; do not fix it here.
2. Load `diagnosing-bugs` with the Skill tool. Reproduce first. Write 3 to 5 falsifiable hypotheses. Mask sensitive data in everything you write.
3. Load `tr-spectex` with the Skill tool. Read failures and traces for the suspect code.
4. Several independent faults: Load `dispatching-parallel-agents` with the Skill tool, one agent per fault, read-only.
5. Write `workflow/changes/<slug>/findings.md`: question, each hypothesis with evidence for or against, cause, proposed fix route.
6. Commit it on `feat/<slug>`. It is not pushed and there is no PR.

## Ends with

`findings.md` committed on `feat/<slug>`, not pushed. The person decides the next route.

## Skip only when

- Step 4: one fault. Write `skipped: parallel agents — <reason> (<date>)` in `route.md`.

## Switch

On a switch signal, load tr-route-switch. Signals: the cause is found and the person wants the fix (start `fix`); the fix needs a design (start `feature`).

## Spectex

Load tr-spectex for the tools of this route.
