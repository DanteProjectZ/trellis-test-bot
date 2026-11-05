const BOM = '﻿';
const WORD_CHAR = /[\p{L}\p{N}]/u;
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const INLINE_CODE = /(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g;

function prepare(markdown) {
  const withoutBom = markdown.startsWith(BOM) ? markdown.slice(1) : markdown;
  return withoutBom.replace(/\r\n?/g, '\n').normalize('NFC');
}

function isClosingFence(line, fence) {
  const match = /^ {0,3}(`+|~+)[ \t]*$/.exec(line);
  return match !== null && match[1][0] === fence[0] && match[1].length >= fence.length;
}

function proseLines(lines) {
  const kept = [];
  let fence = null;
  for (const line of lines) {
    if (fence !== null) {
      if (isClosingFence(line, fence)) fence = null;
      continue;
    }
    const open = FENCE_OPEN.exec(line);
    if (open !== null) {
      fence = open[1];
      continue;
    }
    kept.push(line);
  }
  return kept;
}

function stripInline(prose) {
  return prose.replace(INLINE_CODE, ' ');
}

export function countWords(markdown) {
  const lines = prepare(markdown).split('\n');
  const prose = stripInline(proseLines(lines).join('\n'));
  return prose.split(/\s+/).filter((token) => WORD_CHAR.test(token)).length;
}
