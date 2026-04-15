# SQL Formatter

SQL formatter and beautifier — vanilla JS, zero dependencies, no build step.

**Live demo**: https://sen.ltd/portfolio/sql-formatter/

## Features

- **Format** messy or single-line SQL into readable, consistently styled output
- **Minify** to compact single-line SQL
- **Keyword case**: UPPERCASE / lowercase / Capitalize
- **Indent size**: 2, 4, 8 spaces or tab
- **SQL dialect**: Generic, PostgreSQL, MySQL, SQLite
- **Syntax highlighting** in the output pane
- **Copy to clipboard** button
- **Built-in examples**: SELECT, JOIN, subquery, INSERT, window functions
- **Japanese / English UI**
- **Dark / Light theme**
- Keyboard shortcut: `Ctrl+Enter` / `Cmd+Enter` to format

## How it works

1. **Tokenizer** (`src/tokenizer.js`) — custom hand-written lexer that splits SQL into typed tokens: keyword, identifier, number, string, operator, punctuation, comment, whitespace
2. **Formatter** (`src/formatter.js`) — walks the token stream and rebuilds the SQL with proper indentation, newlines before major clauses, and JOIN/ON alignment
3. **No external libraries** — works in any modern browser with ES modules

## Getting started

```sh
# Serve locally (no build required)
npm run serve
# Open http://localhost:8080
```

## Running tests

```sh
node --test tests/*.test.js
# or
npm test
```

Tests cover 25+ cases: tokenizer edge cases, formatter output structure, keyword casing, minify, round-trip consistency.

## Project structure

```
sql-formatter/
├── index.html        # App shell
├── style.css         # Styles (dark + light theme, CSS variables)
├── src/
│   ├── main.js       # DOM wiring, events, state
│   ├── tokenizer.js  # SQL lexer
│   ├── formatter.js  # Pretty-printer and minifier
│   └── i18n.js       # ja/en translations
├── tests/
│   ├── tokenizer.test.js
│   └── formatter.test.js
└── assets/
```

## License

MIT © 2026 SEN LLC (SEN 合同会社)

<!-- sen-publish:links -->
## Links

- 🌐 Demo: https://sen.ltd/portfolio/sql-formatter/
- 📝 dev.to: https://dev.to/sendotltd/writing-a-sql-formatter-with-a-handwritten-tokenizer-5c66
<!-- /sen-publish:links -->
