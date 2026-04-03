// ===== MAISON Security Guard =====
(function () {
  'use strict';

  if (window.location.pathname.includes('/admin/')) return;

  function isAdmin() {
    try {
      const u = JSON.parse(localStorage.getItem('userInfo') || 'null');
      return u && (u.role === 'ROLE_ADMIN' || u.role === 'ADMIN');
    } catch { return false; }
  }

  let rightClickBlocked  = true;
  let devtoolsKeyBlocked = true;
  let autoBanEnabled     = false;
  let banReported        = false;
  let overlay            = null;
  let devtoolsOpen       = false;

  // ── Overlay ─────────────────────────────────────────────────────────────────
  function showDevtoolsOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = '__sec_overlay';
    overlay.style.cssText = [
      'position:fixed','inset:0','z-index:2147483647',
      'background:rgba(12,10,9,0.97)',
      'display:flex','flex-direction:column',
      'align-items:center','justify-content:center',
      'font-family:Inter,sans-serif','color:#fff',
      'user-select:none',
    ].join(';');
    overlay.innerHTML = `
      <div style="text-align:center;padding:2rem;max-width:420px">
        <div style="width:72px;height:72px;background:#7F1D1D;border-radius:50%;
                    display:flex;align-items:center;justify-content:center;margin:0 auto 1.5rem">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24"
               fill="none" stroke="#FCA5A5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <div style="font-size:1.4rem;font-weight:700;letter-spacing:0.05em;margin-bottom:0.75rem">
          TRUY CẬP BỊ CHẶN
        </div>
        <div style="font-size:0.95rem;color:rgba(255,255,255,0.6);line-height:1.7;margin-bottom:1.5rem">
          Công cụ dành cho nhà phát triển<br>
          <strong style="color:#FCA5A5">không được phép</strong> sử dụng trên trang này.<br>
          Vui lòng đóng DevTools để tiếp tục.
        </div>
        <div style="font-size:0.75rem;color:rgba(255,255,255,0.25);letter-spacing:0.15em">
          MAISON. SECURITY
        </div>
      </div>`;
    document.body.appendChild(overlay);
    document.documentElement.style.overflow = 'hidden';
  }

  function hideDevtoolsOverlay() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.documentElement.style.overflow = '';
  }

  // ── Detection method 1: window size (docked DevTools) ───────────────────────
  function checkBySize() {
    const THRESHOLD = 160;
    return (window.outerWidth  - window.innerWidth  > THRESHOLD) ||
           (window.outerHeight - window.innerHeight > THRESHOLD);
  }

  // ── Detection method 2: console timing trick (docked + undocked) ────────────
  // When DevTools is open, iterating a large object in console takes longer.
  let _dtByConsole = false;
  (function consoleLoop() {
    const start = performance.now();
    // eslint-disable-next-line no-console
    console.log('%c', { toString() { _dtByConsole = true; return ''; } });
    const elapsed = performance.now() - start;
    if (elapsed > 10) _dtByConsole = true;
    setTimeout(consoleLoop, 1000);
  })();

  // ── Detection method 3: debugger timing ─────────────────────────────────────
  let _dtByDebugger = false;
  function checkByDebugger() {
    const start = performance.now();
    // The `debugger` statement pauses execution only when DevTools is open
    // eslint-disable-next-line no-debugger
    debugger;
    if (performance.now() - start > 100) _dtByDebugger = true;
    else _dtByDebugger = false;
  }

  // ── Master check ────────────────────────────────────────────────────────────
  function checkDevtools() {
    if (isAdmin()) {
      if (devtoolsOpen) { devtoolsOpen = false; hideDevtoolsOverlay(); }
      return;
    }
    checkByDebugger();
    const nowOpen = checkBySize() || _dtByConsole || _dtByDebugger;
    if (nowOpen && !devtoolsOpen) {
      devtoolsOpen = true;
      showDevtoolsOverlay();
      if (autoBanEnabled) reportBan();
    } else if (!nowOpen && devtoolsOpen) {
      devtoolsOpen = false;
      _dtByConsole = false;
      hideDevtoolsOverlay();
    }
  }

  // ── Auto-ban ─────────────────────────────────────────────────────────────────
  async function reportBan() {
    if (banReported) return;
    banReported = true;
    const token = localStorage.getItem('accessToken');
    if (!token || token === 'undefined' || token === 'null') return;
    try {
      const base = window.location.hostname === 'localhost'
        ? 'http://localhost:3000/api/v1' : '/api/v1';
      const res = await fetch(base + '/security/devtools-detected', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token }
      });
      const json = await res.json().catch(() => ({}));
      if (json.data === 'account_suspended') {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('userInfo');
        window.location.href = '/banned.html?reason=devtools';
      }
    } catch { banReported = false; }
  }

  // ── Right-click block ────────────────────────────────────────────────────────
  document.addEventListener('contextmenu', function (e) {
    if (!rightClickBlocked || isAdmin()) return;
    e.preventDefault();
    e.stopPropagation();
  }, true);

  // ── Keyboard block ───────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (!devtoolsKeyBlocked || isAdmin()) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const blocked =
      e.key === 'F12' ||
      (ctrl && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
      (ctrl && e.key.toUpperCase() === 'U');
    if (blocked) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ── Run detection ────────────────────────────────────────────────────────────
  setInterval(checkDevtools, 800);
  window.addEventListener('resize', checkDevtools);
  // Run once immediately after page load
  window.addEventListener('load', checkDevtools);

  // ── Load server config ───────────────────────────────────────────────────────
  async function loadConfig() {
    try {
      const base = window.location.hostname === 'localhost'
        ? 'http://localhost:3000/api/v1' : '/api/v1';
      const res = await fetch(base + '/security/public-config');
      if (!res.ok) return;
      const json = await res.json();
      if (!json.success || !json.data) return;
      const cfg = json.data;
      rightClickBlocked  = cfg.disableRightClick  !== false;
      devtoolsKeyBlocked = cfg.disableDevtoolsKey !== false;
      autoBanEnabled     = cfg.autoBanDevtools     === true;
    } catch { /* keep defaults */ }
  }

  loadConfig();
})();
