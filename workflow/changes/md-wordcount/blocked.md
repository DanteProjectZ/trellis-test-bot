reason: credential_needed

## What happened

`tr-ship` passed check and review (0 Required findings). The push was rejected by GitHub:

```
! [remote rejected] 6098442 -> feat/md-wordcount (refusing to allow an OAuth App to create or update workflow `.github/workflows/trellis.yml` without `workflow` scope)
```

## Why

The branch is stacked on local `main`, which has 3 unpushed trellis install commits (0b2b91b, 1ff8b8b, 3f15e94).
Those commits change `.github/workflows/trellis.yml`.
The push credential has no `workflow` scope, so GitHub refuses any push that touches a workflow file.

## Options

1. Recommended: push the 3 install commits to `origin/main` yourself, with a credential that has `workflow` scope. Then rebase `feat/md-wordcount` onto `origin/main` and ship again. The PR then holds only the word count change.
2. Give the trellis push credential the `workflow` scope, then ship again. The PR will also carry the trellis upgrade.

To continue: do option 1 or 2, then say "continue".

## Answer

