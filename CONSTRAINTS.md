# CONSTRAINTS

This file holds the commands that decide whether a change is good: install, lint, test, build. It also lists the hosts the checks may reach and the optional end-to-end command.
CI and the agent run the same commands. A failing check stops the work.
Changes to this file need the repo owner's review (CODEOWNERS).

```yaml trellis-constraints
schemaVersion: 2
root: .
adapter: null
variant: null
install: null
checks: {}
test_files: null
test_globs: []
network_allow: []
sensitive_paths: []
e2e: null
```
