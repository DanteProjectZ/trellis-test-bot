---
slug: md-wordcount
route: feature
rounds: 1
open_required: 0
base: 3f15e942aaf4928eee82b8fa10823324671bdc8d
head: 43c022cf4a85437504a1f03757ff367ac24f58ed
lenses: [correctness, security]
---

# Review md-wordcount

## Cần bạn quyết

Nothing blocks the merge. One optional choice: fix the Nit r1.1 now, or accept it and add an input size limit later.

## Tóm tắt

- Round 1 ran the correctness and security lenses. No required finding is open.
- One Nit remains: the link regexes in `scripts/wordcount.mjs` take quadratic time on input with many unclosed `[`.
- No earlier review exists in `workflow/changes/`, so no repeated finding.

## Kiểm gì trước khi merge

- Run `node -e "import('./scripts/wordcount.mjs').then(m=>{console.time('t');m.countWords('['.repeat(80000));console.timeEnd('t')})"` and expect about 4.6 s before a fix.
- Decide whether the CLI may receive untrusted Markdown. If not, the Nit can wait.

## Findings

| # | Severity | Lens | Where | Claim | Status |
|---|----------|------|-------|-------|--------|
| r1.1 | Nit | security | scripts/wordcount.mjs:34 | Link regexes on lines 34-35 are O(n^2) on many unclosed `[`; 80000 chars took 4663 ms. Fix: stop each scan at the next `[` or newline, e.g. `\[([^\[\]\n]*)\]\(([^()\n]*)\)`. Optionally cap CLI input size. | open |
