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

1. Prepare the text: strip one leading BOM (`U+FEFF`), normalize line endings (`\r\n` and `\r`) to `\n`, and normalize Unicode to NFC.
2. Front matter: if line 1 is exactly `---`, skip up to the next line that is `---` or `...`. With no closing line, nothing is skipped.
3. Scan lines and track state:
   - A **blank line** is empty or contains only spaces and tabs. A blank line is never an indented code line.
   - Fence opens on `^ {0,3}(`{3,}|~{3,})`. It closes on a line with up to 3 leading spaces, then a run of the same character at least as long, then only whitespace (regex `^ {0,3}<run>[ \t]*$`). A line with 4+ leading spaces inside a fence does not close it. An unclosed fence runs to end of file.
   - An indented code line starts with 4 spaces or a tab. It starts a block only at a **block boundary**: the first line of the body (after front matter, if any), the line after a blank line, the line after a closing fence, or the line after another indented code line. Elsewhere, inside a paragraph, it is prose.
   - Reference definitions (`^ {0,3}\[[^\]]+\]:\s*\S+`) are dropped.
   - Every other line is prose.
4. Join the prose lines with `\n`. Then apply these replacements, in this order. Every replacement is padded with one space on each side, so it never glues two words together.

   | # | What | Regex | Replaced by |
   |---|------|-------|-------------|
   | 1 | Inline code span | ``/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g`` | ` ` |
   | 2 | HTML comment | `/<!--[\s\S]*?-->/g` | ` ` |
   | 3 | Image | `/!\[([^\]]*)\]\([^)]*\)/g` | ` $1 ` |
   | 4 | Inline link (URL and title) | `/\[([^\]]*)\]\([^)]*\)/g` | ` $1 ` |
   | 5 | Reference link `[text][id]` | `/\[([^\]]*)\]\[[^\]]*\]/g` | ` $1 ` |
   | 6 | Autolink (URL or e-mail) | see below the table | ` ` |
   | 7 | HTML tag | `/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g` | ` ` |

   Regex 6, outside the table so the `|` is literal alternation:

   ```js
   /<(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*|[^\s<>@]+@[^\s<>]+)>/g
   ```

   Code spans go first because their content is literal (`` `<!--` `` must not open a comment). An unmatched backtick stays as a punctuation token. A stray `<` or `>`, as in `a < b > c`, matches no rule and is not a word.
5. Split on whitespace. Count tokens that match `/[\p{L}\p{N}]/u`.

Examples: ``a`x`b`` → 2, `foo<br>bar` → 2, `[a](u)[b](u)` → 2, `[t](u "title")` → 1, `[text][id]` → 1.

Public API:

- `export function countWords(markdown: string): number` — pure, no I/O.
- CLI entry runs only when the file is the main module: `process.argv[1]` is set and `realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)`. This also works through symlinks.
- The CLI takes exactly one argument. Zero or two or more arguments print the usage line `Usage: node scripts/wordcount.mjs <file.md>` to stderr and exit 1.

Runtime: Node ≥ 20 (ES modules, `node:test`, `\p{…}` regex). Tested on Node 24.18.0.

## Acceptance criteria

- **AC-1** `countWords` returns the number of words in plain prose. `"Xin chào thế giới"` → `4`, in NFC and in NFD form. An empty string → `0`. CRLF and LF input give the same count. A leading BOM is ignored.
- **AC-2** Fenced code blocks (```` ``` ```` and `~~~`, 3+ characters, up to 3 leading spaces) are not counted, including the fence lines and the info string. The closing fence must use the same character with at least the same length. An unclosed fence skips to end of file.
- **AC-3** Inline code spans, with single or multiple backticks, are not counted.
- **AC-4** A word is a whitespace-separated token with at least one Unicode letter or digit. Tokens like `-`, `#`, `>`, `—`, `|` are not counted. `**đậm**` counts as 1.
- **AC-5** Indented code blocks (4+ spaces or a tab, starting at a block boundary as defined in Design step 3) are not counted. An indented line that continues a paragraph is counted.
- **AC-6** Leading YAML front matter is not counted. A `---` that is not on line 1 does not start skipping.
- **AC-7** For `[text](url)`, `[text](url "title")`, `[text][id]` and `![alt](url)`, only `text` and `alt` count. Autolinks (`<https://…>`, `<a@b.com>`), HTML tags, HTML comments (also multi-line) and reference definitions `[id]: url` are not counted. Removals never join two words (see the examples in Design step 4).
- **AC-8** `node scripts/wordcount.mjs <file>` prints the count and a newline to stdout and exits with code 0.
- **AC-9** With zero arguments, two or more arguments, or a file that cannot be read, the CLI prints a one-line error to stderr, prints nothing to stdout, and exits with code 1. The read error reads `wordcount: cannot read <path>: <err.code, or err.message when there is no code>`.
- **AC-10** The tests are in `scripts/wordcount.test.mjs`, use `node:test` and `node:assert/strict`, and pass with `node --test scripts/wordcount.test.mjs`.

## Out of scope

- Multiple files, globs, or stdin input.
- Full CommonMark: indented code inside list items, setext edge cases, nested containers, nested brackets in link text, and parentheses inside URLs. A 4-space indented list continuation after a blank line counts as code. These limitations are documented in the script header.
- Inline code spans that cross a paragraph break are matched over the joined prose; this is accepted.
- Text that looks like a tag is removed: in `if x<y and z>w`, the words `y and z` match regex 7 and are not counted. This is documented in the script header.
- The symlink case of the main-module check has no test.
- A `package.json` or a `CONSTRAINTS.md` test check.
