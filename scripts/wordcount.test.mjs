import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countWords } from './wordcount.mjs';

const FENCE = '```';
const SCRIPT = fileURLToPath(new URL('./wordcount.mjs', import.meta.url));

function runCli(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
}

test('AC-1: counts plain prose words', () => {
  assert.equal(countWords('Xin chào thế giới'), 4);
});

test('AC-1: NFD input counts the same as NFC', () => {
  assert.equal(countWords('Xin chào thế giới'.normalize('NFD')), 4);
});

test('AC-1: empty string is zero', () => {
  assert.equal(countWords(''), 0);
});

test('AC-1: CRLF and LF give the same count', () => {
  const lf = `một hai\n\n${FENCE}\ncode here\n${FENCE}\nba`;
  assert.equal(countWords(lf.replace(/\n/g, '\r\n')), countWords(lf));
  assert.equal(countWords(lf), 3);
});

test('AC-1: leading BOM is ignored', () => {
  assert.equal(countWords(`${String.fromCharCode(0xfeff)}một hai`), 2);
});

test('AC-2: backtick fence and its content are skipped', () => {
  assert.equal(countWords(`một\n${FENCE}\nconst a = 1;\n${FENCE}\nhai`), 2);
});

test('AC-2: tilde fence is skipped', () => {
  assert.equal(countWords('một\n~~~\nfoo bar\n~~~\nhai'), 2);
});

test('AC-2: info string is skipped', () => {
  assert.equal(countWords(`${FENCE}js title words\nx\n${FENCE}\nhai`), 1);
});

test('AC-2: fence indented up to 3 spaces opens', () => {
  assert.equal(countWords(`   ${FENCE}\nfoo\n   ${FENCE}\nhai`), 1);
});

test('AC-2: longer closing fence closes', () => {
  assert.equal(countWords(`${FENCE}\nfoo\n${FENCE}\`\`\nhai`), 1);
});

test('AC-2: shorter closing fence does not close', () => {
  assert.equal(countWords('````\nfoo\n```\nbar\n````\nhai'), 1);
});

test('AC-2: mismatched character does not close', () => {
  assert.equal(countWords(`${FENCE}\nfoo\n~~~\nbar\n${FENCE}\nhai`), 1);
});

test('AC-2: unclosed fence skips to end of file', () => {
  assert.equal(countWords(`một\n${FENCE}\nfoo bar\nbaz`), 1);
});

test('AC-3: single backtick span is skipped', () => {
  assert.equal(countWords('chạy `npm install` ngay'), 2);
});

test('AC-3: double backtick span is skipped', () => {
  assert.equal(countWords('dùng ``a ` b`` nhé'), 2);
});

test('AC-3: code span between letters does not glue words', () => {
  assert.equal(countWords('a`x`b'), 2);
});

test('AC-3: unmatched backtick is punctuation', () => {
  assert.equal(countWords('một ` hai'), 2);
});

test('AC-4: punctuation-only tokens are not words', () => {
  assert.equal(countWords('# Tiêu đề\n\n- mục — một | hai\n> trích'), 6);
});

test('AC-4: emphasis counts as one word', () => {
  assert.equal(countWords('**đậm**'), 1);
});

test('AC-5: indented block after a blank line is skipped', () => {
  assert.equal(countWords('một\n\n    code here\n\nhai'), 2);
});

test('AC-5: tab-indented block is skipped', () => {
  assert.equal(countWords('một\n\n\tcode x\nhai'), 2);
});

test('AC-5: indented first body line after front matter is code', () => {
  assert.equal(countWords('---\nt: x\n---\n    code y\nhai'), 1);
});

test('AC-5: indented line right after a closing fence is code', () => {
  assert.equal(countWords(`${FENCE}\nx\n${FENCE}\n    code y\nhai`), 1);
});

test('AC-5: indented paragraph continuation is counted', () => {
  assert.equal(countWords('một\n    hai ba'), 3);
});

test('AC-5: whitespace-only line is blank, not code', () => {
  assert.equal(countWords('một\n    \n    code z\nhai'), 2);
});

test('AC-2: closing fence indented 4 spaces does not close', () => {
  assert.equal(countWords(`${FENCE}\nx\n    ${FENCE}\ny\n${FENCE}\nhai`), 1);
});

test('AC-6: leading front matter is skipped', () => {
  assert.equal(countWords('---\ntitle: Xin chào\n---\nmột hai'), 2);
});

test('AC-6: front matter may close with ...', () => {
  assert.equal(countWords('---\ntitle: x\n...\nmột'), 1);
});

test('AC-6: unclosed front matter is counted as prose', () => {
  assert.equal(countWords('---\ntitle: x\nmột hai'), 4);
});

test('AC-6: --- after line 1 does not start skipping', () => {
  assert.equal(countWords('một\n---\nhai ba\n---\nbốn'), 4);
});

test('AC-7: inline link counts text only', () => {
  assert.equal(countWords('[t](https://example.com/path)'), 1);
});

test('AC-7: link title is not counted', () => {
  assert.equal(countWords('[t](u "some title")'), 1);
});

test('AC-7: reference link counts text, not id', () => {
  assert.equal(countWords('[text][some-id]'), 1);
});

test('AC-7: adjacent links do not glue', () => {
  assert.equal(countWords('[a](u)[b](u)'), 2);
});

test('AC-7: image counts alt only', () => {
  assert.equal(countWords('![ảnh đẹp](img/x.png)'), 2);
});

test('AC-7: URL autolink is not counted', () => {
  assert.equal(countWords('<https://x.y/z>'), 0);
});

test('AC-7: e-mail autolink is not counted', () => {
  assert.equal(countWords('<a@b.com>'), 0);
});

test('AC-7: HTML tag between words does not glue', () => {
  assert.equal(countWords('foo<br>bar'), 2);
});

test('AC-7: HTML tags are removed, inner text counts', () => {
  assert.equal(countWords('<span class="x">chữ</span>'), 1);
});

test('AC-7: stray angle brackets are not tags', () => {
  assert.equal(countWords('a < b > c'), 3);
});

test('AC-7: multi-line HTML comment is not counted', () => {
  assert.equal(countWords('một <!-- hai\nba --> bốn'), 2);
});

test('AC-7: comment opener inside a code span is literal', () => {
  assert.equal(countWords('`<!--` một -->'), 1);
});

test('AC-7: reference definition is not counted', () => {
  assert.equal(countWords('một\n\n[id]: https://x.y "Title"'), 1);
});

test('known limit: tag-like text such as x<y and z>w is removed', () => {
  assert.equal(countWords('if x<y and z>w'), 3);
});

test('AC-8: CLI prints the count and exits 0', () => {
  const dir = mkdtempSync(join(tmpdir(), 'wc-'));
  const file = join(dir, 'doc.md');
  writeFileSync(file, `# Xin chào\n\n${FENCE}\nskip me\n${FENCE}\nthế giới\n`);
  const result = runCli([file]);
  assert.equal(result.status, 0);
  assert.equal(result.stdout, '4\n');
  assert.equal(result.stderr, '');
});

test('AC-9: no argument prints usage and exits 1', () => {
  const result = runCli([]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Usage: node scripts\/wordcount\.mjs <file\.md>\n$/);
});

test('AC-9: two arguments print usage and exit 1', () => {
  const result = runCli(['a.md', 'b.md']);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^Usage: /);
});

// Unclosed openers on one very long line once made the inline regexes scan
// to the end of the text from every opener (quadratic). The CLI runs in a
// child process so a hang fails at the timeout instead of blocking the run.
const LONG_LINE_BUDGET_MS = 3000;
const DISTINCT_BACKTICK_RUNS = 2000;
const LONG_LINE_CASES = [
  ['unclosed link text', '[a '.repeat(80000), 80000],
  ['unclosed image text', '![a '.repeat(60000), 60000],
  ['unclosed link URL', '[a](x '.repeat(80000), 80000],
  ['unclosed HTML comment', '<!-- a '.repeat(160000), 160000],
  [
    'unclosed backtick runs of distinct lengths',
    Array.from({ length: DISTINCT_BACKTICK_RUNS }, (_, i) => `${'`'.repeat(i + 1)}a `).join(''),
    DISTINCT_BACKTICK_RUNS,
  ],
];

for (const [name, text, words] of LONG_LINE_CASES) {
  test(`long line with ${name} finishes and counts every word`, () => {
    const file = join(mkdtempSync(join(tmpdir(), 'wc-')), 'long.md');
    writeFileSync(file, text);
    const result = spawnSync(process.execPath, [SCRIPT, file], {
      encoding: 'utf8',
      timeout: LONG_LINE_BUDGET_MS,
    });
    assert.equal(result.error, undefined, `did not finish within ${LONG_LINE_BUDGET_MS} ms`);
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${words}\n`);
  });
}

test('AC-9: unreadable file prints an error and exits 1', () => {
  const missing = join(mkdtempSync(join(tmpdir(), 'wc-')), 'missing.md');
  const result = runCli([missing]);
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, `wordcount: cannot read ${missing}: ENOENT\n`);
});
