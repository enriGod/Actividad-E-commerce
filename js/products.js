/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Product Catalog Module
 *  Rendering, filtering, sorting and category management for the
 *  product catalog pages.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';
import { sanitizeHTML, formatCurrency } from './utils.js';
import { starsHTML } from './reviews.js';
import { addToCart } from './cart.js';

/* ───────────── Rendering ───────────── */

/**
 * Generate the HTML for a single product card.
 * Includes image, title, category badge, price, rating stars and
 * an "Add to cart" button.
 * @param {Object} product
 * @returns {string} HTML string
 */
export function renderProductCard(product) {
  const stars = starsHTML(product.rating || 0);
  const stockLabel =
    product.stock > 20
      ? `<span class="stock-badge in-stock">En stock</span>`
      : product.stock > 0
        ? `<span class="stock-badge low-stock">Quedan ${product.stock}</span>`
        : `<span class="stock-badge out-of-stock">Agotado</span>`;

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-card-image">
        <img
          src="${sanitizeHTML(product.image)}"
          alt="${sanitizeHTML(product.title)}"
          loading="lazy"
        />
        ${stockLabel}
      </div>
      <div class="product-card-body">
        <span class="product-card-category">${sanitizeHTML(product.category)}</span>
        <h3 class="product-card-title">
          <a href="${resolvePath('pages/product.html')}?id=${product.id}">
            ${sanitizeHTML(product.title)}
          </a>
        </h3>
        <div class="product-card-rating">
          ${stars}
          <span class="rating-count">(${product.ratingCount || 0})</span>
        </div>
        <div class="product-card-footer">
          <span class="product-card-price">${formatCurrency(product.price)}</span>
          <button
            class="btn btn-primary btn-add-cart"
            data-product-id="${product.id}"
            ${product.stock <= 0 ? 'disabled' : ''}
          >
            🛒 Agregar
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Resolve a path relative to the current page.
 * Works whether we're at root (index.html) or inside /pages/.
 * @param {string} path — e.g. 'pages/product.html'
 * @returns {string}
 */
function resolvePath(path) {
  const inPages = window.location.pathname.includes('/pages/');
  if (inPages) {
    // Strip the 'pages/' prefix when already inside /pages/
    return path.replace(/^pages\//, '');
  }
  return path;
}

/**
 * Render a grid of product cards into a container, with staggered
 * entrance animations.
 * @param {Object[]} products
 * @param {string}   containerId — DOM element id
 */
export function renderProductGrid(products, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="
        grid-column:1/-1;text-align:center;padding:60px 20px;
        color:var(--text-secondary,#666);
      ">
        <span style="font-size:48px;">🔍</span>
        <h3 style="margin:12px 0 4px;">No se encontraron productos</h3>
        <p>Intenta ajustar los filtros de búsqueda.</p>
      </div>`;
    return;
  }

  container.innerHTML = products.map(renderProductCard).join('');

  // Staggered entrance animation
  const cards = container.querySelectorAll('.product-card');
  cards.forEach((card, i) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition = 'opacity .4s ease, transform .4s ease';
    setTimeout(() => {
      card.style.opacity = '1';
      card.style.transform = 'translateY(0)';
    }, i * 60);
  });

  // Delegate add-to-cart clicks
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-add-cart');
    if (!btn) return;
    const productId = Number(btn.dataset.productId);
    const product = Store.getProducts().find((p) => p.id === productId);
    if (product) addToCart(product);
  });
}

/* ───────────── Filtering ───────────── */

/**
 * Filter products by category, price range and search text.
 * @param {Object[]} products
 * @param {{ category?: string, minPrice?: number, maxPrice?: number, search?: string }} filters
 * @returns {Object[]}
 */
export function filterProducts(products, filters = {}) {
  return products.filter((p) => {
    // Category
    if (filters.category && filters.category !== 'all') {
      if (p.category.toLowerCase() !== filters.category.toLowerCase()) return false;
    }

    // Price range
    if (filters.minPrice != null && p.price < filters.minPrice) return false;
    if (filters.maxPrice != null && p.price > filters.maxPrice) return false;

    // Full-text search on title + description
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const haystack = `${p.title} ${p.description}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    return true;
  });
}

/* ───────────── Sorting ───────────── */

/**
 * Sort products by a given criterion.
 * @param {Object[]} products
 * @param {'price-asc'|'price-desc'|'name-asc'|'name-desc'|'rating-desc'} sortBy
 * @returns {Object[]} new sorted array
 */
export function sortProducts(products, sortBy) {
  const sorted = [...products];

  switch (sortBy) {
    case 'price-asc':
      sorted.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      sorted.sort((a, b) => b.price - a.price);
      break;
    case 'name-asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'es'));
      break;
    case 'name-desc':
      sorted.sort((a, b) => b.title.localeCompare(a.title, 'es'));
      break;
    case 'rating-desc':
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    default:
      break;
  }

  return sorted;
}

/* ───────────── Categories ───────────── */

/**
 * Extract the unique set of categories from a product array.
 * @param {Object[]} products
 * @returns {string[]}
 */
export function getCategories(products) {
  const set = new Set(products.map((p) => p.category || 'general'));
  return [...set].sort((a, b) => String(a).localeCompare(String(b), 'es'));
}

/**
 * Retrieve a single product by its id from the store.
 * @param {number|string} productId
 * @returns {Object|undefined}
 */
export function getProductById(productId) {
  return Store.getProducts().find((p) => String(p.id) === String(productId));
}

/**
 * Render clickable category filter chips into a container.
 * @param {string[]}  categories
 * @param {string}    containerId
 * @param {Function}  onSelect — callback receiving the selected category string
 */
export function renderCategoryChips(categories, containerId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Prepend an "All" option
  const allCats = ['all', ...categories];

  container.innerHTML = allCats
    .map(
      (cat) => `
      <button
        class="category-chip ${cat === 'all' ? 'active' : ''}"
        data-category="${sanitizeHTML(cat)}"
      >
        ${cat === 'all' ? '🏷️ Todos' : sanitizeHTML(cat)}
      </button>
    `,
    )
    .join('');

  // Delegate clicks
  container.addEventListener('click', (e) => {
    const chip = e.target.closest('.category-chip');
    if (!chip) return;

    // Visual active state
    container.querySelectorAll('.category-chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');

    const selected = chip.dataset.category;
    if (typeof onSelect === 'function') onSelect(selected);
  });
}
