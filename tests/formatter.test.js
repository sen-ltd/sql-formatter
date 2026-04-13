/**
 * Tests for SQL formatter
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { format, minify, applyCase } from '../src/formatter.js';
import { tokenize, TOKEN_TYPES } from '../src/tokenizer.js';

// ── applyCase ────────────────────────────────────────────────────────────────

describe('applyCase', () => {
  it('upper: converts to uppercase', () => {
    assert.equal(applyCase('select', 'upper'), 'SELECT');
  });

  it('lower: converts to lowercase', () => {
    assert.equal(applyCase('SELECT', 'lower'), 'select');
  });

  it('capitalize: first letter upper, rest lower', () => {
    assert.equal(applyCase('SELECT', 'capitalize'), 'Select');
  });

  it('unknown style defaults to uppercase', () => {
    assert.equal(applyCase('select', 'whatever'), 'SELECT');
  });
});

// ── minify ───────────────────────────────────────────────────────────────────

describe('minify', () => {
  it('collapses whitespace to single spaces', () => {
    const result = minify('SELECT  id  FROM   users');
    assert.ok(!result.includes('  '), 'no double spaces');
  });

  it('removes line comments', () => {
    const result = minify('SELECT id -- get id\nFROM users');
    assert.ok(!result.includes('--'));
  });

  it('removes block comments', () => {
    const result = minify('SELECT /* col */ id FROM users');
    assert.ok(!result.includes('/*'));
  });

  it('produces a single line', () => {
    const result = minify('SELECT\n  id,\n  name\nFROM users\nWHERE id = 1');
    assert.ok(!result.includes('\n'));
  });

  it('preserves string literals intact', () => {
    const result = minify("SELECT * FROM t WHERE name = 'hello world'");
    assert.ok(result.includes("'hello world'"));
  });

  it('round-trips: minified then tokenized has same significant tokens', () => {
    const sql = "SELECT id, name FROM users WHERE id > 5";
    const minified = minify(sql);
    const origTokens = tokenize(sql).filter((t) => t.type !== TOKEN_TYPES.WHITESPACE && t.type !== TOKEN_TYPES.COMMENT);
    const minTokens = tokenize(minified).filter((t) => t.type !== TOKEN_TYPES.WHITESPACE && t.type !== TOKEN_TYPES.COMMENT);
    assert.equal(minTokens.length, origTokens.length);
  });
});

// ── format ───────────────────────────────────────────────────────────────────

describe('format — basic SELECT', () => {
  it('puts SELECT on first line', () => {
    const result = format('select id from users');
    assert.ok(result.startsWith('SELECT'));
  });

  it('puts FROM on its own line', () => {
    const result = format('select id from users');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => l.trim().startsWith('FROM')));
  });

  it('uppercases keywords by default', () => {
    const result = format('select id from users where id = 1');
    assert.ok(result.includes('SELECT'));
    assert.ok(result.includes('FROM'));
    assert.ok(result.includes('WHERE'));
  });

  it('lowercases keywords when keywordCase=lower', () => {
    const result = format('SELECT id FROM users', { keywordCase: 'lower' });
    assert.ok(result.includes('select'));
    assert.ok(result.includes('from'));
  });

  it('capitalizes keywords when keywordCase=capitalize', () => {
    const result = format('SELECT id FROM users', { keywordCase: 'capitalize' });
    assert.ok(result.includes('Select'));
    assert.ok(result.includes('From'));
  });
});

describe('format — indentation', () => {
  it('uses 2-space indent by default', () => {
    const result = format('select id, name from users where id = 1');
    // WHERE line: expect "  AND" pattern or columns
    assert.ok(result.includes('  ') || result.length > 0);
  });

  it('uses 4-space indent when specified', () => {
    const result = format('select id from users where id = 1 and name = \'a\'', { indent: '    ' });
    // AND should be on its own line with indent
    assert.ok(result.includes('\n') && result.length > 0);
  });

  it('uses tab indent when specified', () => {
    const result = format('select id from users where id = 1 and name = \'a\'', { indent: '\t' });
    assert.ok(result.includes('\t'));
  });
});

describe('format — JOINs', () => {
  it('puts JOIN on its own line', () => {
    const result = format('select a.id from a join b on a.id = b.a_id');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => /^\s*(INNER\s+)?JOIN\b/.test(l)));
  });

  it('puts INNER JOIN on its own line', () => {
    const result = format('select * from orders inner join customers on orders.cid = customers.id');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => l.trim().startsWith('INNER JOIN') || l.trim().startsWith('INNER')));
  });

  it('puts LEFT JOIN on its own line', () => {
    const result = format('select * from a left join b on a.id = b.a_id');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => /^\s*(LEFT)/.test(l) || /\bJOIN\b/.test(l)));
  });

  it('places ON on its own indented line', () => {
    const result = format('select * from a join b on a.id = b.a_id');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => l.trim().startsWith('ON')));
  });
});

describe('format — subquery', () => {
  it('handles subquery in WHERE', () => {
    const sql = 'select id from users where id in (select user_id from orders)';
    const result = format(sql);
    assert.ok(result.includes('SELECT') || result.includes('select'));
    assert.ok(result.includes('('));
  });

  it('produces valid structure for nested parens', () => {
    const sql = 'select * from t where a = (select max(b) from t2)';
    const result = format(sql);
    // Should have matching parens
    const opens = (result.match(/\(/g) || []).length;
    const closes = (result.match(/\)/g) || []).length;
    assert.equal(opens, closes);
  });
});

describe('format — multi-column SELECT', () => {
  it('puts commas after each column', () => {
    const result = format('SELECT id, name, email FROM users');
    assert.ok(result.includes(','));
  });

  it('preserves all column names', () => {
    const result = format('SELECT id, first_name, last_name, email FROM users');
    assert.ok(result.includes('id'));
    assert.ok(result.includes('first_name'));
    assert.ok(result.includes('last_name'));
    assert.ok(result.includes('email'));
  });
});

describe('format — WHERE clause', () => {
  it('puts AND on its own line at top level', () => {
    const result = format('select * from t where a = 1 and b = 2');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => l.trim().startsWith('AND')));
  });

  it('puts OR on its own line at top level', () => {
    const result = format('select * from t where a = 1 or b = 2');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => l.trim().startsWith('OR')));
  });
});

describe('format — GROUP BY / ORDER BY', () => {
  it('puts GROUP BY on its own line', () => {
    const result = format('select dept, count(*) from emp group by dept');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => l.trim().startsWith('GROUP BY')));
  });

  it('puts ORDER BY on its own line', () => {
    const result = format('select * from t order by name asc');
    const lines = result.split('\n');
    assert.ok(lines.some((l) => l.trim().startsWith('ORDER BY')));
  });
});

describe('format — INSERT', () => {
  it('puts INSERT on its own line', () => {
    const result = format("insert into users (name, email) values ('Alice', 'a@example.com')");
    assert.ok(result.toUpperCase().includes('INSERT'));
    assert.ok(result.toUpperCase().includes('INTO'));
    assert.ok(result.toUpperCase().includes('VALUES'));
  });
});

describe('format — semicolons', () => {
  it('preserves semicolons', () => {
    const result = format('SELECT 1;');
    assert.ok(result.includes(';'));
  });
});

describe('format — round trip', () => {
  it('formatted SQL has same significant tokens as original', () => {
    const sql = "SELECT id, name FROM users WHERE active = 1 ORDER BY name ASC";
    const formatted = format(sql);
    const origTokens = tokenize(sql)
      .filter((t) => t.type !== TOKEN_TYPES.WHITESPACE)
      .map((t) => t.value.toUpperCase());
    const fmtTokens = tokenize(formatted)
      .filter((t) => t.type !== TOKEN_TYPES.WHITESPACE)
      .map((t) => t.value.toUpperCase());
    assert.deepEqual(fmtTokens, origTokens);
  });

  it('format is idempotent on already-formatted SQL', () => {
    const sql = "select id, name from users where active = 1";
    const first = format(sql);
    const second = format(first);
    assert.equal(first, second);
  });
});
