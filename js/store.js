/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Central Data Store
 *  Abstraction layer over localStorage / sessionStorage with a
 *  lightweight publish-subscribe event bus for reactivity.
 * ═══════════════════════════════════════════════════════════════
 */

/* ───────────── Storage Keys ───────────── */
const KEYS = {
  PRODUCTS:        'emarket_products',
  USERS:           'emarket_users',
  SESSION:         'emarket_session',
  CART:            'emarket_cart',
  ORDERS:          'emarket_orders',
  REVIEWS:         'emarket_reviews',
  NEWSLETTER:      'emarket_newsletter',
  OFFLINE_QUEUE:   'emarket_offline_queue',
  DATA_INITIALIZED:'emarket_data_initialized',
  THEME:           'emarket_theme',
};

/* ───────────── Internal Helpers ───────────── */

/**
 * Hash a password with SHA-256 using the Web Crypto API.
 * Returns a hex-encoded digest string.
 * @param {string} password
 * @returns {Promise<string>}
 */
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ───────────── Event Bus ───────────── */

/** @type {Record<string, Function[]>} */
const _listeners = {};

/**
 * Subscribe to a store event.
 * @param {string}   event    — event name (e.g. 'cart-updated')
 * @param {Function} callback — handler receives optional data argument
 */
function on(event, callback) {
  if (!_listeners[event]) _listeners[event] = [];
  _listeners[event].push(callback);
}

/**
 * Emit a store event to all subscribers.
 * @param {string} event
 * @param {*}      data — optional payload
 */
function emit(event, data) {
  if (!_listeners[event]) return;
  for (const cb of _listeners[event]) {
    try {
      cb(data);
    } catch (err) {
      console.error(`[Store] Error in listener for "${event}":`, err);
    }
  }
}

/* ───────────── Core CRUD ───────────── */

/**
 * Read and parse a JSON value from localStorage.
 * @param {string} key
 * @returns {*} parsed value or null
 */
function get(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error(`[Store] Error reading key "${key}":`, err);
    return null;
  }
}

/**
 * Stringify and persist a value to localStorage.
 * @param {string} key
 * @param {*}      value
 */
function set(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`[Store] Error writing key "${key}":`, err);
  }
}

/**
 * Remove a key from localStorage.
 * @param {string} key
 */
function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    console.error(`[Store] Error removing key "${key}":`, err);
  }
}

/* ───────────── Domain Accessors ───────────── */

// — Products —
function getProducts()          { return get(KEYS.PRODUCTS) || []; }
function setProducts(products)  { set(KEYS.PRODUCTS, products); emit('products-updated', products); }

// — Users —
function getUsers()             { return get(KEYS.USERS) || []; }
function setUsers(users)        { set(KEYS.USERS, users); }

// — Orders —
function getOrders()            { return get(KEYS.ORDERS) || []; }
function setOrders(orders)      { set(KEYS.ORDERS, orders); }

// — Reviews —
function getReviews()           { return get(KEYS.REVIEWS) || []; }
function setReviews(reviews)    { set(KEYS.REVIEWS, reviews); }

// — Cart —
function getCart()              { return get(KEYS.CART) || []; }
function setCart(cart)           { set(KEYS.CART, cart); emit('cart-updated', cart); }

// — Newsletter —
function getNewsletter()        { return get(KEYS.NEWSLETTER) || []; }
function setNewsletter(emails)  { set(KEYS.NEWSLETTER, emails); }

// — Offline Queue —
function getOfflineQueue()      { return get(KEYS.OFFLINE_QUEUE) || []; }
function setOfflineQueue(queue) { set(KEYS.OFFLINE_QUEUE, queue); }

/* ───────────── Initialization Flags ───────────── */

/**
 * Check whether the product catalog has already been seeded.
 * @returns {boolean}
 */
function isDataInitialized() {
  return get(KEYS.DATA_INITIALIZED) === true;
}

/** Mark the data catalog as seeded. */
function setDataInitialized() {
  set(KEYS.DATA_INITIALIZED, true);
}

/* ───────────── Default Admin ───────────── */

/**
 * Ensure a default admin account exists on first load.
 * Credentials: admin@emarket.com / admin123
 */
async function initDefaultAdmin() {
  const users = getUsers();
  const adminExists = users.some((u) => u.email === 'admin@emarket.com');
  if (adminExists) return;

  const hashedPw = await hashPassword('admin123');
  const admin = {
    id: crypto.randomUUID ? crypto.randomUUID() : 'admin-' + Date.now(),
    name: 'Administrador',
    email: 'admin@emarket.com',
    password: hashedPw,
    role: 'admin',
    avatar: '',
    address: '',
    createdAt: new Date().toISOString(),
  };

  users.push(admin);
  setUsers(users);
  console.info('[Store] Default admin account created.');
}

/* ───────────── Public API (single export) ───────────── */

export const Store = {
  /* keys constant — useful for direct access if needed */
  KEYS,

  /* low-level */
  get,
  set,
  remove,

  /* domain */
  getProducts,
  setProducts,
  getUsers,
  setUsers,
  getOrders,
  setOrders,
  getReviews,
  setReviews,
  getCart,
  setCart,
  getNewsletter,
  setNewsletter,
  getOfflineQueue,
  setOfflineQueue,

  /* init */
  isDataInitialized,
  setDataInitialized,
  initDefaultAdmin,

  /* event bus */
  on,
  emit,
};
