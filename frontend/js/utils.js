/* ===== UTILITIES — MAISON Fashion Store ===== */
'use strict';

/* ---------- CURRENCY ---------- */
function formatVND(amount) {
  if (amount == null) return '—';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

/* ---------- DATE ---------- */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ---------- TOAST ---------- */
let _toastTimer;
function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-show'));
  setTimeout(() => {
    toast.classList.remove('toast-show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

/* ---------- BUTTON LOADING ---------- */
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.disabled = true;
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Đang xử lý...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.origText || btn.innerHTML;
  }
}

/* ---------- API RESPONSE ---------- */
async function handleResponse(res) {
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Có lỗi xảy ra');
  return json.data;
}

/* ---------- URL PARAM ---------- */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/* ---------- STATUS MAPS ---------- */
const ORDER_STATUS = {
  PENDING:   'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING:  'Đang giao hàng',
  DELIVERED: 'Đã giao hàng',
  CANCELLED: 'Đã hủy',
};
const ORDER_STATUS_COLOR = {
  PENDING:   '#CA8A04',
  CONFIRMED: '#2563EB',
  SHIPPING:  '#7C3AED',
  DELIVERED: '#16A34A',
  CANCELLED: '#DC2626',
};
const REVIEW_STATUS = {
  PENDING:  'Chờ duyệt',
  APPROVED: 'Đã duyệt',
  REJECTED: 'Từ chối',
};

/* ---------- STARS ---------- */
function renderStars(rating, size = 16) {
  const s = parseInt(rating) || 0;
  let html = '<span class="stars">';
  for (let i = 1; i <= 5; i++) {
    html += `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${i <= s ? '#CA8A04' : 'none'}" stroke="#CA8A04" stroke-width="1.5">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>`;
  }
  return html + '</span>';
}

/* ---------- PAGINATION ---------- */
function renderPagination(page, totalPages, callbackName) {
  if (totalPages <= 1) return '';
  let html = '<div class="pagination">';
  if (page > 0) html += `<button class="page-btn" onclick="${callbackName}(${page - 1})">‹</button>`;
  const start = Math.max(0, page - 2);
  const end   = Math.min(totalPages - 1, page + 2);
  if (start > 0) html += `<button class="page-btn" onclick="${callbackName}(0)">1</button>${start > 1 ? '<span class="page-ellipsis">…</span>' : ''}`;
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn${i === page ? ' active' : ''}" onclick="${callbackName}(${i})">${i + 1}</button>`;
  }
  if (end < totalPages - 1) html += `${end < totalPages - 2 ? '<span class="page-ellipsis">…</span>' : ''}<button class="page-btn" onclick="${callbackName}(${totalPages - 1})">${totalPages}</button>`;
  if (page < totalPages - 1) html += `<button class="page-btn" onclick="${callbackName}(${page + 1})">›</button>`;
  return html + '</div>';
}

/* ---------- DEBOUNCE ---------- */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ---------- PRODUCT IMAGE ---------- */
function getProductImage(product) {
  if (!product) return 'https://placehold.co/400x533/F5F5F4/78716C?text=No+Image';
  const primary = (product.images || []).find(i => i.isPrimary);
  const first   = (product.images || [])[0];
  return (primary || first)?.url || 'https://placehold.co/400x533/F5F5F4/78716C?text=No+Image';
}

/* ---------- SCROLL REVEAL (re-use from main script) ---------- */
function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
}
