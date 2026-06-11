/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Checkout Module
 *  Card validation, input formatting, order creation and
 *  order management.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';
import { generateId, showToast } from './utils.js';
import { clearCart, getCart, getCartTotal } from './cart.js';
import { getCurrentUser } from './auth.js';
import { isOnline, addToOfflineQueue } from './offline.js';

/* ═══════════════════════════════════════════════
   Card Validation
   ═══════════════════════════════════════════════ */

/**
 * Validate a card number with the Luhn algorithm + length check.
 * @param {string|number} number
 * @returns {boolean}
 */
export function validateCardNumber(number) {
  const digits = String(number).replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19;
}

/**
 * Validate a card expiry date string (MM/YY).
 * Must be a future date.
 * @param {string} expiry — "MM/YY"
 * @returns {boolean}
 */
export function validateExpiry(expiry) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(expiry?.trim());
  if (!match) return false;

  const month = parseInt(match[1], 10); // 1-12
  const year  = parseInt(match[2], 10) + 2000;

  const now = new Date();
  const currentYear  = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // getMonth() es 0-indexed

  if (year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;
  return true;
}

/**
 * Validate a CVV (3–4 digits).
 * @param {string} cvv
 * @returns {boolean}
 */
export function validateCVV(cvv) {
  return /^\d{3,4}$/.test(cvv?.trim());
}

/* ═══════════════════════════════════════════════
   Input Formatting (as-you-type)
   ═══════════════════════════════════════════════ */

/**
 * Attach an input listener that formats a card number with spaces
 * every 4 digits.
 * @param {HTMLInputElement} input
 */
export function formatCardNumber(input) {
  if (!input) return;

  input.addEventListener('input', () => {
    const raw = input.value.replace(/\D/g, '').slice(0, 19);
    input.value = raw.replace(/(.{4})/g, '$1 ').trim();
  });
}

/**
 * Attach an input listener that auto-inserts the "/" separator
 * after the month portion of an expiry field.
 * @param {HTMLInputElement} input
 */
export function formatExpiry(input) {
  if (!input) return;

  input.addEventListener('input', () => {
    let raw = input.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2);
    }
    input.value = raw;
  });
}

/* ═══════════════════════════════════════════════
   Card-Type Detection
   ═══════════════════════════════════════════════ */

/**
 * Detect the card issuer from the first digits of the number.
 * @param {string} number — card number (may include spaces)
 * @returns {'visa'|'mastercard'|'amex'|'unknown'}
 */
export function detectCardType(number) {
  const digits = String(number).replace(/\D/g, '');

  // AMEX: starts with 34 or 37
  if (/^3[47]/.test(digits)) return 'amex';

  // Mastercard: starts with 51-55 or 2221-2720
  if (/^5[1-5]/.test(digits) || /^2[2-7]/.test(digits)) return 'mastercard';

  // Visa: starts with 4
  if (/^4/.test(digits)) return 'visa';

  return 'unknown';
}

/* ═══════════════════════════════════════════════
   Order Processing
   ═══════════════════════════════════════════════ */

/**
 * Create an order, persist it, clear the cart, and optionally queue
 * it for offline sync.
 *
 * @param {{
 *   shippingAddress: string,
 *   paymentLast4: string,
 *   items?: Array,
 *   total?: number
 * }} orderData — caller may override items/total, otherwise cart is used
 * @returns {Promise<Object>} the created order
 */
export async function processOrder(orderData) {
  const user = getCurrentUser();
  if (!user) {
    showToast('Debes iniciar sesión para realizar una compra', 'warning');
    throw new Error('Not authenticated');
  }

  const items = orderData.items || getCart();
  const total = orderData.total ?? getCartTotal();

  if (items.length === 0) {
    showToast('El carrito está vacío', 'warning');
    throw new Error('Cart is empty');
  }

  const order = {
    id: generateId(),
    userId: user.userId,
    userName: user.name,
    userEmail: user.email,
    items: JSON.parse(JSON.stringify(items)), // deep copy
    total,
    shippingAddress: orderData.shippingAddress,
    paymentLast4: orderData.paymentLast4,
    status: 'Pendiente',
    createdAt: new Date().toISOString(),
  };

  // Persist
  const orders = Store.getOrders();
  orders.push(order);
  Store.setOrders(orders);

  // Reduce stock
  const products = Store.getProducts();
  for (const item of items) {
    const prod = products.find((p) => p.id === item.productId);
    if (prod) {
      prod.stock = Math.max(0, prod.stock - item.quantity);
    }
  }
  Store.setProducts(products);

  // Clear cart
  clearCart();

  // Queue for sync if offline
  if (!isOnline()) {
    addToOfflineQueue({ type: 'create-order', data: order });
  }

  showToast('¡Pedido realizado con éxito!', 'success');
  return order;
}

/* ═══════════════════════════════════════════════
   Order Queries
   ═══════════════════════════════════════════════ */

/**
 * Get all orders for a specific user, newest first.
 * @param {string} userId
 * @returns {Object[]}
 */
export function getOrdersByUser(userId) {
  return Store.getOrders()
    .filter((o) => o.userId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Return all orders (admin view), newest first.
 * @returns {Object[]}
 */
export function getAllOrders() {
  return Store.getOrders()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Update the status of an existing order.
 * @param {string} orderId
 * @param {'Pendiente'|'Enviado'|'Entregado'} status
 * @returns {boolean} true if updated
 */
export function updateOrderStatus(orderId, status) {
  const validStatuses = ['Pendiente', 'Enviado', 'Entregado'];
  if (!validStatuses.includes(status)) {
    showToast('Estado no válido', 'error');
    return false;
  }

  const orders = Store.getOrders();
  const order = orders.find((o) => o.id === orderId);
  if (!order) {
    showToast('Pedido no encontrado', 'error');
    return false;
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  Store.setOrders(orders);
  showToast(`Pedido actualizado a "${status}"`, 'success');
  return true;
}
