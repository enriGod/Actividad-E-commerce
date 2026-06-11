/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — API Consumption Module
 *  Fetches product data from the FakeStore API and seeds the
 *  local store on first visit.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';

const BASE_URL = 'https://fakestoreapi.com';

/* ───────────── Raw Fetchers ───────────── */

/**
 * Fetch all products from the FakeStore API.
 * @returns {Promise<Array>} raw product array
 */
export async function fetchProductsFromAPI() {
  const response = await fetch(`${BASE_URL}/products`);
  if (!response.ok) {
    throw new Error(`FakeStore API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch available categories from the FakeStore API.
 * @returns {Promise<string[]>} array of category names
 */
export async function fetchCategoriesFromAPI() {
  const response = await fetch(`${BASE_URL}/products/categories`);
  if (!response.ok) {
    throw new Error(`FakeStore API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

/* ───────────── Transformer ───────────── */

/**
 * Map a raw FakeStore product to our internal schema.
 * Adds a random stock count (10–99) and a creation timestamp.
 * @param {Object} original — raw API product
 * @returns {Object} transformed product
 */
function transformProduct(original) {
  return {
    id: original.id,
    title: original.title,
    description: original.description,
    price: original.price,
    category: original.category,
    image: original.image,
    rating: original.rating?.rate ?? 0,
    ratingCount: original.rating?.count ?? 0,
    stock: Math.floor(Math.random() * 90) + 10,
    createdAt: new Date().toISOString(),
  };
}

/* ───────────── Initialiser ───────────── */

/**
 * Seed the product catalog on first launch.
 *
 * 1. If data is already initialised (flag in localStorage) → return
 *    the existing products.
 * 2. Otherwise fetch from the FakeStore API, transform every product,
 *    persist to the store and set the initialised flag.
 * 3. If the network request fails (offline / error) → return an empty
 *    array so the app can still render gracefully.
 *
 * @returns {Promise<Array>} product array
 */
export async function initializeProducts() {
  // Already seeded — nothing to do
  if (Store.isDataInitialized()) {
    return Store.getProducts();
  }

  try {
    const rawProducts = await fetchProductsFromAPI();
    const products = rawProducts.map(transformProduct);

    Store.setProducts(products);
    Store.setDataInitialized();

    console.info(`[API] Seeded ${products.length} products from FakeStore API.`);
    return products;
  } catch (err) {
    console.warn('[API] Failed to fetch products — app may be offline.', err);
    return [];
  }
}
