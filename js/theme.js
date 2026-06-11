/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Theme Module
 *  Manages light/dark theme toggling and persistence.
 *  The inline <script> in <head> handles the initial FOUC-free
 *  set; this module takes care of the interactive toggle and
 *  runtime updates.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';

const STORAGE_KEY = 'emarket_theme';

/* ───────────── Helpers ───────────── */

/** @returns {'light'|'dark'} current active theme */
function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/** Update the toggle button icon to reflect current theme. */
function updateIcon() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const icon = btn.querySelector('.theme-icon');
  if (!icon) return;
  icon.textContent = getCurrentTheme() === 'dark' ? '☀️' : '🌙';
}

/** Apply a theme to the document and persist choice. */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(STORAGE_KEY, theme);
  updateIcon();
}

/* ───────────── Public API ───────────── */

/**
 * Initialise the theme system.
 * – Reads stored preference (or falls back to system setting).
 * – Updates the toggle icon.
 * – Listens for OS-level theme changes.
 */
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved) {
    applyTheme(saved);
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }

  // React to OS-level changes (e.g. user enables system dark mode)
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    // Only auto-switch if the user hasn't manually set a preference
    if (!localStorage.getItem(STORAGE_KEY)) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

/**
 * Toggle between light and dark themes.
 * Persists the choice and emits a 'theme-changed' event.
 */
export function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  Store.emit('theme-changed', next);
}

/* ───────────── Auto-Setup ───────────── */

/**
 * Self-initialising: when this module is first imported it waits for
 * the DOM to be ready, then wires up the toggle button.
 */
function autoSetup() {
  const bind = () => {
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
    // Set icon on load
    updateIcon();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
}

autoSetup();
