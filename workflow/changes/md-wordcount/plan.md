# Plan — md-wordcount

Test command for every task: `node --test scripts/wordcount.test.mjs`.
(Verified on Node 24.18.0: `node --test scripts/` fails with `Cannot find module`, because positional arguments are files or globs, not directories.)

Each task is TDD: write failing tests in `scripts/wordcount.test.mjs`, see them fail, implement in `scripts/wordcount.mjs`, see them pass, commit on `feat/md-wordcount`. Never push.
The regexes, order and padding rule come from spec.md Design step 4. Use them as written.

## T1 — Core count, fenced code, inline code (AC-1, AC-2, AC-3, AC-4, AC-10)

- Create `scripts/wordcount.mjs` with `export function countWords(markdown)`.
- Prepare text: strip leading BOM, normalize `\r\n` and `\r` to `\n`, `normalize('NFC')`.
- Line scanner with fence state: same character, closing length ≥ opening length, up to 3 leading spaces, unclosed fence runs to EOF.
- Join prose lines with `\n`. Apply replacement 1 (inline code span → ` `).
- Count whitespace tokens matching `/[\p{L}\p{N}]/u`.
- Tests: Vietnamese prose (NFC and NFD), empty string, CRLF equals LF, leading BOM, ```` ``` ```` and `~~~` fences, fence with info string, longer closing fence, mismatched character does not close, unclosed fence, single and double backtick spans, ``a`x`b`` → 2, unmatched backtick, punctuation-only tokens, `**đậm**` → 1.
- Commit: `feat: count words in markdown, skipping fenced and inline code`.

## T2 — Indented code and front matter (AC-5, AC-6)

- Indented code (4+ spaces or a tab) starts only at a block boundary: first body line (after front matter), after a blank line, after a closing fence, or after another indented code line.
- Front matter: line 1 is `---`, closed by `---` or `...`. No closing line: skip nothing.
- Tests: indented block after blank line, tab-indented block, indented first line of the body after front matter, indented line right after a closing fence, indented paragraph continuation counted, whitespace-only line is blank (not code), closing fence with 4 spaces does not close, front matter skipped, `...` closer, unclosed front matter `---\ntitle: x\nmột hai` → 4 (all lines count), mid-file `một\n---\nhai ba\n---\nbốn` → 4 (no skipping).
- Commit: `feat: skip indented code and front matter in wordcount`.

## T3 — Links, images, HTML, reference definitions (AC-7)

- Drop reference definition lines in the scanner.
- Apply replacements 2–7 in order, each padded with spaces.
- Tests: `[t](u)` → 1, `[t](u "title")` → 1, `[text][id]` → 1, `[a](u)[b](u)` → 2, image counts alt only, `<https://x.y>` → 0, `<a@b.com>` → 0, `foo<br>bar` → 2, `<span>x</span>` → 1, `a < b > c` → 3, multi-line comment, `` `<!--` `` in a code span does not open a comment, reference definition → 0.
- Commit: `feat: ignore urls, html and reference definitions in wordcount`.

## T4 — CLI (AC-8, AC-9)

- Main-module check: `process.argv[1]` is set and `realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)`.
- Exactly one argument; otherwise print `Usage: node scripts/wordcount.mjs <file.md>` to stderr, exit 1.
- Read with `readFile(path, 'utf8')`; print `${count}\n` to stdout, exit 0.
- Read error: `wordcount: cannot read <path>: <err.code ?? err.message>` to stderr, exit 1.
- Header comment: usage, Node ≥ 20, and the out-of-scope limitations from spec.md (including the `x<y and z>w` case).
- Tests use `spawnSync(process.execPath, [script, ...args])` and a temp file from `mkdtempSync(join(tmpdir(), 'wc-'))`:
  - valid file → stdout `N\n`, exit 0;
  - no argument → exit 1, stdout empty, stderr has `Usage`;
  - two arguments → exit 1, stdout empty;
  - missing file → exit 1, stdout empty, stderr has `cannot read`.
- Commit: `feat: add wordcount cli entry`.

## Done when

- `node --test scripts/wordcount.test.mjs` passes, and every AC from AC-1 to AC-10 has at least one test.
