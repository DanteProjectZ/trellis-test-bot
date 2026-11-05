const BOM = '﻿';
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
