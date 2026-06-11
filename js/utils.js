/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Utility Functions Module
 *  Pure helper functions used across the entire application.
 * ═══════════════════════════════════════════════════════════════
 */

/* ───────────── ID Generation ───────────── */

/**
 * Generate a UUID v4 string.
 * Uses the native crypto.randomUUID() when available, otherwise
 * falls back to a standards-compliant manual implementation.
 * @returns {string} UUID v4
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback — RFC 4122 compliant
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* ───────────── Currency ───────────── */

/**
 * Format a number as USD currency ($XX.XX).
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount);
  if (Number.isNaN(num)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/* ───────────── Debounce ───────────── */

/**
 * Classic debounce — delays invocation until after `ms` milliseconds
 * of silence since the last call.
 * @param {Function} fn  — function to debounce
 * @param {number}   ms  — delay in milliseconds (default 300)
 * @returns {Function}
 */
export function debounce(fn, ms = 300) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* ───────────── Validation ───────────── */

/**
 * Validate an email address with a robust regex.
 * @param {string} email
 * @returns {boolean}
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Validate a credit-card number using the Luhn algorithm.
 * @param {string|number} number — card number (digits only)
 * @returns {boolean}
 */
export function validateCard(number) {
  const digits = String(number).replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits[i], 10);

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/* ───────────── Time Helpers ───────────── */

/**
 * Return a human-readable relative time string in Spanish.
 * e.g. "hace 5 minutos", "hace 2 horas", "hace 3 días"
 * @param {string} dateString — ISO date string
 * @returns {string}
 */
export function timeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 0) return 'justo ahora';

  const intervals = [
    { label: 'año', seconds: 31536000 },
    { label: 'mes', seconds: 2592000 },
    { label: 'semana', seconds: 604800 },
    { label: 'día', seconds: 86400 },
    { label: 'hora', seconds: 3600 },
    { label: 'minuto', seconds: 60 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(seconds / interval.seconds);
    if (count >= 1) {
      // Spanish pluralisation rules
      let plural;
      if (interval.label === 'mes') {
        plural = count === 1 ? 'mes' : 'meses';
      } else {
        plural = count === 1 ? interval.label : `${interval.label}s`;
      }
      return `hace ${count} ${plural}`;
    }
  }

  return 'justo ahora';
}

/**
 * Format a date string as DD/MM/YYYY.
 * @param {string} dateString — ISO date string
 * @returns {string}
 */
export function formatDate(dateString) {
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/* ───────────── Security ───────────── */

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function sanitizeHTML(str) {
  if (!str || typeof str !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, (char) => map[char]);
}

/* ───────────── Toast Notifications ───────────── */

// Ensure a single toast container exists in the DOM
function getToastContainer() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = `
      position: fixed;
      top: 24px;
      right: 24px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
      max-width: 380px;
      width: calc(100% - 48px);
    `;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Show a toast notification that auto-dismisses after 3 seconds.
 * @param {string} message — notification text
 * @param {'success'|'error'|'info'|'warning'} type — visual style
 */
export function showToast(message, type = 'info') {
  const container = getToastContainer();

  // Colour map aligned with our design tokens
  const colours = {
    success: { bg: '#10b981', icon: '✅' },
    error:   { bg: '#f43f5e', icon: '❌' },
    info:    { bg: '#7c3aed', icon: 'ℹ️' },
    warning: { bg: '#f59e0b', icon: '⚠️' },
  };

  const { bg, icon } = colours[type] || colours.info;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 20px;
    border-radius: 12px;
    background: ${bg};
    color: #fff;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 8px 32px rgba(0,0,0,.25);
    pointer-events: auto;
    opacity: 0;
    transform: translateX(40px);
    transition: opacity .3s ease, transform .3s ease;
    cursor: pointer;
    backdrop-filter: blur(8px);
  `;

  toast.innerHTML = `<span style="font-size:18px">${icon}</span><span>${sanitizeHTML(message)}</span>`;

  container.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  // Dismiss helper
  const dismiss = () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(40px)';
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  // Auto-dismiss after 3 s
  const timer = setTimeout(dismiss, 3000);

  // Click to dismiss immediately
  toast.addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });
}

/* ───────────── Miscellaneous ───────────── */

/**
 * Promise-based delay.
 * @param {number} ms — milliseconds
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
