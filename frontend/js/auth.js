/* ===== AUTH HELPERS — MAISON Fashion Store ===== */
'use strict';

const auth = {
  isLoggedIn() {
    return !!localStorage.getItem('accessToken');
  },
  isAdmin() {
    const u = this.getUser();
    return u && u.role === 'ADMIN';
  },
  getUser() {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  },
  getToken() {
    return localStorage.getItem('accessToken');
  },
  setTokens(accessToken, refreshToken, user) {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    if (user) localStorage.setItem('user', JSON.stringify(user));
  },
  clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userInfo');
  },
  async logout() {
    try { await authApi.logout(); } catch (_) {}
    this.clearTokens();
    window.location.href = '/index.html';
  },
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      return false;
    }
    return true;
  },
  requireAdmin() {
    if (!this.isLoggedIn()) {
      window.location.href = '/login.html';
      return false;
    }
    if (!this.isAdmin()) {
      window.location.href = '/index.html';
      return false;
    }
    return true;
  },
};

/* ===== SHARED NAVBAR INIT (call on every page) ===== */
function initNavbar() {
  const user = auth.getUser();
  const authDiv = document.getElementById('navAuthActions');
  if (!authDiv) return;

  if (user) {
    const initials = (user.fullName || user.email || 'U').charAt(0).toUpperCase();
    authDiv.innerHTML = `
      <a href="/profile.html" class="navbar__user" title="${user.fullName || user.email}">
        <span class="navbar__avatar">${initials}</span>
      </a>
      ${user.role === 'ADMIN' ? '<a href="/admin/products.html" class="navbar__admin-link">Admin</a>' : ''}
      <button onclick="auth.logout()" class="btn btn-dark btn-sm">Đăng xuất</button>
    `;
  } else {
    authDiv.innerHTML = `<a href="/login.html" class="btn btn-primary btn-sm">Đăng nhập</a>`;
  }

  // Update cart count
  if (auth.isLoggedIn()) {
    cartApi.get()
      .then(r => r.json())
      .then(j => {
        const el = document.getElementById('cartCount');
        if (el && j.success) el.textContent = j.data.totalQuantity || 0;
      })
      .catch(() => {});
  }
}
