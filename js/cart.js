/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Cart Management Module
 *  Add / remove / update items, compute totals, and keep the
 *  store & UI in sync via events.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';
import { showToast, sanitizeHTML } from './utils.js';

/* ───────────── Read ───────────── */

/**
 * Get the current cart array from the store.
 * Each item: { productId, title, price, image, quantity }
 * @returns {Array}
 */
export function getCart() {
  return Store.getCart();
}

/* ───────────── Add ───────────── */

/**
 * Add a product to the cart (or increase quantity if already present).
 * @param {Object} product — must have at least { id, title, price, image }
 * @param {number} quantity — default 1
 */
export function addToCart(product, quantity = 1) {
  if (!product || !product.id) {
    showToast('Producto inválido', 'error');
    return;
  }

  const cart = getCart();
  const existing = cart.find((item) => item.productId === product.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      productId: product.id,
      title: product.title,
      price: product.price,
      image: product.image,
      category: product.category || '',
      quantity,
    });
  }

  Store.setCart(cart);
  Store.emit('cart-updated');
  showToast(`${sanitizeHTML(product.title)} agregado al carrito`, 'success');
}

/* ───────────── Remove ───────────── */

/**
 * Remove a product entirely from the cart.
 * @param {number|string} productId
 */
export function removeFromCart(productId) {
  const cart = getCart().filter((item) => item.productId !== productId);
  Store.setCart(cart);
  Store.emit('cart-updated');
  showToast('Producto eliminado del carrito', 'info');
}

/* ───────────── Quantity ───────────── */

/**
 * Set an explicit quantity for a cart item. Minimum is 1.
 * @param {number|string} productId
 * @param {number} quantity
 */
export function updateQuantity(productId, quantity) {
  const cart = getCart();
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  item.quantity = Math.max(1, Math.floor(quantity));
  Store.setCart(cart);
  Store.emit('cart-updated');
}

/**
 * Increase the quantity of a cart item by 1.
 * @param {number|string} productId
 */
export function increaseQuantity(productId) {
  const cart = getCart();
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  item.quantity += 1;
  Store.setCart(cart);
  Store.emit('cart-updated');
}

/**
 * Decrease the quantity of a cart item by 1.
 * Removes the item entirely if quantity reaches 0.
 * @param {number|string} productId
 */
export function decreaseQuantity(productId) {
  const cart = getCart();
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  item.quantity -= 1;
  if (item.quantity <= 0) {
    removeFromCart(productId);
    return;
  }
  Store.setCart(cart);
  Store.emit('cart-updated');
}

/**
 * Clone / duplicate a cart item (add another unit of the same product).
 * @param {number|string} productId
 */
export function cloneItem(productId) {
  const cart = getCart();
  const item = cart.find((i) => i.productId === productId);
  if (!item) return;

  item.quantity += 1;
  Store.setCart(cart);
  Store.emit('cart-updated');
  showToast('Producto duplicado en el carrito', 'info');
}

/* ───────────── Clear ───────────── */

/** Empty the entire cart. */
export function clearCart() {
  Store.setCart([]);
  Store.emit('cart-updated');
  showToast('Carrito vaciado', 'info');
}

/* ───────────── Totals ───────────── */

/**
 * Sum of (price × quantity) for all items.
 * @returns {number}
 */
export function getCartTotal() {
  return getCart().reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Total number of individual units in the cart.
 * @returns {number}
 */
export function getCartCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

/**
 * Subtotal for a single product line.
 * @param {number|string} productId
 * @returns {number}
 */
export function getCartSubtotal(productId) {
  const item = getCart().find((i) => i.productId === productId);
  return item ? item.price * item.quantity : 0;
}
