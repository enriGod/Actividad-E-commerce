/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Offline Support Module
 *  Detects connectivity changes, manages an offline action queue,
 *  and registers the service worker.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';
import { showToast } from './utils.js';

/* ───────────── Connection Status UI ───────────── */

/**
 * Update the footer connection indicator to reflect
 * the current online/offline state.
 */
export function updateConnectionStatus() {
  const container = document.getElementById('connection-status');
  if (!container) return;

  const dot  = container.querySelector('.status-dot');
  const text = container.querySelector('.status-text');
  const online = navigator.onLine;

  if (dot) {
    dot.classList.toggle('online', online);
    dot.classList.toggle('offline', !online);
  }
  if (text) {
    text.textContent = online ? 'Online' : 'Offline';
  }
}

/* ───────────── Offline Queue ───────────── */

/**
 * Enqueue an action to be replayed when connectivity is restored.
 * @param {{ type: string, data: *, timestamp?: string }} action
 */
export function addToOfflineQueue(action) {
  const queue = Store.getOfflineQueue();
  queue.push({
    ...action,
    timestamp: action.timestamp || new Date().toISOString(),
  });
  Store.setOfflineQueue(queue);
  console.info('[Offline] Action queued:', action.type);
}

/**
 * Process every action in the offline queue.
 * Currently handles 'create-order' actions — extend the switch
 * as more offline-capable features are added.
 */
export async function processOfflineQueue() {
  const queue = Store.getOfflineQueue();
  if (queue.length === 0) return;

  console.info(`[Offline] Processing ${queue.length} queued action(s)…`);

  for (const action of queue) {
    try {
      switch (action.type) {
        case 'create-order': {
          // Orders are already persisted locally; nothing extra to do
          // unless a server sync endpoint existed.
          console.info('[Offline] Order synced:', action.data?.id);
          break;
        }
        default:
          console.warn('[Offline] Unknown action type:', action.type);
      }
    } catch (err) {
      console.error('[Offline] Failed to process action:', action, err);
    }
  }

  // Clear queue after processing
  Store.setOfflineQueue([]);
  showToast(`${queue.length} acción(es) sincronizada(s) correctamente`, 'success');
}

/* ───────────── Init ───────────── */

/**
 * Bootstrap offline detection.
 * – Sets initial UI state.
 * – Listens for 'online' / 'offline' events.
 * – Processes any pending queue when reconnecting.
 */
export function initOfflineDetection() {
  updateConnectionStatus();

  window.addEventListener('online', () => {
    updateConnectionStatus();
    showToast('Conexión restablecida', 'success');
    processOfflineQueue();
  });

  window.addEventListener('offline', () => {
    updateConnectionStatus();
    showToast('Sin conexión — los cambios se guardarán localmente', 'warning');
  });
}

/* ───────────── Connectivity Check ───────────── */

/**
 * Simple wrapper around the navigator.onLine flag.
 * @returns {boolean}
 */
export function isOnline() {
  return navigator.onLine;
}

/* ───────────── Service Worker ───────────── */

/**
 * Register the service worker if the browser supports it.
 * The SW file is expected at /sw.js relative to the site root.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('[Offline] Service Workers not supported in this browser.');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.info('[Offline] Service Worker registered — scope:', registration.scope);
    } catch (err) {
      console.warn('[Offline] Service Worker registration failed:', err);
    }
  });
}
