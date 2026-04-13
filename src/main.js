/**
 * SQL Formatter — Main entry point
 * Handles DOM interactions and wires up the formatter logic.
 */

import { format, minify } from './formatter.js';
import { t, translations } from './i18n.js';

// ── State ────────────────────────────────────────────────────────────────────

let state = {
  lang: 'en',
  theme: 'dark',
  keywordCase: 'upper',
  indent: '  ',     // 2 spaces default
  dialect: 'generic',
};

// ── DOM refs ──────────────────────────────────────────────────────────────────

const inputEl      = document.getElementById('input');
const outputEl     = document.getElementById('output');
const formatBtn    = document.getElementById('btn-format');
const minifyBtn    = document.getElementById('btn-minify');
const copyBtn      = document.getElementById('btn-copy');
const clearBtn     = document.getElementById('btn-clear');
const examplesBtn  = document.getElementById('btn-examples');
const examplesPanel = document.getElementById('examples-panel');
const langBtn      = document.getElementById('btn-lang');
const themeBtn     = document.getElementById('btn-theme');

const keywordCaseEl = document.getElementById('keyword-case');
const indentEl      = document.getElementById('indent-size');
const dialectEl     = document.getElementById('dialect');

const inputStats  = document.getElementById('input-stats');
const outputStats = document.getElementById('output-stats');

// ── Examples ──────────────────────────────────────────────────────────────────

const EXAMPLES = {
  exampleSimple: `select id,first_name,last_name,email from users where active=1 and created_at > '2024-01-01' order by last_name asc`,

  exampleJoin: `select o.id,o.order_date,c.name as customer_name,p.title as product,oi.quantity,oi.unit_price from orders o inner join customers c on c.id=o.customer_id inner join order_items oi on oi.order_id=o.id inner join products p on p.id=oi.product_id where o.status='shipped' and o.order_date between '2024-01-01' and '2024-12-31' order by o.order_date desc`,

  exampleSubquery: `select department_id,department_name,(select count(*) from employees e where e.department_id=d.id) as headcount,(select avg(salary) from employees e where e.department_id=d.id) as avg_salary from departments d where d.active=1 order by headcount desc`,

  exampleInsert: `insert into products (title,description,price,category_id,stock_qty,created_at) values ('Wireless Keyboard','Compact mechanical keyboard',89.99,3,150,current_timestamp),('USB-C Hub','7-port USB-C hub with power delivery',49.99,3,200,current_timestamp)`,

  exampleWindow: `select employee_id,department_id,salary,rank() over (partition by department_id order by salary desc) as dept_rank,round(avg(salary) over (partition by department_id),2) as dept_avg,sum(salary) over (partition by department_id order by employee_id rows between unbounded preceding and current row) as running_total from employees order by department_id,dept_rank`,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getIndentValue(raw) {
  if (raw === 'tab') return '\t';
  const n = parseInt(raw, 10);
  return ' '.repeat(n);
}

function updateStats(el, text) {
  if (!text) { el.textContent = ''; return; }
  const chars = text.length;
  const lines = text.split('\n').length;
  const charLabel = t(state.lang, 'charCount');
  const lineLabel = t(state.lang, 'lineCount');
  el.textContent = `${chars} ${charLabel} / ${lines} ${lineLabel}`;
}

function doFormat() {
  const sql = inputEl.value;
  if (!sql.trim()) return;
  try {
    const result = format(sql, {
      keywordCase: state.keywordCase,
      indent: state.indent,
      dialect: state.dialect,
    });
    outputEl.value = result;
    renderHighlight(result);
    updateStats(outputStats, result);
  } catch (e) {
    outputEl.value = '-- Error: ' + e.message;
  }
}

function doMinify() {
  const sql = inputEl.value;
  if (!sql.trim()) return;
  try {
    const result = minify(sql);
    outputEl.value = result;
    renderHighlight(result);
    updateStats(outputStats, result);
  } catch (e) {
    outputEl.value = '-- Error: ' + e.message;
  }
}

// ── Syntax highlighting ───────────────────────────────────────────────────────

import { tokenize, TOKEN_TYPES } from './tokenizer.js';

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHighlight(sql) {
  const highlightEl = document.getElementById('output-highlight');
  if (!highlightEl) return;

  const tokens = tokenize(sql);
  let html = '';
  for (const tok of tokens) {
    const escaped = escapeHtml(tok.value);
    switch (tok.type) {
      case TOKEN_TYPES.KEYWORD:
        html += `<span class="hl-keyword">${escaped}</span>`;
        break;
      case TOKEN_TYPES.STRING:
        html += `<span class="hl-string">${escaped}</span>`;
        break;
      case TOKEN_TYPES.NUMBER:
        html += `<span class="hl-number">${escaped}</span>`;
        break;
      case TOKEN_TYPES.COMMENT:
        html += `<span class="hl-comment">${escaped}</span>`;
        break;
      case TOKEN_TYPES.OPERATOR:
        html += `<span class="hl-operator">${escaped}</span>`;
        break;
      case TOKEN_TYPES.PUNCTUATION:
        html += `<span class="hl-punctuation">${escaped}</span>`;
        break;
      default:
        html += escaped;
    }
  }
  highlightEl.innerHTML = html;
  // sync scroll
  outputEl.addEventListener('scroll', () => {
    highlightEl.scrollTop = outputEl.scrollTop;
    highlightEl.scrollLeft = outputEl.scrollLeft;
  });
}

// ── i18n ──────────────────────────────────────────────────────────────────────

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const attr = el.getAttribute('data-i18n-attr');
    const value = t(state.lang, key);
    if (attr) {
      el.setAttribute(attr, value);
    } else {
      el.textContent = value;
    }
  });
  // Rebuild example buttons with current lang
  buildExampleButtons();
}

// ── Example buttons ───────────────────────────────────────────────────────────

function buildExampleButtons() {
  examplesPanel.innerHTML = '';
  Object.entries(EXAMPLES).forEach(([key, sql]) => {
    const btn = document.createElement('button');
    btn.className = 'example-btn';
    btn.textContent = t(state.lang, key);
    btn.addEventListener('click', () => {
      inputEl.value = sql;
      updateStats(inputEl, sql);
      updateStats(inputStats, sql);
      examplesPanel.classList.add('hidden');
      doFormat();
    });
    examplesPanel.appendChild(btn);
  });
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  themeBtn.textContent = state.theme === 'dark' ? '☀️' : '🌙';
}

// ── Event Listeners ───────────────────────────────────────────────────────────

formatBtn.addEventListener('click', doFormat);
minifyBtn.addEventListener('click', doMinify);

clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  outputEl.value = '';
  const hlEl = document.getElementById('output-highlight');
  if (hlEl) hlEl.innerHTML = '';
  updateStats(inputStats, '');
  updateStats(outputStats, '');
});

copyBtn.addEventListener('click', () => {
  const text = outputEl.value;
  if (!text) return;
  navigator.clipboard.writeText(text).then(() => {
    const orig = copyBtn.textContent;
    copyBtn.textContent = t(state.lang, 'copied');
    setTimeout(() => { copyBtn.textContent = orig; }, 1500);
  });
});

examplesBtn.addEventListener('click', () => {
  examplesPanel.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!examplesPanel.contains(e.target) && e.target !== examplesBtn) {
    examplesPanel.classList.add('hidden');
  }
});

langBtn.addEventListener('click', () => {
  state.lang = state.lang === 'en' ? 'ja' : 'en';
  langBtn.textContent = t(state.lang, 'langToggle');
  applyLang();
});

themeBtn.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme();
});

keywordCaseEl.addEventListener('change', () => {
  state.keywordCase = keywordCaseEl.value;
});

indentEl.addEventListener('change', () => {
  state.indent = getIndentValue(indentEl.value);
});

dialectEl.addEventListener('change', () => {
  state.dialect = dialectEl.value;
});

inputEl.addEventListener('input', () => {
  updateStats(inputStats, inputEl.value);
});

// Keyboard shortcut: Ctrl+Enter / Cmd+Enter to format
inputEl.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    doFormat();
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────

applyLang();
applyTheme();
buildExampleButtons();
