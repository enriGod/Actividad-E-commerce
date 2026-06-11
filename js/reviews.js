/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Reviews Module
 *  Create, query and render product reviews with star ratings.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';
import { generateId, showToast, sanitizeHTML, timeAgo } from './utils.js';
import { getCurrentUser, isLoggedIn } from './auth.js';

/* ───────────── CRUD ───────────── */

/**
 * Add a new review for a product.
 * Requires the user to be logged in.
 * @param {number|string} productId
 * @param {number}        rating  — 1-5
 * @param {string}        comment
 * @returns {{ success: boolean, message: string, review?: Object }}
 */
export function addReview(productId, rating, comment) {
  if (!isLoggedIn()) {
    showToast('Debes iniciar sesión para dejar una reseña', 'warning');
    return { success: false, message: 'No autenticado.' };
  }

  const user = getCurrentUser();

  // Validate
  const numRating = Number(rating);
  if (!numRating || numRating < 1 || numRating > 5) {
    return { success: false, message: 'La calificación debe ser entre 1 y 5.' };
  }
  if (!comment || comment.trim().length < 3) {
    return { success: false, message: 'El comentario debe tener al menos 3 caracteres.' };
  }

  // Prevent duplicate reviews
  if (hasUserReviewed(productId)) {
    showToast('Ya has dejado una reseña para este producto', 'warning');
    return { success: false, message: 'Ya has reseñado este producto.' };
  }

  const review = {
    id: generateId(),
    productId,
    userId: user.userId,
    userName: user.name,
    rating: numRating,
    comment: comment.trim(),
    createdAt: new Date().toISOString(),
  };

  const reviews = Store.getReviews();
  reviews.push(review);
  Store.setReviews(reviews);

  showToast('¡Reseña publicada!', 'success');
  return { success: true, message: 'Reseña publicada.', review };
}

/**
 * Get all reviews for a product, sorted newest first.
 * @param {number|string} productId
 * @returns {Object[]}
 */
export function getProductReviews(productId) {
  return Store.getReviews()
    .filter((r) => String(r.productId) === String(productId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Calculate the average rating for a product.
 * @param {number|string} productId
 * @returns {{ average: number, count: number }}
 */
export function getAverageRating(productId) {
  const reviews = getProductReviews(productId);
  if (reviews.length === 0) return { average: 0, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: Math.round((sum / reviews.length) * 10) / 10,
    count: reviews.length,
  };
}

/**
 * Check whether the current user has already reviewed a product.
 * @param {number|string} productId
 * @returns {boolean}
 */
export function hasUserReviewed(productId) {
  const user = getCurrentUser();
  if (!user) return false;
  return Store.getReviews().some(
    (r) => String(r.productId) === String(productId) && r.userId === user.userId,
  );
}

/* ───────────── Rendering ───────────── */

/**
 * Render star rating display (and optionally an interactive picker).
 *
 * @param {number}         rating       — current rating (0-5)
 * @param {boolean}        interactive  — if true, stars are clickable
 * @param {string}         containerId  — DOM id to render into
 * @returns {number} currently selected rating
 */
export function renderStars(rating, interactive = false, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return rating;

  let selected = Math.round(rating);

  const render = (val) => {
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = `star ${i <= val ? 'star-filled' : 'star-empty'}`;
      star.textContent = i <= val ? '★' : '☆';
      star.style.cssText = `
        font-size: 24px;
        cursor: ${interactive ? 'pointer' : 'default'};
        color: ${i <= val ? '#f59e0b' : 'var(--text-tertiary, #999)'};
        transition: color .15s ease, transform .15s ease;
        user-select: none;
      `;

      if (interactive) {
        star.addEventListener('mouseenter', () => {
          // Highlight on hover
          Array.from(container.children).forEach((s, idx) => {
            s.style.color = idx < i ? '#f59e0b' : 'var(--text-tertiary, #999)';
            s.textContent = idx < i ? '★' : '☆';
          });
        });

        star.addEventListener('click', () => {
          selected = i;
          container.dataset.rating = i;
          render(i);
        });
      }

      container.appendChild(star);
    }

    if (interactive) {
      container.addEventListener('mouseleave', () => {
        render(selected);
      }, { once: false });
    }
  };

  render(selected);
  container.dataset.rating = selected;
  return selected;
}

/**
 * Build an inline star string (non-interactive, for cards).
 * @param {number} rating — 0-5
 * @returns {string} HTML string
 */
export function starsHTML(rating) {
  const full = Math.round(rating);
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="star ${i <= full ? 'star-filled' : 'star-empty'}" style="color:${i <= full ? '#f59e0b' : '#ccc'}">${i <= full ? '★' : '☆'}</span>`;
  }
  return html;
}

/**
 * Render a review form (stars + textarea + submit) into a container.
 * @param {number|string} productId
 * @param {string}        containerId
 */
export function renderReviewForm(productId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!isLoggedIn()) {
    container.innerHTML = `
      <div class="review-form-placeholder" style="padding:20px;text-align:center;color:var(--text-secondary,#666);">
        <p>Inicia sesión para dejar una reseña</p>
      </div>`;
    return;
  }

  if (hasUserReviewed(productId)) {
    container.innerHTML = `
      <div class="review-form-placeholder" style="padding:20px;text-align:center;color:var(--text-secondary,#666);">
        <p>Ya has dejado una reseña para este producto ✅</p>
      </div>`;
    return;
  }

  const starsId = `review-stars-${productId}`;
  const textareaId = `review-text-${productId}`;
  const btnId = `review-submit-${productId}`;

  container.innerHTML = `
    <form class="review-form" id="review-form-${productId}" style="
      display:flex;flex-direction:column;gap:14px;
      padding:24px;border-radius:16px;
      background:var(--surface,#fff);
      border:1px solid var(--border,#e5e7eb);
    ">
      <h4 style="margin:0;font-weight:600;">Deja tu reseña</h4>
      <div>
        <label style="font-size:14px;color:var(--text-secondary,#666);">Tu calificación</label>
        <div id="${starsId}" style="margin-top:6px;"></div>
      </div>
      <div>
        <label for="${textareaId}" style="font-size:14px;color:var(--text-secondary,#666);">Comentario</label>
        <textarea id="${textareaId}" rows="3" placeholder="Escribe tu opinión…" style="
          width:100%;margin-top:6px;padding:12px;border-radius:10px;resize:vertical;
          border:1px solid var(--border,#e5e7eb);font-family:'Inter',sans-serif;
          font-size:14px;background:var(--bg,#fafbff);color:var(--text,#1e1b4b);
          box-sizing:border-box;
        "></textarea>
      </div>
      <button type="submit" id="${btnId}" class="btn btn-primary" style="
        align-self:flex-start;padding:10px 24px;border-radius:10px;border:none;
        background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;font-weight:600;
        cursor:pointer;font-size:14px;transition:opacity .2s;
      ">Publicar Reseña</button>
    </form>
  `;

  // Initialise interactive stars (default 5)
  renderStars(5, true, starsId);

  // Handle submission
  const form = document.getElementById(`review-form-${productId}`);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const starsContainer = document.getElementById(starsId);
    const rating = parseInt(starsContainer.dataset.rating, 10) || 0;
    const comment = document.getElementById(textareaId).value;

    const result = addReview(productId, rating, comment);
    if (result.success) {
      renderReviewForm(productId, containerId);
      // If there's a review list container, re-render it
      const listId = `review-list-${productId}`;
      if (document.getElementById(listId)) {
        renderReviewList(productId, listId);
      }
    }
  });
}

/**
 * Render all reviews for a product into a container.
 * @param {number|string} productId
 * @param {string}        containerId
 */
export function renderReviewList(productId, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const reviews = getProductReviews(productId);

  if (reviews.length === 0) {
    container.innerHTML = `
      <p style="text-align:center;color:var(--text-secondary,#666);padding:20px;">
        Aún no hay reseñas para este producto.
      </p>`;
    return;
  }

  const { average, count } = getAverageRating(productId);

  container.innerHTML = `
    <div class="reviews-summary" style="
      display:flex;align-items:center;gap:12px;margin-bottom:20px;
      padding:16px;border-radius:12px;background:var(--surface-alt,#f5f3ff);
    ">
      <span style="font-size:32px;font-weight:700;color:var(--text,#1e1b4b);">${average}</span>
      <div>
        <div>${starsHTML(average)}</div>
        <span style="font-size:13px;color:var(--text-secondary,#666);">${count} reseña${count !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div class="reviews-list" style="display:flex;flex-direction:column;gap:16px;">
      ${reviews.map((r) => `
        <div class="review-card" style="
          padding:18px;border-radius:14px;
          background:var(--surface,#fff);
          border:1px solid var(--border,#e5e7eb);
          transition:box-shadow .2s;
        ">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:20px;">👤</span>
              <strong style="font-size:14px;">${sanitizeHTML(r.userName)}</strong>
            </div>
            <span style="font-size:12px;color:var(--text-secondary,#666);">${timeAgo(r.createdAt)}</span>
          </div>
          <div style="margin-bottom:8px;">${starsHTML(r.rating)}</div>
          <p style="margin:0;font-size:14px;line-height:1.6;color:var(--text,#1e1b4b);">
            ${sanitizeHTML(r.comment)}
          </p>
        </div>
      `).join('')}
    </div>
  `;
}
