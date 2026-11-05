# Plan — md-wordcount

Test command for every task: `node --test scripts/`.
Each task is TDD: write failing tests in `scripts/wordcount.test.mjs`, see them fail, implement in `scripts/wordcount.mjs`, see them pass, commit on `feat/md-wordcount`. Never push.

## T1 — Core count, fenced code, inline code (AC-1, AC-2, AC-3, AC-4, AC-10)

- Create `scripts/wordcount.mjs` with `export function countWords(markdown)`.
- Normalize line endings. Add the line scanner with fence state: same character, closing length ≥ opening length, up to 3 leading spaces, unclosed fence runs to EOF.
- Remove inline code spans with matching backtick runs from the joined prose.
- Count tokens matching `/[\p{L}\p{N}]/u`.
- Tests: Vietnamese prose, empty string, ```` ``` ```` and `~~~` fences, fence with info string, longer closing fence, mismatched character not closing, unclosed fence, single and double backtick spans, punctuation-only tokens, `**đậm**`.
- Commit: `feat: count words in markdown, skipping fenced and inline code`.

## T2 — Indented code and front matter (AC-5, AC-6)

- Indented code: 4+ spaces or a tab, only after a blank line, the start, or another indented code line.
- Front matter: line 1 is `---`, closed by `---` or `...`. No closing line: skip nothing.
- Tests: indented block after blank line, tab-indented block, indented paragraph continuation counted, front matter skipped, unclosed front matter counted, `---` mid-file counted as prose (thematic break, zero words).
- Commit: `feat: skip indented code and front matter in wordcount`.

## T3 — Links, images, HTML, reference definitions (AC-7)

- Drop reference definition lines in the scanner.
- In the joined prose, remove HTML comments (multi-line), then images → alt, links → text, autolinks, HTML tags.
- Tests: link counts text only, image counts alt only, autolink not counted, `<br>` and `<span>x</span>` (x counts), multi-line comment, reference definition.
- Commit: `feat: ignore urls, html and reference definitions in wordcount`.

## T4 — CLI (AC-8, AC-9)

- Main-module check: `import.meta.url === pathToFileURL(process.argv[1]).href`.
- Read the file with `readFile(path, 'utf8')`. Print `${count}\n` to stdout.
- Missing argument: `Usage: node scripts/wordcount.mjs <file.md>` on stderr, exit 1. Read error: `wordcount: cannot read <path>: <code>` on stderr, exit 1.
- Add a header comment with usage and the known limitation (indented list continuations).
- Tests: spawn `process.execPath` with `child_process.spawnSync` on a temp file under `os.tmpdir()` (count + exit 0), no argument (exit 1, empty stdout), missing file (exit 1, stderr message).
- Commit: `feat: add wordcount cli entry`.

## Done when

- `node --test scripts/` passes and every AC-1 … AC-10 has a test.
