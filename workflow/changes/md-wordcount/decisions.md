# Decisions — md-wordcount

All answered "yes" (recommended option) by the person on 2026-11-05.

| # | Question | Decision |
|---|----------|----------|
| Q1 | What counts as a code block | Fenced (```` ``` ```` or `~~~`) and indented (4 spaces or tab) blocks are skipped. An unclosed fence runs to end of file (CommonMark). |
| Q2 | Inline code | Inline code spans (backticks) are skipped. |
| Q3 | Definition of a word | A whitespace-separated token with at least one Unicode letter or digit, after removing Markdown syntax and link URLs. Link text counts; punctuation-only tokens do not. |
| Q4 | YAML front matter | A leading `---` … `---` front matter block is skipped. |
| Q5 | CLI interface | `node scripts/wordcount.mjs <file.md>` prints only the number. Missing argument or unreadable file: error on stderr, exit 1. The module also exports a pure `countWords(markdown)`. |
| Q6 | Tests | `scripts/wordcount.test.mjs`, run with `node --test scripts/`. No `package.json`. No `CONSTRAINTS.md` change in this branch. |

## Facts found

- The repo has no `package.json` and no `scripts/` folder.
- Node 24.18.0 is installed.
- `CONSTRAINTS.md` has `checks: {}`, so CI does not run tests yet.
