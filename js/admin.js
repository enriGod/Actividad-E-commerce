/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Admin Panel Module
 *  Product CRUD, sales metrics, canvas bar charts, and dashboard
 *  rendering utilities for the admin interface.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';
import { generateId, formatCurrency, sanitizeHTML, showToast, formatDate } from './utils.js';

/* ═══════════════════════════════════════════════
   Product CRUD
   ═══════════════════════════════════════════════ */

/**
 * Add a new product to the catalog.
 * @param {{ title: string, description: string, price: number, category: string, image: string, stock: number }} productData
 * @returns {Object} the created product
 */
export function addProduct(productData) {
  const product = {
    id: generateId(),
    title: productData.title?.trim() || 'Sin título',
    description: productData.description?.trim() || '',
    price: Number(productData.price) || 0,
    category: productData.category?.trim() || 'general',
    image: productData.image?.trim() || 'https://via.placeholder.com/300',
    rating: productData.rating || 0,
    ratingCount: productData.ratingCount || 0,
    stock: Math.max(0, Math.floor(Number(productData.stock) || 0)),
    createdAt: new Date().toISOString(),
  };

  const products = Store.getProducts();
  products.push(product);
  Store.setProducts(products);

  showToast('Producto creado exitosamente', 'success');
  return product;
}

/**
 * Update an existing product's fields.
 * @param {string|number} productId
 * @param {Object} updates — partial product data
 * @returns {Object|null} updated product or null if not found
 */
export function updateProduct(productId, updates) {
  const products = Store.getProducts();
  const idx = products.findIndex((p) => String(p.id) === String(productId));
  if (idx === -1) {
    showToast('Producto no encontrado', 'error');
    return null;
  }

  // Merge allowed fields
  const allowed = ['title', 'description', 'price', 'category', 'image', 'stock', 'rating', 'ratingCount'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      products[idx][key] = key === 'price' || key === 'stock' || key === 'rating' || key === 'ratingCount'
        ? Number(updates[key])
        : updates[key];
    }
  }
  products[idx].updatedAt = new Date().toISOString();

  Store.setProducts(products);
  showToast('Producto actualizado', 'success');
  return products[idx];
}

/**
 * Delete a product from the catalog.
 * @param {string|number} productId
 * @returns {boolean}
 */
export function deleteProduct(productId) {
  const products = Store.getProducts();
  const filtered = products.filter((p) => String(p.id) !== String(productId));

  if (filtered.length === products.length) {
    showToast('Producto no encontrado', 'error');
    return false;
  }

  Store.setProducts(filtered);
  showToast('Producto eliminado', 'info');
  return true;
}

/**
 * Return all products, optionally sorted.
 * @param {'price-asc'|'price-desc'|'name-asc'|'name-desc'|'rating-desc'|'date-desc'} [sortBy]
 * @returns {Object[]}
 */
export function getProductsSorted(sortBy) {
  const products = [...Store.getProducts()];

  switch (sortBy) {
    case 'price-asc':    products.sort((a, b) => a.price - b.price); break;
    case 'price-desc':   products.sort((a, b) => b.price - a.price); break;
    case 'name-asc':     products.sort((a, b) => a.title.localeCompare(b.title, 'es')); break;
    case 'name-desc':    products.sort((a, b) => b.title.localeCompare(a.title, 'es')); break;
    case 'rating-desc':  products.sort((a, b) => (b.rating || 0) - (a.rating || 0)); break;
    case 'date-desc':    products.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); break;
    default: break;
  }

  return products;
}

/* ═══════════════════════════════════════════════
   Metrics & Analytics
   ═══════════════════════════════════════════════ */

/**
 * Compute high-level sales and platform metrics.
 * @returns {{ totalRevenue: number, totalOrders: number, totalProducts: number, totalUsers: number, activeUsers: number }}
 */
export function getSalesMetrics() {
  const orders   = Store.getOrders();
  const products = Store.getProducts();
  const users    = Store.getUsers();

  const totalRevenue  = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalOrders   = orders.length;
  const totalProducts = products.length;
  const totalUsers    = users.length;

  // "Active" = users who logged in within the last 24 h
  const oneDayAgo = new Date(Date.now() - 86400000).toISOString();
  const activeUsers = users.filter((u) => u.lastLogin && u.lastLogin >= oneDayAgo).length;

  return { totalRevenue, totalOrders, totalProducts, totalUsers, activeUsers };
}

/**
 * Identify the best-selling products based on order history.
 * @param {number} limit — max number of results
 * @returns {{ productId: *, title: string, totalSold: number }[]}
 */
export function getTopProducts(limit = 3) {
  const orders = Store.getOrders();
  /** @type {Record<string, { title: string, totalSold: number }>} */
  const salesMap = {};

  for (const order of orders) {
    for (const item of order.items || []) {
      const key = String(item.productId);
      if (!salesMap[key]) {
        salesMap[key] = { title: item.title || 'Desconocido', totalSold: 0 };
      }
      salesMap[key].totalSold += item.quantity || 1;
    }
  }

  return Object.entries(salesMap)
    .map(([productId, data]) => ({ productId, ...data }))
    .sort((a, b) => b.totalSold - a.totalSold)
    .slice(0, limit);
}

/* ═══════════════════════════════════════════════
   Canvas Bar Chart
   ═══════════════════════════════════════════════ */

/**
 * Render a modern bar chart on a <canvas> element using the 2D API.
 *
 * @param {string} canvasId — id of the <canvas> element
 * @param {{ label: string, value: number, color: string }[]} data
 * @param {{ title?: string, yLabel?: string, height?: number }} [options]
 */
export function renderBarChart(canvasId, data, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const height = options.height || 320;
  const width  = canvas.parentElement?.clientWidth || 600;

  // Hi-DPI canvas
  canvas.width  = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width  = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  // Layout constants
  const padding = { top: 40, right: 24, bottom: 56, left: 60 };
  const chartW  = width  - padding.left - padding.right;
  const chartH  = height - padding.top  - padding.bottom;
  const barGap  = 12;
  const barW    = Math.max(20, (chartW - barGap * (data.length + 1)) / data.length);
  const maxVal  = Math.max(...data.map((d) => d.value), 1);

  // ── Background ──
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  ctx.fillStyle = isDark ? '#1a1432' : '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // ── Title ──
  if (options.title) {
    ctx.fillStyle = isDark ? '#f1f0ff' : '#1e1b4b';
    ctx.font = '600 15px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(options.title, padding.left, 26);
  }

  // ── Gridlines ──
  const gridLines = 5;
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  ctx.lineWidth = 1;
  ctx.font = '400 11px Inter, sans-serif';
  ctx.fillStyle = isDark ? '#a5a3c0' : '#6b7280';
  ctx.textAlign = 'right';

  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + chartH - (chartH / gridLines) * i;
    const val = ((maxVal / gridLines) * i).toFixed(0);

    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(padding.left + chartW, y);
    ctx.stroke();

    ctx.fillText(val, padding.left - 8, y + 4);
  }

  // ── Bars ──
  data.forEach((d, i) => {
    const x = padding.left + barGap + i * (barW + barGap);
    const barH = (d.value / maxVal) * chartH;
    const y = padding.top + chartH - barH;
    const radius = Math.min(6, barW / 2);

    // Gradient fill
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, d.color || '#7c3aed');
    grad.addColorStop(1, adjustAlpha(d.color || '#7c3aed', 0.6));

    // Rounded-top bar (clip arc at top corners)
    ctx.beginPath();
    ctx.moveTo(x, y + barH);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.arcTo(x + barW, y, x + barW, y + radius, radius);
    ctx.lineTo(x + barW, y + barH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Value on top
    ctx.fillStyle = isDark ? '#f1f0ff' : '#1e1b4b';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d.value, x + barW / 2, y - 8);

    // Label at bottom
    ctx.fillStyle = isDark ? '#a5a3c0' : '#6b7280';
    ctx.font = '400 11px Inter, sans-serif';
    ctx.textAlign = 'center';

    // Truncate long labels
    const maxLabelW = barW + barGap;
    let label = d.label;
    while (ctx.measureText(label).width > maxLabelW && label.length > 3) {
      label = label.slice(0, -2) + '…';
    }
    ctx.fillText(label, x + barW / 2, padding.top + chartH + 20);
  });
}

/**
 * Quick helper to darken/lighten a hex color's alpha
 * (returns an rgba string).
 */
function adjustAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ═══════════════════════════════════════════════
   Render Helpers
   ═══════════════════════════════════════════════ */

/**
 * Render an orders / sales table with editable status dropdowns.
 * @param {Object[]} orders
 * @param {string}   containerId
 */
export function renderSalesTable(orders, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (orders.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:40px;color:var(--text-secondary,#666);">
        <span style="font-size:40px;">📭</span>
        <p>No hay pedidos registrados.</p>
      </div>`;
    return;
  }

  const statusColors = {
    'Pendiente':  '#f59e0b',
    'Enviado':    '#06b6d4',
    'Entregado':  '#10b981',
  };

  container.innerHTML = `
    <div class="table-responsive" style="overflow-x:auto;">
      <table class="admin-table" style="
        width:100%;border-collapse:separate;border-spacing:0;
        font-size:14px;
      ">
        <thead>
          <tr style="background:var(--surface-alt,#f5f3ff);">
            <th style="padding:14px 12px;text-align:left;border-radius:12px 0 0 0;">ID</th>
            <th style="padding:14px 12px;text-align:left;">Cliente</th>
            <th style="padding:14px 12px;text-align:left;">Items</th>
            <th style="padding:14px 12px;text-align:right;">Total</th>
            <th style="padding:14px 12px;text-align:left;">Fecha</th>
            <th style="padding:14px 12px;text-align:center;border-radius:0 12px 0 0;">Estado</th>
          </tr>
        </thead>
        <tbody>
          ${orders.map((o) => {
            const borderColor = statusColors[o.status] || '#999';
            return `
              <tr style="border-bottom:1px solid var(--border,#e5e7eb);">
                <td style="padding:12px;font-family:monospace;font-size:12px;" title="${o.id}">
                  ${o.id.slice(0, 8)}…
                </td>
                <td style="padding:12px;">
                  <div>${sanitizeHTML(o.userName || '—')}</div>
                  <div style="font-size:12px;color:var(--text-secondary,#666);">${sanitizeHTML(o.userEmail || '')}</div>
                </td>
                <td style="padding:12px;">${(o.items || []).length} producto(s)</td>
                <td style="padding:12px;text-align:right;font-weight:600;">${formatCurrency(o.total)}</td>
                <td style="padding:12px;font-size:13px;">${formatDate(o.createdAt)}</td>
                <td style="padding:12px;text-align:center;">
                  <select
                    class="status-select"
                    data-order-id="${o.id}"
                    style="
                      padding:6px 10px;border-radius:8px;font-size:13px;font-weight:600;
                      border:2px solid ${borderColor};color:${borderColor};
                      background:transparent;cursor:pointer;
                    "
                  >
                    ${['Pendiente', 'Enviado', 'Entregado'].map((s) =>
                      `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`
                    ).join('')}
                  </select>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Handle status changes
  container.querySelectorAll('.status-select').forEach((select) => {
    select.addEventListener('change', (e) => {
      const orderId  = e.target.dataset.orderId;
      const newStatus = e.target.value;

      const allOrders = Store.getOrders();
      const order = allOrders.find((o) => o.id === orderId);
      if (order) {
        order.status = newStatus;
        order.updatedAt = new Date().toISOString();
        Store.setOrders(allOrders);

        const color = statusColors[newStatus] || '#999';
        e.target.style.borderColor = color;
        e.target.style.color = color;

        showToast(`Pedido actualizado a "${newStatus}"`, 'success');
      }
    });
  });
}

/**
 * Render a create / edit product form.
 * @param {Object|null} product — if provided, populates the form for editing
 * @param {string}      containerId
 */
export function renderProductForm(product, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const isEdit = product !== null && product !== undefined;

  container.innerHTML = `
    <form class="product-form" id="admin-product-form" style="
      display:grid;grid-template-columns:1fr 1fr;gap:18px;
      padding:28px;border-radius:16px;
      background:var(--surface,#fff);
      border:1px solid var(--border,#e5e7eb);
    ">
      <h3 style="grid-column:1/-1;margin:0 0 4px;font-weight:700;">
        ${isEdit ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
      </h3>

      ${isEdit ? `<input type="hidden" id="product-id" value="${product.id}">` : ''}

      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="product-title" style="font-size:13px;font-weight:600;">Título</label>
        <input type="text" id="product-title" value="${isEdit ? sanitizeHTML(product.title) : ''}"
          required placeholder="Nombre del producto" style="${inputStyle()}">
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="product-category" style="font-size:13px;font-weight:600;">Categoría</label>
        <input type="text" id="product-category" value="${isEdit ? sanitizeHTML(product.category) : ''}"
          required placeholder="electronics, jewelery…" style="${inputStyle()}">
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="product-price" style="font-size:13px;font-weight:600;">Precio (USD)</label>
        <input type="number" id="product-price" value="${isEdit ? product.price : ''}"
          min="0" step="0.01" required placeholder="29.99" style="${inputStyle()}">
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;">
        <label for="product-stock" style="font-size:13px;font-weight:600;">Stock</label>
        <input type="number" id="product-stock" value="${isEdit ? product.stock : ''}"
          min="0" required placeholder="50" style="${inputStyle()}">
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;grid-column:1/-1;">
        <label for="product-image" style="font-size:13px;font-weight:600;">URL de Imagen</label>
        <input type="url" id="product-image" value="${isEdit ? sanitizeHTML(product.image) : ''}"
          placeholder="https://…" style="${inputStyle()}">
      </div>

      <div style="display:flex;flex-direction:column;gap:6px;grid-column:1/-1;">
        <label for="product-description" style="font-size:13px;font-weight:600;">Descripción</label>
        <textarea id="product-description" rows="3" placeholder="Describe el producto…" style="
          ${inputStyle()}resize:vertical;
        ">${isEdit ? sanitizeHTML(product.description) : ''}</textarea>
      </div>

      <div style="grid-column:1/-1;display:flex;gap:12px;justify-content:flex-end;">
        <button type="button" id="cancel-product-btn" class="btn btn-secondary" style="
          padding:10px 24px;border-radius:10px;border:1px solid var(--border,#e5e7eb);
          background:transparent;color:var(--text,#1e1b4b);cursor:pointer;font-weight:600;
        ">Cancelar</button>
        <button type="submit" class="btn btn-primary" style="
          padding:10px 24px;border-radius:10px;border:none;
          background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;
          font-weight:600;cursor:pointer;
        ">${isEdit ? 'Guardar Cambios' : 'Crear Producto'}</button>
      </div>
    </form>
  `;
}

/** Shared inline input styling string. */
function inputStyle() {
  return `
    padding:10px 14px;border-radius:10px;
    border:1px solid var(--border,#e5e7eb);
    font-size:14px;font-family:'Inter',sans-serif;
    background:var(--bg,#fafbff);color:var(--text,#1e1b4b);
    box-sizing:border-box;width:100%;
  `;
}

/**
 * Render the KPI dashboard cards row.
 * @param {{ totalRevenue: number, totalOrders: number, totalProducts: number, totalUsers: number, activeUsers: number }} metrics
 * @param {string} containerId
 */
export function renderDashboardCards(metrics, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const cards = [
    { icon: '💰', label: 'Ingresos Totales', value: formatCurrency(metrics.totalRevenue), gradient: 'linear-gradient(135deg,#7c3aed,#ec4899)' },
    { icon: '📦', label: 'Pedidos',           value: metrics.totalOrders,                  gradient: 'linear-gradient(135deg,#06b6d4,#7c3aed)' },
    { icon: '🏷️',  label: 'Productos',         value: metrics.totalProducts,                gradient: 'linear-gradient(135deg,#ec4899,#f59e0b)' },
    { icon: '👥', label: 'Usuarios',           value: metrics.totalUsers,                  gradient: 'linear-gradient(135deg,#10b981,#06b6d4)' },
    { icon: '🟢', label: 'Activos (24 h)',     value: metrics.activeUsers,                 gradient: 'linear-gradient(135deg,#f59e0b,#f43f5e)' },
  ];

  container.innerHTML = cards
    .map(
      (c, i) => `
      <div class="dashboard-card" style="
        padding:24px;border-radius:16px;color:#fff;
        background:${c.gradient};
        display:flex;flex-direction:column;gap:8px;
        box-shadow:0 8px 24px rgba(0,0,0,.15);
        opacity:0;transform:translateY(20px);
        animation:fadeUp .5s ease forwards;
        animation-delay:${i * 0.1}s;
        min-width:0;
      ">
        <span style="font-size:28px;">${c.icon}</span>
        <span style="font-size:13px;opacity:.85;">${c.label}</span>
        <span style="font-size:28px;font-weight:700;line-height:1;">${c.value}</span>
      </div>
    `,
    )
    .join('');

  // Inject animation keyframes if not already present
  if (!document.getElementById('admin-animations')) {
    const style = document.createElement('style');
    style.id = 'admin-animations';
    style.textContent = `
      @keyframes fadeUp {
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);
  }
}
