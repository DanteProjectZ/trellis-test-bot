import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countWords } from './wordcount.mjs';

const FENCE = '```';

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
  assert.equal(countWords('﻿một hai'), 2);
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
