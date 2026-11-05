// Counts the words of one Markdown file, skipping code.
//
// Usage: node scripts/wordcount.mjs <file.md>   (Node >= 20)
// Prints the count to stdout. Errors go to stderr with exit code 1.
// Also exports countWords(markdown) for use as a library.
//
// Not counted: fenced and indented code blocks, inline code, YAML front
// matter, link and image URLs, autolinks, HTML tags and comments, and
// reference definitions. A word is a whitespace-separated token with at
// least one Unicode letter or digit.
//
// Known limits (not full CommonMark):
// - A 4-space indented list continuation after a blank line counts as code.
// - Nested brackets in link text and parentheses inside URLs are not handled.
// - Tag-like text is removed: in "if x<y and z>w", "y and z" is not counted.
// - An inline code span may match across a paragraph break.

import { readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const USAGE = 'Usage: node scripts/wordcount.mjs <file.md>';
const BOM = String.fromCharCode(0xfeff);
const WORD_CHAR = /[\p{L}\p{N}]/u;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const REFERENCE_DEFINITION = /^ {0,3}\[[^\]]+\]:\s*\S+/;

// Applied in order to the joined prose. Code spans go first because their
// content is literal. Each replacement is padded so words never glue.
const INLINE_REPLACEMENTS = [
  [/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g, ' '],
  [/<!--[\s\S]*?-->/g, ' '],
  [/!\[([^\]]*)\]\([^)]*\)/g, ' $1 '],
  [/\[([^\]]*)\]\([^)]*\)/g, ' $1 '],
  [/\[([^\]]*)\]\[[^\]]*\]/g, ' $1 '],
  [/<(?:[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>]*|[^\s<>@]+@[^\s<>]+)>/g, ' '],
  [/<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g, ' '],
];

function prepare(markdown) {
  const withoutBom = markdown.startsWith(BOM) ? markdown.slice(1) : markdown;
  return withoutBom.replace(/\r\n?/g, '\n').normalize('NFC');
}

function isClosingFence(line, fence) {
  const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
  return match !== null && match[1][0] === fence[0] && match[1].length >= fence.length;
}

function skipFrontMatter(lines) {
  if (lines[0] !== '---') return lines;
  const close = lines.findIndex((line, i) => i > 0 && (line === '---' || line === '...'));
  return close === -1 ? lines : lines.slice(close + 1);
}

function isBlank(line) {
  return /^[ \t]*$/.test(line);
}

function isIndentedCode(line) {
  return /^( {4}|\t)/.test(line);
}

// Classifies each line as prose or code. A block boundary is the first body
// line, the line after a blank line, after a closing fence, or after an
// indented code line; only there can an indented code block start.
function proseLines(lines) {
  const kept = [];
  let fence = null;
  let atBoundary = true;
  for (const line of lines) {
    if (fence !== null) {
      if (isClosingFence(line, fence)) {
        fence = null;
        atBoundary = true;
      }
      continue;
    }
    if (isBlank(line)) {
      atBoundary = true;
      continue;
    }
    if (atBoundary && isIndentedCode(line)) continue;
    const open = FENCE_OPEN.exec(line);
    if (open !== null) {
      fence = open[1];
      continue;
    }
    if (REFERENCE_DEFINITION.test(line)) continue;
    kept.push(line);
    atBoundary = false;
  }
  return kept;
}

function stripInline(prose) {
  return INLINE_REPLACEMENTS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), prose);
}

export function countWords(markdown) {
  const lines = skipFrontMatter(prepare(markdown).split('\n'));
  const prose = stripInline(proseLines(lines).join('\n'));
  return prose.split(/\s+/).filter((token) => WORD_CHAR.test(token)).length;
}

async function main(args) {
  if (args.length !== 1) {
    process.stderr.write(`${USAGE}\n`);
    return 1;
  }
  const [path] = args;
  let markdown;
  try {
    markdown = await readFile(path, 'utf8');
  } catch (error) {
    process.stderr.write(`wordcount: cannot read ${path}: ${error.code ?? error.message}\n`);
    return 1;
  }
  process.stdout.write(`${countWords(markdown)}\n`);
  return 0;
}

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exitCode = await main(process.argv.slice(2));
}
