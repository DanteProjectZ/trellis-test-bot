---
slug: wordcount-long-line-hang
route: fix
rounds: 2
open_required: 0
base: a2cc9a379d71ef0522f1a14b3c54128a1d075207
head: 2af8057
lenses: [correctness, security]
---

# Review wordcount-long-line-hang

## Cần bạn quyết

Nothing blocks the merge. No finding is open.

## Tóm tắt

- Round 1 ran the correctness and security lenses and found 2 Required findings.
- r1.1 (URL class changed to `[^()]*`) was refuted by the skeptic round. No change was needed.
- r1.2 (`CODE_SPAN` regex slow on many unclosed backtick runs) is fixed by commit 2af8057, a linear scan. Test 67e9d4a covers it.
- Round 2 left no Required finding open.
- One finding repeats an earlier one. See Lỗi lặp lại.

## Kiểm gì trước khi merge

- Run the check commands in `CONSTRAINTS.md` and expect them to pass.
- Run the wordcount tests and confirm the long-line cases finish fast, including many unclosed backtick runs of distinct lengths.
- Compare counts for `[a](u "t (x)") end` and `![alt](pic_(1).png) end` between a2cc9a3 and head. The refuted r1.1 claimed a difference.

## Findings

| # | Severity | Lens | Where | Claim | Status |
|---|----------|------|-------|-------|--------|
| r1.1 | Required | correctness | scripts/wordcount.mjs:37 | The fix changed link and image URL matching from `[^)]*` to `[^()]*`. A URL or title containing `(` no longer matches, so the link is not stripped and its words are counted. This is a behaviour change outside a fix for a hang. | refuted |
| r1.2 | Required | security | scripts/wordcount.mjs:28 | `CODE_SPAN` still slows down badly on one long line with many unclosed backtick runs of different lengths, so the targeted hang can still be triggered. Fix: replace the regex with a linear left-to-right scan. | fixed |

## Lỗi lặp lại

- r1.2 repeats an earlier finding: md-wordcount r1.1 (Nit, `scripts/wordcount.mjs:34`): link regexes are O(n^2) on many unclosed `[`. The seed-lessons lesson (Required, line 34) says the same.
- r1.2 claim: `CODE_SPAN` still slows down badly on one long line with many unclosed backtick runs of different lengths, so the hang this fix targets can still be triggered.
- Line for AGENTS.md, to add on the target branch:

```
## Claude gets wrong
- Regex on user text with an unclosed opener (`[`, `(`, backtick run) backtracks to the end of the line for each opener; use a linear scan, and test many unclosed openers of distinct lengths.
```
