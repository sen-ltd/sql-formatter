/**
 * SQL Formatter
 * Formats tokenized SQL into readable or compact output.
 */

import { tokenize, TOKEN_TYPES, KEYWORDS } from './tokenizer.js';

// Major clause keywords that get their own line (at indent level 0)
const CLAUSE_STARTERS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'ORDER', 'HAVING', 'UNION',
  'EXCEPT', 'INTERSECT', 'LIMIT', 'OFFSET', 'FETCH',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE',
  'CREATE', 'ALTER', 'DROP', 'TRUNCATE',
  'WITH', 'RETURNING',
  'BEGIN', 'COMMIT', 'ROLLBACK',
  'EXPLAIN', 'ANALYZE',
]);

// JOIN variants — new line but indented under FROM level
const JOIN_KEYWORDS = new Set([
  'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL', 'CROSS', 'NATURAL', 'LATERAL',
]);

/**
 * @typedef {{ keywordCase: 'upper'|'lower'|'capitalize', indent: string, dialect: string }} FormatOptions
 */

/**
 * Apply keyword casing to a word.
 * @param {string} word
 * @param {'upper'|'lower'|'capitalize'} style
 * @returns {string}
 */
export function applyCase(word, style) {
  switch (style) {
    case 'lower': return word.toLowerCase();
    case 'capitalize': return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    default: return word.toUpperCase();
  }
}

/**
 * Format SQL with pretty-printing.
 * @param {string} sql
 * @param {FormatOptions} [options]
 * @returns {string}
 */
export function format(sql, options = {}) {
  const {
    keywordCase = 'upper',
    indent = '  ',
    dialect = 'generic',
  } = options;

  const tokens = tokenize(sql);
  const result = [];
  let depth = 0;         // paren depth
  let lineStart = true;  // are we at the beginning of a new line?
  let lastNonWs = null;  // last non-whitespace token

  const pad = (d) => indent.repeat(Math.max(0, d));

  // Helper: emit token value (with keyword casing applied)
  const emit = (token) => {
    if (token.type === TOKEN_TYPES.KEYWORD) {
      return applyCase(token.value, keywordCase);
    }
    return token.value;
  };

  // Remove whitespace tokens; we rebuild spacing ourselves.
  const significant = tokens.filter(
    (t) => t.type !== TOKEN_TYPES.WHITESPACE
  );

  for (let i = 0; i < significant.length; i++) {
    const tok = significant[i];
    const next = significant[i + 1];
    const prev = significant[i - 1];

    // --- COMMENT ---
    if (tok.type === TOKEN_TYPES.COMMENT) {
      if (!lineStart) result.push('\n');
      result.push(pad(depth) + tok.value + '\n');
      lineStart = true;
      lastNonWs = tok;
      continue;
    }

    // --- KEYWORD handling ---
    if (tok.type === TOKEN_TYPES.KEYWORD) {
      const upper = tok.value.toUpperCase();

      // Handle "GROUP BY" / "ORDER BY" — keep on same line
      if ((upper === 'BY') && lastNonWs && ['GROUP', 'ORDER', 'PARTITION'].includes(lastNonWs.value.toUpperCase())) {
        result.push(' ' + emit(tok));
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      // JOIN variant after INNER / LEFT / RIGHT / etc. — keep on same line
      if (upper === 'JOIN' && lastNonWs && JOIN_KEYWORDS.has(lastNonWs.value.toUpperCase())) {
        result.push(' ' + emit(tok));
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      // OUTER / FULL continuation
      if ((upper === 'OUTER' || upper === 'JOIN') && lastNonWs &&
        ['LEFT', 'RIGHT', 'FULL', 'CROSS', 'INNER', 'NATURAL', 'LATERAL'].includes(lastNonWs.value.toUpperCase())) {
        result.push(' ' + emit(tok));
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      // ON keyword — keep on same line after JOIN chain
      if (upper === 'ON') {
        result.push('\n' + pad(depth + 1) + emit(tok));
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      // Major clause starters
      if (CLAUSE_STARTERS.has(upper)) {
        if (result.length > 0 && !lineStart) result.push('\n');
        result.push(pad(depth) + emit(tok));
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      // JOIN keywords go on new line at same depth as FROM
      if (JOIN_KEYWORDS.has(upper)) {
        if (!lineStart) result.push('\n');
        result.push(pad(depth) + emit(tok));
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      // AND / OR at depth 0 or 1 — new line
      if ((upper === 'AND' || upper === 'OR') && depth === 0) {
        result.push('\n' + pad(1) + emit(tok));
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      // Default: space + keyword
      if (!lineStart) result.push(' ');
      result.push(emit(tok));
      lineStart = false;
      lastNonWs = tok;
      continue;
    }

    // --- PUNCTUATION ---
    if (tok.type === TOKEN_TYPES.PUNCTUATION) {
      if (tok.value === '(') {
        // No space before opening paren if previous is identifier/keyword
        if (!lineStart) result.push('');
        result.push('(');
        depth++;
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      if (tok.value === ')') {
        depth = Math.max(0, depth - 1);
        result.push(')');
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      if (tok.value === ',') {
        // After comma: newline + indent (at subquery depth)
        result.push(',\n' + pad(depth === 0 ? 1 : depth));
        lineStart = true;
        lastNonWs = tok;
        continue;
      }

      if (tok.value === ';') {
        result.push(';');
        result.push('\n');
        lineStart = true;
        lastNonWs = tok;
        continue;
      }

      if (tok.value === '.') {
        result.push('.');
        lineStart = false;
        lastNonWs = tok;
        continue;
      }

      // Default punctuation
      if (!lineStart) result.push(' ');
      result.push(tok.value);
      lineStart = false;
      lastNonWs = tok;
      continue;
    }

    // --- EVERYTHING ELSE (identifier, number, string, operator) ---
    if (!lineStart) {
      // No space before . or after .
      const prevIsDot = prev && prev.type === TOKEN_TYPES.PUNCTUATION && prev.value === '.';
      if (!prevIsDot) result.push(' ');
    }
    result.push(emit(tok));
    lineStart = false;
    lastNonWs = tok;
  }

  return result.join('').trim();
}

/**
 * Minify SQL to a single compact line.
 * @param {string} sql
 * @returns {string}
 */
export function minify(sql) {
  const tokens = tokenize(sql);
  const result = [];
  let prevType = null;

  for (const tok of tokens) {
    if (tok.type === TOKEN_TYPES.WHITESPACE) continue;
    if (tok.type === TOKEN_TYPES.COMMENT) continue;

    const needSpace =
      prevType !== null &&
      prevType !== TOKEN_TYPES.PUNCTUATION &&
      tok.type !== TOKEN_TYPES.PUNCTUATION &&
      !(tok.value === '.' || (prevType === TOKEN_TYPES.PUNCTUATION && result[result.length - 1] === '.'));

    if (needSpace) result.push(' ');
    result.push(tok.value);
    prevType = tok.type;
  }

  return result.join('').trim();
}
