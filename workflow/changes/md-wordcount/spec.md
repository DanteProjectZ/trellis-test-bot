# Spec — md-wordcount

## Goal

A Node script, `scripts/wordcount.mjs`, counts the words of one Markdown file and skips code. Tests use `node:test`.

## Fixed by the request

Quoted from `request.md`, unchanged:

- "Thêm script Node scripts/wordcount.mjs" — the file path is `scripts/wordcount.mjs`, an ES module run by Node.
- "đếm số từ của một file Markdown" — the input is one Markdown file; the output is its word count.
- "bỏ qua code block" — code blocks are not counted.
- "kèm test bằng node:test" — the tests use the built-in `node:test` runner.

## Design

One file with no dependencies. A line-based scanner splits the text into prose and code, then counts prose tokens.

1. Normalize line endings to `\n`.
2. Front matter: if line 1 is exactly `---`, skip up to the next line that is `---` or `...`. With no closing line, nothing is skipped.
3. Scan lines and track state:
   - Fence opens on `^ {0,3}(`{3,}|~{3,})`. It closes on a line of the same character, at least as long, with only whitespace after. An unclosed fence runs to end of file.
   - An indented code line starts with 4 spaces or a tab. It starts a block only after a blank line, the start of the text, or another indented code line. Inside a paragraph it is prose.
   - Reference definitions (`^ {0,3}\[[^\]]+\]:\s*\S+`) are dropped.
   - Every other line is prose.
4. Join the prose lines. Then remove, in order: HTML comments `<!-- … -->`, inline code spans (matching backtick runs), images `![alt](url)` → `alt`, links `[text](url)` → `text`, autolinks `<scheme:…>`, HTML tags `<…>`.
5. Split on whitespace. Count tokens that match `/[\p{L}\p{N}]/u`.

Public API:

- `export function countWords(markdown: string): number` — pure, no I/O.
- CLI entry runs only when the file is the main module.

## Acceptance criteria

- **AC-1** `countWords` returns the number of words in plain prose. `"Xin chào thế giới"` → `4`. An empty string → `0`.
- **AC-2** Fenced code blocks (```` ``` ```` and `~~~`, 3+ characters, up to 3 leading spaces) are not counted, including the fence lines and the info string. The closing fence must use the same character with at least the same length. An unclosed fence skips to end of file.
- **AC-3** Inline code spans, with single or multiple backticks, are not counted.
- **AC-4** A word is a whitespace-separated token with at least one Unicode letter or digit. Tokens like `-`, `#`, `>`, `—`, `|` are not counted. `**đậm**` counts as 1.
- **AC-5** Indented code blocks (4+ spaces or a tab, after a blank line or the start of the text) are not counted. An indented line that continues a paragraph is counted.
- **AC-6** Leading YAML front matter is not counted. A `---` that is not on line 1 does not start skipping.
- **AC-7** For `[text](url)` and `![alt](url)` only `text` and `alt` count. Autolinks `<https://…>`, HTML tags, HTML comments and reference definitions `[id]: url` are not counted.
- **AC-8** `node scripts/wordcount.mjs <file>` prints the count and a newline to stdout and exits with code 0.
- **AC-9** With no argument, or with a file that cannot be read, the CLI prints a one-line error to stderr, prints nothing to stdout, and exits with code 1.
- **AC-10** The tests are in `scripts/wordcount.test.mjs`, use `node:test` and `node:assert/strict`, and pass with `node --test scripts/`.

## Out of scope

- Multiple files, globs, or stdin input.
- Full CommonMark: indented code inside list items, setext edge cases, nested containers. A 4-space indented list continuation after a blank line counts as code. This limitation is documented in the script header.
- A `package.json` or a `CONSTRAINTS.md` test check.
