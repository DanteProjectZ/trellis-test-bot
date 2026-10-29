---
name: tr-route-switch
description: "Change route mid-way with a recorded reason; load when a route skill says a switch signal fired."
---
## Signals

| Signal | Action |
|---|---|
| Diff passes the route ceiling (the guard's `routeCeilings`, see its `route_ceiling` item) | Switch to `feature`: add `spec.md`, run `tr-goldfish`, get plan approval. |
| UI files touched | Load the ui pack lines of AGENTS.md. |
| Schema touched | Load the data pack lines of AGENTS.md. |
| New dependency | Researcher step: run `/deep-research`, write `research.md` with 3 to 5 options, links, licence, fit. The person picks. |
| A fix failed twice in a row | Switch to `investigate`. |
| A plan assumption is wrong | Write `blocked.md` with reason `plan_wrong`. Stop and ask the person. |
| A feature is really one sentence | Switch to `quick`. |

## Record

On every route change, append this line to `workflow/changes/<slug>/route.md` and commit it, before any other work:

`switched: <from> → <to> — <reason> (<date>)`

Then load `tr-route-<to>` with the Skill tool and carry on from its first step. Keep commits already made. Never switch silently, and never switch to hide a red check.
