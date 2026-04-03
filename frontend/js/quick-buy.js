// ===== Quick Buy Modal =====
(function () {
  let selectedVariantId = null;
  let currentProduct = null;
  let qty = 1;

  // Inject modal HTML once
  function ensureModal() {
    if (document.getElementById('quick-buy-overlay')) return;
    const html = `
      <div id="quick-buy-overlay" class="qb-overlay" onclick="if(event.target===this)closeQuickBuy()">
        <div class="qb-modal">
          <button class="qb-close" onclick="closeQuickBuy()">✕</button>
          <div class="qb-image-wrap">
            <img id="qb-image" src="" alt="" loading="lazy">
            <span id="qb-flash-badge" class="qb-flash-badge" style="display:none">FLASH SALE</span>
          </div>
          <div class="qb-info">
            <span id="qb-category" class="product-card__category"></span>
            <h2 id="qb-name"></h2>
            <div id="qb-price" class="qb-price"></div>
            <div id="qb-sizes" class="qb-attr-group"></div>
            <div id="qb-colors" class="qb-attr-group"></div>
            <div class="qb-qty-row">
              <button class="qb-qty-btn" onclick="qbChangeQty(-1)">−</button>
              <span id="qb-qty">1</span>
              <button class="qb-qty-btn" onclick="qbChangeQty(1)">+</button>
              <span id="qb-stock-info" class="qb-stock-info"></span>
            </div>
            <button id="qb-add-btn" class="btn btn-primary" style="width:100%;margin-top:12px" onclick="qbAddToCart()">
              Thêm vào giỏ hàng
            </button>
            <a id="qb-detail-link" class="qb-detail-link">Xem chi tiết →</a>
          </div>
        </div>
      </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    // Close on Escape
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQuickBuy(); });
  }

  window.openQuickBuy = async function (productId) {
    ensureModal();
    selectedVariantId = null;
    qty = 1;

    const overlay = document.getElementById('quick-buy-overlay');
    overlay.classList.add('qb-loading');
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    try {
      const res = await api.products.get(productId);
      if (!res.success) return;
      currentProduct = res.data;
      renderModal(currentProduct);
    } catch {
      closeQuickBuy();
      showToast('Không thể tải sản phẩm', 'error');
    } finally {
      overlay.classList.remove('qb-loading');
    }
  };

  function renderModal(p) {
    const img = p.primaryImageUrl || (p.images && p.images[0]?.imageUrl) || 'images/product-jacket.png';
    document.getElementById('qb-image').src = img;
    document.getElementById('qb-image').alt = p.name;
    document.getElementById('qb-category').textContent = p.category?.name || '';
    document.getElementById('qb-name').textContent = p.name;
    document.getElementById('qb-detail-link').href = `product-detail.html?id=${p.id}`;
    document.getElementById('qb-qty').textContent = '1';

    // Price
    const flashPrice = p.flashPrice;
    const price = p.salePrice || p.price;
    let priceHtml = `<span class="current">${formatVND(flashPrice || price)}</span>`;
    if (flashPrice) {
      priceHtml += ` <span class="original">${formatVND(price)}</span>`;
      document.getElementById('qb-flash-badge').style.display = 'block';
    } else if (p.salePrice) {
      priceHtml += ` <span class="original">${formatVND(p.price)}</span>`;
      document.getElementById('qb-flash-badge').style.display = 'none';
    } else {
      document.getElementById('qb-flash-badge').style.display = 'none';
    }
    document.getElementById('qb-price').innerHTML = priceHtml;

    // Variants
    renderVariants(p.variants || []);
    updateStockInfo();
  }

  function renderVariants(variants) {
    const sizes = [...new Set(variants.filter(v => v.size).map(v => v.size))];
    const colors = [...new Set(variants.filter(v => v.color).map(v => v.color))];

    const sizesEl = document.getElementById('qb-sizes');
    const colorsEl = document.getElementById('qb-colors');

    if (sizes.length > 0) {
      sizesEl.innerHTML = `<div class="qb-attr-label">Kích cỡ</div><div class="qb-btn-group">` +
        sizes.map(s => `<button class="qb-size-btn" data-size="${s}" onclick="qbSelectSize('${s}')">${s}</button>`).join('') + `</div>`;
    } else {
      sizesEl.innerHTML = '';
    }

    if (colors.length > 0) {
      colorsEl.innerHTML = `<div class="qb-attr-label">Màu sắc</div><div class="qb-btn-group">` +
        colors.map(c => {
          const v = variants.find(vv => vv.color === c);
          const bg = v?.colorCode ? `style="background:${v.colorCode}"` : '';
          return `<button class="qb-color-btn" data-color="${c}" ${bg} title="${c}" onclick="qbSelectColor('${c}')">${v?.colorCode ? '' : c}</button>`;
        }).join('') + `</div>`;
    } else {
      colorsEl.innerHTML = '';
    }
  }

  window.qbSelectSize = function (size) {
    document.querySelectorAll('.qb-size-btn').forEach(b => b.classList.toggle('active', b.dataset.size === size));
    updateSelectedVariant();
  };

  window.qbSelectColor = function (color) {
    document.querySelectorAll('.qb-color-btn').forEach(b => b.classList.toggle('active', b.dataset.color === color));
    updateSelectedVariant();
  };

  function updateSelectedVariant() {
    if (!currentProduct?.variants?.length) return;
    const selSize = document.querySelector('.qb-size-btn.active')?.dataset.size;
    const selColor = document.querySelector('.qb-color-btn.active')?.dataset.color;
    const v = currentProduct.variants.find(vv =>
      (!selSize || vv.size === selSize) && (!selColor || vv.color === selColor)
    );
    selectedVariantId = v?.id || null;
    updateStockInfo();
  }

  function getAvailableStock() {
    if (selectedVariantId) {
      const v = currentProduct.variants.find(vv => vv.id === selectedVariantId);
      return v ? v.stock : 0;
    }
    return currentProduct?.stock || 0;
  }

  function updateStockInfo() {
    const stock = getAvailableStock();
    const el = document.getElementById('qb-stock-info');
    el.textContent = stock > 0 ? `Còn ${stock} sản phẩm` : 'Hết hàng';
    el.style.color = stock > 0 ? 'var(--color-text-muted)' : '#DC2626';
    document.getElementById('qb-add-btn').disabled = stock === 0;
  }

  window.qbChangeQty = function (delta) {
    const max = getAvailableStock();
    qty = Math.max(1, Math.min(qty + delta, max));
    document.getElementById('qb-qty').textContent = qty;
  };

  window.qbAddToCart = async function () {
    if (!Auth.isLoggedIn()) { window.location.href = '/login.html'; return; }

    const variants = currentProduct?.variants || [];
    const uniqueSizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
    const uniqueColors = [...new Set(variants.map(v => v.color).filter(Boolean))];
    const size = document.querySelector('.qb-size-btn.active')?.dataset.size;
    const color = document.querySelector('.qb-color-btn.active')?.dataset.color;
    if (uniqueSizes.length > 0 && !size) { showToast('Vui lòng chọn kích thước', 'error'); return; }
    if (uniqueColors.length > 0 && !color) { showToast('Vui lòng chọn màu sắc', 'error'); return; }

    const btn = document.getElementById('qb-add-btn');
    setLoading(btn, true);
    try {
      await api.cart.addItem(currentProduct.id, qty, size, color, selectedVariantId);
      showToast('Đã thêm vào giỏ hàng!');
      updateCartCount();
      closeQuickBuy();
    } catch (err) {
      showToast(err.message || 'Không thể thêm vào giỏ', 'error');
    } finally {
      setLoading(btn, false);
    }
  };

  window.closeQuickBuy = function () {
    const overlay = document.getElementById('quick-buy-overlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
  };
})();
