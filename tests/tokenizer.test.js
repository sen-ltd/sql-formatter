/**
 * Tests for SQL tokenizer
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize, TOKEN_TYPES } from '../src/tokenizer.js';

// Helper: filter out whitespace tokens
function nonWs(tokens) {
  return tokens.filter((t) => t.type !== TOKEN_TYPES.WHITESPACE);
}

describe('tokenize — basic cases', () => {
  it('returns empty array for empty input', () => {
    const tokens = tokenize('');
    assert.deepEqual(tokens, []);
  });

  it('returns whitespace token for whitespace-only input', () => {
    const tokens = tokenize('   \n\t ');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, TOKEN_TYPES.WHITESPACE);
  });

  it('tokenizes a simple SELECT', () => {
    const tokens = nonWs(tokenize('SELECT id FROM users'));
    assert.equal(tokens[0].type, TOKEN_TYPES.KEYWORD);
    assert.equal(tokens[0].value, 'SELECT');
    assert.equal(tokens[1].type, TOKEN_TYPES.IDENTIFIER);
    assert.equal(tokens[1].value, 'id');
    assert.equal(tokens[2].type, TOKEN_TYPES.KEYWORD);
    assert.equal(tokens[2].value, 'FROM');
    assert.equal(tokens[3].type, TOKEN_TYPES.IDENTIFIER);
    assert.equal(tokens[3].value, 'users');
  });

  it('recognizes keywords case-insensitively', () => {
    const tokens = nonWs(tokenize('select from where'));
    assert.equal(tokens[0].type, TOKEN_TYPES.KEYWORD);
    assert.equal(tokens[1].type, TOKEN_TYPES.KEYWORD);
    assert.equal(tokens[2].type, TOKEN_TYPES.KEYWORD);
  });

  it('distinguishes keyword from identifier', () => {
    const tokens = nonWs(tokenize('SELECT selected_id FROM from_table'));
    assert.equal(tokens[0].type, TOKEN_TYPES.KEYWORD);   // SELECT
    assert.equal(tokens[1].type, TOKEN_TYPES.IDENTIFIER); // selected_id
    assert.equal(tokens[2].type, TOKEN_TYPES.KEYWORD);   // FROM
    assert.equal(tokens[3].type, TOKEN_TYPES.IDENTIFIER); // from_table
  });
});

describe('tokenize — string literals', () => {
  it('tokenizes single-quoted string', () => {
    const tokens = nonWs(tokenize("WHERE name = 'Alice'"));
    const str = tokens.find((t) => t.type === TOKEN_TYPES.STRING);
    assert.ok(str, 'should have a string token');
    assert.equal(str.value, "'Alice'");
  });

  it('handles escaped single-quote inside string', () => {
    const tokens = nonWs(tokenize("'it''s fine'"));
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, TOKEN_TYPES.STRING);
    assert.equal(tokens[0].value, "'it''s fine'");
  });

  it('handles empty string', () => {
    const tokens = nonWs(tokenize("''"));
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, TOKEN_TYPES.STRING);
    assert.equal(tokens[0].value, "''");
  });
});

describe('tokenize — numbers', () => {
  it('tokenizes integer', () => {
    const tokens = nonWs(tokenize('42'));
    assert.equal(tokens[0].type, TOKEN_TYPES.NUMBER);
    assert.equal(tokens[0].value, '42');
  });

  it('tokenizes float', () => {
    const tokens = nonWs(tokenize('3.14'));
    assert.equal(tokens[0].type, TOKEN_TYPES.NUMBER);
    assert.equal(tokens[0].value, '3.14');
  });

  it('tokenizes negative-adjacent number (minus is separate operator)', () => {
    const tokens = nonWs(tokenize('-42'));
    assert.equal(tokens[0].type, TOKEN_TYPES.OPERATOR);
    assert.equal(tokens[1].type, TOKEN_TYPES.NUMBER);
  });

  it('tokenizes scientific notation', () => {
    const tokens = nonWs(tokenize('1.5e10'));
    assert.equal(tokens[0].type, TOKEN_TYPES.NUMBER);
    assert.equal(tokens[0].value, '1.5e10');
  });
});

describe('tokenize — comments', () => {
  it('tokenizes line comment', () => {
    const tokens = tokenize('SELECT 1 -- this is a comment\nFROM t');
    const comment = tokens.find((t) => t.type === TOKEN_TYPES.COMMENT);
    assert.ok(comment);
    assert.ok(comment.value.startsWith('--'));
  });

  it('tokenizes block comment', () => {
    const tokens = tokenize('SELECT /* inline */ 1');
    const comment = tokens.find((t) => t.type === TOKEN_TYPES.COMMENT);
    assert.ok(comment);
    assert.equal(comment.value, '/* inline */');
  });
});

describe('tokenize — operators', () => {
  it('tokenizes single-char operators', () => {
    const tokens = nonWs(tokenize('a = b > c < d + e'));
    const ops = tokens.filter((t) => t.type === TOKEN_TYPES.OPERATOR);
    assert.equal(ops.length, 4);
  });

  it('tokenizes two-char operators', () => {
    const tokens = nonWs(tokenize('a <> b AND c <= d AND e >= f AND g != h'));
    const ops = tokens.filter((t) => t.type === TOKEN_TYPES.OPERATOR);
    assert.ok(ops.some((t) => t.value === '<>'));
    assert.ok(ops.some((t) => t.value === '<='));
    assert.ok(ops.some((t) => t.value === '>='));
    assert.ok(ops.some((t) => t.value === '!='));
  });
});

describe('tokenize — punctuation', () => {
  it('tokenizes commas and parentheses', () => {
    const tokens = nonWs(tokenize('(a, b, c)'));
    const puncts = tokens.filter((t) => t.type === TOKEN_TYPES.PUNCTUATION);
    const vals = puncts.map((t) => t.value);
    assert.ok(vals.includes('('));
    assert.ok(vals.includes(')'));
    assert.ok(vals.includes(','));
  });

  it('tokenizes semicolon', () => {
    const tokens = nonWs(tokenize('SELECT 1;'));
    const semi = tokens.find((t) => t.value === ';');
    assert.ok(semi);
    assert.equal(semi.type, TOKEN_TYPES.PUNCTUATION);
  });
});

describe('tokenize — identifiers', () => {
  it('tokenizes identifier with underscore', () => {
    const tokens = nonWs(tokenize('my_table'));
    assert.equal(tokens[0].type, TOKEN_TYPES.IDENTIFIER);
    assert.equal(tokens[0].value, 'my_table');
  });

  it('tokenizes double-quoted identifier', () => {
    const tokens = nonWs(tokenize('"My Table"'));
    assert.equal(tokens[0].type, TOKEN_TYPES.IDENTIFIER);
    assert.equal(tokens[0].value, '"My Table"');
  });

  it('tokenizes backtick identifier (MySQL)', () => {
    const tokens = nonWs(tokenize('`my_table`'));
    assert.equal(tokens[0].type, TOKEN_TYPES.IDENTIFIER);
    assert.equal(tokens[0].value, '`my_table`');
  });
});

describe('tokenize — edge cases', () => {
  it('handles multiple spaces and newlines', () => {
    const tokens = tokenize('  SELECT\n  1  ');
    const ws = tokens.filter((t) => t.type === TOKEN_TYPES.WHITESPACE);
    assert.ok(ws.length > 0);
  });

  it('all tokens together cover the entire input', () => {
    const sql = "SELECT id, name FROM users WHERE age > 21 AND name LIKE 'A%'; -- done";
    const tokens = tokenize(sql);
    const reconstructed = tokens.map((t) => t.value).join('');
    assert.equal(reconstructed, sql);
  });
});
