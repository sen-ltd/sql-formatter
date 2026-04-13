/**
 * SQL Tokenizer
 * Converts raw SQL string into an array of typed tokens.
 */

export const TOKEN_TYPES = {
  KEYWORD: 'keyword',
  IDENTIFIER: 'identifier',
  NUMBER: 'number',
  STRING: 'string',
  OPERATOR: 'operator',
  PUNCTUATION: 'punctuation',
  COMMENT: 'comment',
  WHITESPACE: 'whitespace',
};

export const KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'OUTER', 'FULL',
  'CROSS', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'UNION', 'ALL', 'DISTINCT',
  'AS', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'ILIKE', 'BETWEEN', 'IS', 'NULL',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE',
  'DROP', 'ALTER', 'ADD', 'COLUMN', 'INDEX', 'VIEW', 'DATABASE', 'SCHEMA',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'NOT',
  'EXISTS', 'IF', 'THEN', 'ELSE', 'END', 'CASE', 'WHEN', 'LIMIT', 'OFFSET',
  'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST', 'FETCH', 'NEXT', 'ROWS', 'ONLY',
  'WITH', 'RECURSIVE', 'RETURNING', 'OVER', 'PARTITION', 'WINDOW', 'FILTER',
  'LATERAL', 'NATURAL', 'EXCEPT', 'INTERSECT', 'TRUNCATE', 'RENAME', 'TO',
  'CONSTRAINT', 'CHECK', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'BEGIN',
  'COMMIT', 'ROLLBACK', 'TRANSACTION', 'LOCK', 'UNLOCK', 'GRANT', 'REVOKE',
  'EXPLAIN', 'ANALYZE', 'VACUUM', 'CAST', 'CONVERT', 'COALESCE', 'NULLIF',
  'TRUE', 'FALSE', 'UNKNOWN', 'CURRENT_DATE', 'CURRENT_TIME', 'CURRENT_TIMESTAMP',
]);

/**
 * @typedef {{ type: string, value: string }} Token
 */

/**
 * Tokenize a SQL string into an array of tokens.
 * @param {string} sql
 * @returns {Token[]}
 */
export function tokenize(sql) {
  const tokens = [];
  let i = 0;
  const len = sql.length;

  while (i < len) {
    // Whitespace
    if (/\s/.test(sql[i])) {
      let j = i;
      while (j < len && /\s/.test(sql[j])) j++;
      tokens.push({ type: TOKEN_TYPES.WHITESPACE, value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Line comment --
    if (sql[i] === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < len && sql[j] !== '\n') j++;
      tokens.push({ type: TOKEN_TYPES.COMMENT, value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Block comment /* ... */
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let j = i + 2;
      while (j < len - 1 && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
      j += 2; // consume */
      tokens.push({ type: TOKEN_TYPES.COMMENT, value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // String literal '...' (with '' escape)
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < len) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2; // escaped quote
        } else if (sql[j] === "'") {
          j++;
          break;
        } else {
          j++;
        }
      }
      tokens.push({ type: TOKEN_TYPES.STRING, value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Double-quoted identifier "..."
    if (sql[i] === '"') {
      let j = i + 1;
      while (j < len && sql[j] !== '"') j++;
      j++; // consume closing "
      tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Backtick identifier `...` (MySQL)
    if (sql[i] === '`') {
      let j = i + 1;
      while (j < len && sql[j] !== '`') j++;
      j++; // consume closing `
      tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Number (integer or float)
    if (/[0-9]/.test(sql[i]) || (sql[i] === '.' && /[0-9]/.test(sql[i + 1]))) {
      let j = i;
      while (j < len && /[0-9]/.test(sql[j])) j++;
      if (j < len && sql[j] === '.') {
        j++;
        while (j < len && /[0-9]/.test(sql[j])) j++;
      }
      // Optional exponent
      if (j < len && (sql[j] === 'e' || sql[j] === 'E')) {
        j++;
        if (j < len && (sql[j] === '+' || sql[j] === '-')) j++;
        while (j < len && /[0-9]/.test(sql[j])) j++;
      }
      tokens.push({ type: TOKEN_TYPES.NUMBER, value: sql.slice(i, j) });
      i = j;
      continue;
    }

    // Identifier or keyword
    if (/[a-zA-Z_]/.test(sql[i])) {
      let j = i;
      while (j < len && /[a-zA-Z0-9_$]/.test(sql[j])) j++;
      const word = sql.slice(i, j);
      const type = KEYWORDS.has(word.toUpperCase()) ? TOKEN_TYPES.KEYWORD : TOKEN_TYPES.IDENTIFIER;
      tokens.push({ type, value: word });
      i = j;
      continue;
    }

    // Two-char operators
    const twoChar = sql.slice(i, i + 2);
    if (['<>', '<=', '>=', '!=', '::', '||', '->'].includes(twoChar)) {
      tokens.push({ type: TOKEN_TYPES.OPERATOR, value: twoChar });
      i += 2;
      continue;
    }

    // Single-char operators
    if (['=', '<', '>', '+', '-', '*', '/', '%', '^', '~', '&', '|', '@'].includes(sql[i])) {
      tokens.push({ type: TOKEN_TYPES.OPERATOR, value: sql[i] });
      i++;
      continue;
    }

    // Punctuation
    if ([',', ';', '(', ')', '[', ']', '.'].includes(sql[i])) {
      tokens.push({ type: TOKEN_TYPES.PUNCTUATION, value: sql[i] });
      i++;
      continue;
    }

    // Unknown character — treat as identifier to avoid infinite loop
    tokens.push({ type: TOKEN_TYPES.IDENTIFIER, value: sql[i] });
    i++;
  }

  return tokens;
}
