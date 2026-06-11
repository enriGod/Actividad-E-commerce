/**
 * ═══════════════════════════════════════════════════════════════
 *  E-Market — Authentication Module
 *  Handles registration, login, session management, route
 *  protection, and navbar user-menu rendering.
 * ═══════════════════════════════════════════════════════════════
 */

import { Store } from './store.js';
import { generateId, validateEmail, showToast, sanitizeHTML } from './utils.js';

const SESSION_KEY = 'emarket_session';

/* ───────────── Crypto Helpers ───────────── */

/**
 * Hash a password with SHA-256 via the Web Crypto API.
 * @param {string} password — plaintext
 * @returns {Promise<string>} hex-encoded hash
 */
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/* ───────────── Registration ───────────── */

/**
 * Register a new user account.
 * @param {string} name
 * @param {string} email
 * @param {string} password
 * @param {'client'|'admin'} role
 * @returns {Promise<{success: boolean, message: string, user?: Object}>}
 */
export async function register(name, email, password, role = 'client') {
  // Validate inputs
  if (!name || name.trim().length < 2) {
    return { success: false, message: 'El nombre debe tener al menos 2 caracteres.' };
  }
  if (!validateEmail(email)) {
    return { success: false, message: 'Correo electrónico no válido.' };
  }
  if (!password || password.length < 6) {
    return { success: false, message: 'La contraseña debe tener al menos 6 caracteres.' };
  }

  const users = Store.getUsers();

  // Check uniqueness
  if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
    return { success: false, message: 'Ya existe una cuenta con este correo.' };
  }

  const hashedPw = await hashPassword(password);

  const user = {
    id: generateId(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    password: hashedPw,
    role,
    avatar: '',
    address: '',
    createdAt: new Date().toISOString(),
  };

  users.push(user);
  Store.setUsers(users);

  // Return a safe copy without password
  const { password: _, ...safeUser } = user;
  return { success: true, message: 'Cuenta creada exitosamente.', user: safeUser };
}

/* ───────────── Login ───────────── */

/**
 * Authenticate a user with email and password.
 * Creates a session in sessionStorage on success.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, message: string, user?: Object}>}
 */
export async function login(email, password) {
  if (!email || !password) {
    return { success: false, message: 'Ingrese correo y contraseña.' };
  }

  const users = Store.getUsers();
  const user = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

  if (!user) {
    return { success: false, message: 'No existe una cuenta con este correo.' };
  }

  const hashedPw = await hashPassword(password);

  if (user.password !== hashedPw) {
    return { success: false, message: 'Contraseña incorrecta.' };
  }

  // Create session
  const session = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    loginAt: new Date().toISOString(),
  };

  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  // Update lastLogin on user record
  const idx = users.findIndex((u) => u.id === user.id);
  if (idx !== -1) {
    users[idx].lastLogin = new Date().toISOString();
    Store.setUsers(users);
  }

  Store.emit('auth-changed', session);

  const { password: _, ...safeUser } = user;
  return { success: true, message: `¡Bienvenido, ${user.name}!`, user: safeUser };
}

/* ───────────── Logout ───────────── */

/** Clear session and notify listeners. */
export function logout() {
  sessionStorage.removeItem(SESSION_KEY);
  Store.emit('auth-changed', null);
}

/* ───────────── Session Queries ───────────── */

/**
 * Get the current session user, or null if not logged in.
 * @returns {Object|null}
 */
export function getCurrentUser() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** @returns {boolean} */
export function isLoggedIn() {
  return getCurrentUser() !== null;
}

/** @returns {boolean} */
export function isAdmin() {
  const user = getCurrentUser();
  return user?.role === 'admin';
}

/** @returns {boolean} */
export function isClient() {
  const user = getCurrentUser();
  return user?.role === 'client';
}

/* ───────────── Route Protection ───────────── */

/**
 * Protect a page so only authenticated users (optionally with a
 * specific role) can access it. Redirects otherwise.
 * @param {'admin'|'client'} [requiredRole]
 */
export function protectRoute(requiredRole) {
  const user = getCurrentUser();

  if (!user) {
    // Determine correct relative path to login page
    const isInPages = window.location.pathname.includes('/pages/');
    window.location.href = isInPages ? 'login.html' : 'pages/login.html';
    return;
  }

  if (requiredRole && user.role !== requiredRole) {
    // Not authorised — send to homepage
    const isInPages = window.location.pathname.includes('/pages/');
    window.location.href = isInPages ? '../index.html' : 'index.html';
  }
}

/* ───────────── Profile Management ───────────── */

/**
 * Update the current user's profile fields.
 * @param {{ name?: string, avatar?: string, address?: string }} updates
 * @returns {{ success: boolean, message: string }}
 */
export function updateProfile(updates) {
  const session = getCurrentUser();
  if (!session) return { success: false, message: 'No hay sesión activa.' };

  const users = Store.getUsers();
  const idx = users.findIndex((u) => u.id === session.userId);
  if (idx === -1) return { success: false, message: 'Usuario no encontrado.' };

  // Apply allowed updates
  if (updates.name)    users[idx].name    = updates.name.trim();
  if (updates.avatar)  users[idx].avatar  = updates.avatar;
  if (updates.address) users[idx].address = updates.address.trim();

  Store.setUsers(users);

  // Refresh session
  const refreshed = {
    ...session,
    name: users[idx].name,
  };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(refreshed));
  Store.emit('auth-changed', refreshed);

  return { success: true, message: 'Perfil actualizado.' };
}

/* ───────────── Password Reset ───────────── */

/**
 * Reset a user's password by email.
 * @param {string} email
 * @param {string} newPassword
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function resetPassword(email, newPassword) {
  if (!validateEmail(email)) {
    return { success: false, message: 'Correo no válido.' };
  }
  if (!newPassword || newPassword.length < 6) {
    return { success: false, message: 'La nueva contraseña debe tener al menos 6 caracteres.' };
  }

  const users = Store.getUsers();
  const idx = users.findIndex((u) => u.email.toLowerCase() === email.trim().toLowerCase());

  if (idx === -1) {
    return { success: false, message: 'No se encontró una cuenta con ese correo.' };
  }

  users[idx].password = await hashPassword(newPassword);
  Store.setUsers(users);

  return { success: true, message: 'Contraseña actualizada correctamente.' };
}

/* ───────────── User Lookups ───────────── */

/**
 * Get a user by their ID.
 * @param {string} userId
 * @returns {Object|null} user without password
 */
export function getUserById(userId) {
  const users = Store.getUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  const { password, ...safe } = user;
  return safe;
}

/**
 * Return all registered users (without passwords).
 * @returns {Object[]}
 */
export function getAllUsers() {
  return Store.getUsers().map(({ password, ...safe }) => safe);
}

/* ───────────── Navbar UI ───────────── */

/**
 * Render the user dropdown in the navbar.
 * – Logged in → name, profile link, admin link (if admin), logout.
 * – Logged out → login / register links.
 */
export function updateUserMenu() {
  const dropdown = document.getElementById('user-dropdown');
  if (!dropdown) return;

  const user = getCurrentUser();

  // Determine base path (pages/ depth)
  const isInPages = window.location.pathname.includes('/pages/');
  const pagesPrefix = isInPages ? '' : 'pages/';
  const rootPrefix  = isInPages ? '../' : '';

  if (user) {
    dropdown.innerHTML = `
      <div class="user-dropdown-header">
        <span class="user-dropdown-name">${sanitizeHTML(user.name)}</span>
        <span class="user-dropdown-email">${sanitizeHTML(user.email)}</span>
      </div>
      <div class="user-dropdown-divider"></div>
      <a href="${pagesPrefix}profile.html" class="user-dropdown-item">👤 Mi Perfil</a>
      <a href="${pagesPrefix}orders.html" class="user-dropdown-item">📦 Mis Pedidos</a>
      ${user.role === 'admin' ? `<a href="${pagesPrefix}admin.html" class="user-dropdown-item">⚙️ Admin Panel</a>` : ''}
      <div class="user-dropdown-divider"></div>
      <button class="user-dropdown-item user-dropdown-logout" id="logout-btn">🚪 Cerrar Sesión</button>
    `;

    // Attach logout handler
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        logout();
        showToast('Sesión cerrada', 'info');
        updateUserMenu();
        updateCartBadge();
        // Redirect to home
        window.location.href = `${rootPrefix}index.html`;
      });
    }
  } else {
    dropdown.innerHTML = `
      <a href="${pagesPrefix}login.html" class="user-dropdown-item">🔑 Iniciar Sesión</a>
      <a href="${pagesPrefix}register.html" class="user-dropdown-item">📝 Registrarse</a>
    `;
  }
}

/**
 * Update the cart badge count in the navbar.
 */
export function updateCartBadge() {
  const badge = document.getElementById('cart-badge');
  if (!badge) return;

  const cart = Store.getCart();
  const count = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-flex' : 'none';
}

/* ───────────── Auto-Setup ───────────── */

/**
 * Wire up the user menu toggle (show/hide dropdown on click)
 * and render initial state once the DOM is ready.
 */
function autoSetup() {
  const bind = () => {
    updateUserMenu();
    updateCartBadge();

    // Toggle dropdown visibility on button click
    const btn = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');
    if (btn && dropdown) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
      });
      // Close when clicking elsewhere
      document.addEventListener('click', () => {
        dropdown.classList.remove('active');
      });
    }

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mainNav = document.getElementById('main-nav');
    if (mobileBtn && mainNav) {
      mobileBtn.addEventListener('click', () => {
        mainNav.classList.toggle('active');
        mobileBtn.textContent = mainNav.classList.contains('active') ? '✕' : '☰';
      });
    }

    // Re-render menu on auth changes
    Store.on('auth-changed', () => {
      updateUserMenu();
      updateCartBadge();
    });

    // Re-render badge on cart changes
    Store.on('cart-updated', () => {
      updateCartBadge();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
}

autoSetup();
