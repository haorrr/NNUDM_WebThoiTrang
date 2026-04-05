const API_BASE = window.location.hostname === 'localhost' ? 'http://localhost:3000/api/v1' : '/api/v1';

function toAbsoluteAssetUrl(url) {
  if (!url) return '';
  if (String(url).startsWith('http://') || String(url).startsWith('https://')) return url;
  if (String(url).startsWith('/')) {
    if (window.location.hostname === 'localhost') return 'http://localhost:3000' + url;
    return url;
  }
  return url;
}

const Auth = {
  getAccess: function () { return localStorage.getItem('accessToken'); },
  getRefresh: function () { return localStorage.getItem('refreshToken'); },
  getUser: function () {
    try { return JSON.parse(localStorage.getItem('userInfo')); } catch (e) { return null; }
  },
  save: function (accessToken, refreshToken, userInfo) {
    if (accessToken) localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (userInfo) localStorage.setItem('userInfo', JSON.stringify(userInfo));
  },
  clear: function () {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userInfo');
  },
  isLoggedIn: function () {
    const t = localStorage.getItem('accessToken');
    return !!t && t !== 'undefined' && t !== 'null';
  },
  isAdmin: function () {
    const u = Auth.getUser();
    return !!u && (u.role === 'ADMIN' || u.role === 'ROLE_ADMIN');
  }
};

function formatVND(amount) {
  if (amount == null) return '0 VND';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
}

function toNumber(v, d) {
  if (d == null) d = 0;
  if (v == null || v === '') return d;
  const n = Number(v);
  return Number.isNaN(n) ? d : n;
}

function normalizeUser(u) {
  if (!u) return null;
  const roleId = u.roleId || u.role_id || null;
  const role = u.role || u.role_name || (roleId === 1 ? 'ADMIN' : 'USER');
  const fullName = u.fullName || u.full_name || u.name || u.username || '';
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    fullName: fullName,
    name: fullName,
    avatarUrl: u.avatarUrl || u.avatar_url || '',
    roleId: roleId,
    role: role,
    status: u.status || 'ACTIVE',
    createdAt: u.createdAt || u.created_at || null,
    provider: 'LOCAL'
  };
}

function normalizeProduct(p) {
  if (!p) return null;
  const primaryImage = p.primaryImageUrl || p.primary_image || '';
  const categoryName = p.categoryName || p.category_name || '';
  const images = Array.isArray(p.images) ? p.images
    .filter(function (img) { return img && (img.id || img.url || img.imageUrl); })
    .map(function (img) {
      return {
        id: img.id,
        imageUrl: img.imageUrl || img.url || '',
        url: img.url || img.imageUrl || '',
        isPrimary: !!(img.isPrimary || img.is_primary),
        sortOrder: img.sortOrder != null ? img.sortOrder : img.sort_order
      };
    }) : [];
  const normalizedImages = images.length > 0
    ? images
    : (primaryImage ? [{ imageUrl: primaryImage, url: primaryImage, isPrimary: true }] : []);
  const normalizedPrimary = primaryImage
    || (normalizedImages.find(function (x) { return x.isPrimary; }) || {}).imageUrl
    || (normalizedImages[0] || {}).imageUrl
    || '';
  return {
    id: p.id,
    name: p.name || p.title || '',
    title: p.title || p.name || '',
    slug: p.slug,
    description: p.description || '',
    price: toNumber(p.price, 0),
    salePrice: p.salePrice != null ? toNumber(p.salePrice, 0) : toNumber(p.sale_price, null),
    flashPrice: p.flashPrice != null ? toNumber(p.flashPrice, 0) : toNumber(p.flash_price, null),
    flashEndsAt: p.flashEndsAt || p.flash_ends_at || null,
    status: p.status || 'ACTIVE',
    categoryId: p.categoryId || p.category_id || null,
    categoryName: categoryName,
    category: { name: categoryName, id: p.categoryId || p.category_id || null },
    primaryImageUrl: normalizedPrimary,
    images: normalizedImages,
    stock: toNumber(p.stock, 0),
    variants: [],
    createdAt: p.createdAt || p.created_at || null
  };
}

function normalizeFlashSaleProduct(rawProduct, discountPercent) {
  const originalPrice = toNumber(rawProduct.originalPrice || rawProduct.original_price || rawProduct.price, 0);
  const flashPrice = rawProduct.flashPrice != null
    ? toNumber(rawProduct.flashPrice, originalPrice)
    : Math.max(0, Math.round(originalPrice * (100 - toNumber(discountPercent, 0)) / 100));
  return {
    id: rawProduct.id,
    productId: rawProduct.productId || rawProduct.product_id,
    productName: rawProduct.productName || rawProduct.product_title || rawProduct.title || '',
    primaryImageUrl: rawProduct.primaryImageUrl || rawProduct.primary_image || rawProduct.image || '',
    originalPrice: originalPrice,
    flashPrice: flashPrice,
    stockLimit: toNumber(rawProduct.stockLimit || rawProduct.stock_limit, 0),
    soldCount: toNumber(rawProduct.soldCount || rawProduct.sold_count, 0)
  };
}

function normalizeFlashSale(fs) {
  const discountPercent = toNumber(fs.discountPercent || fs.discount_percent, 0);
  const products = Array.isArray(fs.products) ? fs.products.map(function (p) {
    return normalizeFlashSaleProduct(p, discountPercent);
  }) : [];
  return {
    id: fs.id,
    name: fs.name || fs.title || '',
    title: fs.title || fs.name || '',
    discountPercent: discountPercent,
    startsAt: fs.startsAt || fs.starts_at || null,
    endsAt: fs.endsAt || fs.ends_at || null,
    status: fs.status || 'ACTIVE',
    products: products
  };
}

async function rawFetch(endpoint, options) {
  const url = API_BASE + endpoint;
  const token = Auth.getAccess();
  const headers = Object.assign({ 'Content-Type': 'application/json' }, (options && options.headers) || {});
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(url, Object.assign({}, options || {}, { headers: headers }));
  const data = await res.json().catch(function () { return null; });
  if (!res.ok) {
    const message = data && data.message ? data.message : ('HTTP ' + res.status);
    throw { status: res.status, message: message, data: data };
  }
  return data;
}

async function apiFetch(endpoint, options) {
  const data = await rawFetch(endpoint, options);
  return { success: true, data: data };
}

const api = {
  auth: {
    login: async function (emailOrUsername, password) {
      const username = String(emailOrUsername || '').includes('@') ? String(emailOrUsername).split('@')[0] : String(emailOrUsername || '');
      const rs = await rawFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username, password: password })
      });
      return {
        success: true,
        data: {
          accessToken: rs.token,
          refreshToken: rs.token,
          user: normalizeUser(rs.user || {})
        }
      };
    },
    register: function (name, email, password) {
      const username = String(email || '').split('@')[0] || ('user_' + Date.now());
      return apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: username,
          password: password,
          email: email,
          fullName: name || username,
          phone: ''
        })
      });
    },
    logout: function () { return apiFetch('/auth/logout', { method: 'POST' }); },
    forgotPassword: function (email) {
      return apiFetch('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email: email }) });
    },
    verifyResetToken: async function (token) { return { success: true, data: !!token }; },
    resetPassword: function (token, newPassword) {
      return apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: token, newPassword: newPassword }) });
    },
    profile: async function () {
      const rs = await rawFetch('/auth/profile');
      return { success: true, data: normalizeUser(rs) };
    }
  },

  products: {
    list: async function (params) {
      const p = Object.assign({}, params || {});
      p.limit = p.limit || p.size || 12;
      p.page = p.page != null ? Number(p.page) + 1 : 1;
      if (p.keyword && !p.title) p.title = p.keyword;
      if (p.search && !p.title) p.title = p.search;
      delete p.keyword;
      delete p.search;
      delete p.size;
      delete p.sort;
      delete p.dir;
      const rs = await rawFetch('/products?' + new URLSearchParams(p).toString());
      if (Array.isArray(rs)) {
        const contentFallback = rs.map(normalizeProduct);
        return { success: true, data: { content: contentFallback, totalElements: contentFallback.length, totalPages: contentFallback.length > 0 ? 1 : 0 } };
      }
      const content = Array.isArray(rs.content) ? rs.content.map(normalizeProduct) : [];
      return {
        success: true,
        data: {
          content: content,
          totalElements: toNumber(rs.totalElements, content.length),
          totalPages: toNumber(rs.totalPages, content.length > 0 ? 1 : 0)
        }
      };
    },
    get: async function (id) {
      const r = await rawFetch('/products/' + id);
      const p = normalizeProduct(r);
      try {
        const vars = await rawFetch('/products/' + id + '/variants');
        p.variants = (vars || []).map(function (v) {
          return {
            id: v.id,
            size: v.size || '',
            color: v.color || '',
            colorCode: v.color_code || v.colorCode || '',
            stock: toNumber(v.stock, 0),
            priceAdjustment: toNumber(v.price_adjustment, 0)
          };
        });
      } catch (e) {}
      return { success: true, data: p };
    },
    getBySlug: async function (slug) {
      const list = await api.products.list({});
      const item = (list.data.content || []).find(function (x) { return x.slug === slug; });
      if (!item) throw { status: 404, message: 'id not found' };
      return api.products.get(item.id);
    },
    create: function (data) {
      return apiFetch('/products', {
        method: 'POST',
        body: JSON.stringify({
          title: data.name || data.title,
          description: data.description || '',
          price: data.price || 0,
          salePrice: data.salePrice || null,
          stock: data.stock != null ? data.stock : 0,
          categoryId: data.categoryId || null,
          status: data.status || 'ACTIVE'
        })
      });
    },
    update: function (id, data) {
      return apiFetch('/products/' + id, {
        method: 'PUT',
        body: JSON.stringify({
          title: data.name || data.title,
          description: data.description,
          price: data.price,
          salePrice: data.salePrice,
          stock: data.stock,
          categoryId: data.categoryId,
          status: data.status
        })
      });
    },
    delete: function (id) { return apiFetch('/products/' + id, { method: 'DELETE' }); },
    toggleStatus: async function (id) {
      const p = await api.products.get(id);
      const next = p.data.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      return api.products.update(id, { status: next });
    },
    uploadImage: async function (id, formData) {
      const token = Auth.getAccess();
      const res = await fetch(API_BASE + '/products/' + id + '/images', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: formData
      });
      const data = await res.json().catch(function () { return null; });
      if (!res.ok) throw { status: res.status, message: (data && data.message) || 'Upload error' };
      const images = (data || []).map(function (img) {
        return {
          id: img.id,
          imageUrl: img.url || '',
          url: img.url || '',
          isPrimary: !!img.is_primary
        };
      });
      return { success: true, data: { images: images } };
    },
    addImageByUrl: async function (id, url, isPrimary) {
      const data = await rawFetch('/products/' + id + '/images/url', {
        method: 'POST',
        body: JSON.stringify({ url: url, isPrimary: !!isPrimary })
      });
      const images = (data || []).map(function (img) {
        return {
          id: img.id,
          imageUrl: img.url || '',
          url: img.url || '',
          isPrimary: !!img.is_primary
        };
      });
      return { success: true, data: { images: images } };
    },
    setPrimaryImage: async function (id, imageId) {
      const data = await rawFetch('/products/' + id + '/images/' + imageId + '/primary', {
        method: 'PUT'
      });
      return {
        success: true,
        data: {
          id: data.id,
          imageUrl: data.url || '',
          url: data.url || '',
          isPrimary: !!data.is_primary
        }
      };
    },
    deleteImage: function (id, imageId) { return apiFetch('/products/' + id + '/images/' + imageId, { method: 'DELETE' }); },
    generateAiDescription: async function () { throw { status: 400, message: 'AI API chưa hỗ trợ' }; }
  },

  categories: {
    list: async function () {
      const rows = await rawFetch('/categories');
      const list = (rows || []).map(function (c) {
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          imageUrl: c.image_url || '',
          parentId: c.parent_id || null,
          productCount: toNumber(c.product_count, 0),
          status: c.status || 'ACTIVE',
          children: []
        };
      });
      const map = {};
      list.forEach(function (x) { map[x.id] = x; });
      const roots = [];
      list.forEach(function (x) {
        if (x.parentId && map[x.parentId]) map[x.parentId].children.push(x);
        else roots.push(x);
      });
      return { success: true, data: roots };
    },
    get: async function (id) {
      const c = await rawFetch('/categories/' + id);
      return { success: true, data: { id: c.id, name: c.name, slug: c.slug, status: c.status, parentId: c.parent_id || null, productCount: toNumber(c.product_count, 0) } };
    },
    create: function (data) { return apiFetch('/categories', { method: 'POST', body: JSON.stringify(data) }); },
    update: function (id, data) { return apiFetch('/categories/' + id, { method: 'PUT', body: JSON.stringify(data) }); },
    delete: function (id) { return apiFetch('/categories/' + id, { method: 'DELETE' }); },
    toggleStatus: async function (id) {
      const c = await api.categories.get(id);
      const next = c.data.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      return api.categories.update(id, { status: next });
    }
  },

  variants: {
    list: async function (productId) {
      const rows = await rawFetch('/products/' + productId + '/variants');
      const data = (rows || []).map(function (v) {
        return {
          id: v.id,
          size: v.size,
          color: v.color,
          colorCode: v.color_code,
          sku: v.sku,
          stock: toNumber(v.stock, 0),
          priceAdjustment: toNumber(v.price_adjustment, 0)
        };
      });
      return { success: true, data: data };
    },
    create: function (productId, data) { return apiFetch('/products/' + productId + '/variants', { method: 'POST', body: JSON.stringify(data) }); },
    update: function (productId, variantId, data) { return apiFetch('/products/' + productId + '/variants/' + variantId, { method: 'PUT', body: JSON.stringify(data) }); },
    delete: function (productId, variantId) { return apiFetch('/products/' + productId + '/variants/' + variantId, { method: 'DELETE' }); },
    adjustStock: async function () { throw { status: 400, message: 'Inventory API chưa hỗ trợ' }; }
  },

  cart: {
    get: async function () {
      const rows = await rawFetch('/carts');
      const items = (rows || []).map(function (r) {
        const unit = toNumber(r.sale_price || r.price, 0) + toNumber(r.price_adjustment, 0);
        return {
          id: r.id,
          cartId: r.cart_id,
          productId: r.product_id,
          variantId: r.variant_id,
          productName: r.title,
          imageUrl: r.image,
          price: toNumber(r.price, 0),
          salePrice: r.sale_price != null ? toNumber(r.sale_price, 0) : null,
          quantity: toNumber(r.quantity, 1),
          size: r.size || '',
          color: r.color || '',
          subtotal: unit * toNumber(r.quantity, 1)
        };
      });
      const subtotal = items.reduce(function (s, x) { return s + x.subtotal; }, 0);
      const totalItems = items.reduce(function (s, x) { return s + x.quantity; }, 0);
      return { success: true, data: { items: items, subtotal: subtotal, totalItems: totalItems } };
    },
    addItem: function (productId, quantity, size, color, variantId) {
      return apiFetch('/carts/add-items', { method: 'POST', body: JSON.stringify({ productId: Number(productId), variantId: variantId ? Number(variantId) : null, quantity: Number(quantity || 1) }) });
    },
    updateItem: async function (itemId, quantity) {
      const cart = await api.cart.get();
      const item = (cart.data.items || []).find(function (x) { return x.id === itemId; });
      if (!item) throw { status: 404, message: 'id not found' };
      const diff = Number(quantity) - Number(item.quantity);
      if (diff > 0) return apiFetch('/carts/add-items', { method: 'POST', body: JSON.stringify({ productId: item.productId, variantId: item.variantId, quantity: diff }) });
      if (diff < 0) return apiFetch('/carts/decrease-items', { method: 'POST', body: JSON.stringify({ productId: item.productId, variantId: item.variantId, quantity: Math.abs(diff) }) });
      return { success: true, data: cart.data.items };
    },
    removeItem: async function (itemId) {
      const cart = await api.cart.get();
      const item = (cart.data.items || []).find(function (x) { return x.id === itemId; });
      if (!item) throw { status: 404, message: 'id not found' };
      return apiFetch('/carts/decrease-items', { method: 'POST', body: JSON.stringify({ productId: item.productId, variantId: item.variantId, quantity: item.quantity }) });
    },
    clear: function () { return apiFetch('/carts/clear', { method: 'DELETE' }); }
  },

  orders: {
    create: function (data) {
      return apiFetch('/orders', {
        method: 'POST',
        body: JSON.stringify({
          shippingName: data.shippingName || 'Khách hàng',
          shippingPhone: data.shippingPhone || '0000000000',
          shippingAddress: data.shippingAddress,
          notes: data.notes || '',
          paymentMethod: data.paymentMethod || 'COD',
          couponCode: data.couponCode || null
        })
      });
    },
    list: async function (params) {
      const p = Object.assign({}, params || {});
      const rows = await rawFetch('/orders');
      let content = (rows || []).map(function (o) {
        return {
          id: o.id,
          status: o.status,
          totalAmount: toNumber(o.total_amount, 0),
          discountAmount: toNumber(o.discount_amount, 0),
          finalAmount: toNumber(o.final_amount, 0),
          createdAt: o.created_at,
          shippingAddress: o.shipping_address,
          paymentMethod: o.payment_method,
          paymentStatus: o.payment_status
        };
      });
      if (p.status) {
        content = content.filter(function (x) { return x.status === p.status; });
      }
      return { success: true, data: { content: content, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0 } };
    },
    get: async function (id) {
      const o = await rawFetch('/orders/' + id);
      const items = (o.items || []).map(function (it) {
        return {
          id: it.id,
          productId: it.product_id,
          variantId: it.variant_id,
          productName: it.product_title,
          productTitle: it.product_title,
          imageUrl: toAbsoluteAssetUrl(it.image_url || it.imageUrl || ''),
          quantity: it.quantity,
          price: toNumber(it.price, 0),
          subtotal: toNumber(it.subtotal, 0)
        };
      });
      return {
        success: true,
        data: {
          id: o.id,
          status: o.status,
          totalAmount: toNumber(o.total_amount, 0),
          discountAmount: toNumber(o.discount_amount, 0),
          finalAmount: toNumber(o.final_amount, 0),
          createdAt: o.created_at,
          shippingAddress: o.shipping_address,
          paymentMethod: o.payment_method,
          paymentStatus: o.payment_status,
          items: items
        }
      };
    },
    cancel: function (id) { return apiFetch('/orders/' + id + '/cancel', { method: 'POST' }); },
    adminList: async function (params) {
      const p = Object.assign({}, params || {});
      if (p.size && !p.limit) p.limit = p.size;
      if (p.page != null) p.page = Number(p.page) + 1;
      if (p.email && !p.keyword) p.keyword = p.email;
      delete p.size;
      const rows = await rawFetch('/orders/admin/all' + (Object.keys(p).length > 0 ? '?' + new URLSearchParams(p).toString() : ''));
      const content = (rows || []).map(function (o) {
        return {
          id: o.id,
          status: o.status,
          userEmail: o.email || '',
          paymentMethod: o.payment_method,
          finalAmount: toNumber(o.final_amount, 0),
          createdAt: o.created_at
        };
      });
      return { success: true, data: { content: content, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0 } };
    },
    adminUpdateStatus: function (id, data) {
      return apiFetch('/orders/admin/' + id + '/status', { method: 'PUT', body: JSON.stringify(data) });
    }
  },

  reviews: {
    getByProduct: async function (productId) {
      const rows = await rawFetch('/reviews/product/' + productId);
      const content = (rows || []).map(function (r) {
        return {
          id: r.id,
          rating: toNumber(r.rating, 0),
          comment: r.comment || '',
          status: r.status,
          userName: r.username,
          avatarUrl: r.avatar_url,
          createdAt: r.created_at,
          imageUrls: Array.isArray(r.images) ? r.images.filter(Boolean).map(toAbsoluteAssetUrl) : []
        };
      });
      return { success: true, data: { content: content, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0 } };
    },
    getMy: async function () {
      const rows = await rawFetch('/reviews/my');
      return { success: true, data: rows || [] };
    },
    canReview: async function () { return { success: true, data: true }; },
    create: function (data) {
      return apiFetch('/reviews', { method: 'POST', body: JSON.stringify({ productId: data.productId, rating: data.rating, comment: data.comment || '' }) });
    },
    uploadImage: async function () {
      return { success: true, data: { url: '' } };
    },
    uploadImagesByReviewId: async function (reviewId, files) {
      const token = Auth.getAccess();
      const fd = new FormData();
      files.forEach(function (f) { fd.append('images', f); });
      const res = await fetch(API_BASE + '/reviews/' + reviewId + '/images', {
        method: 'POST',
        headers: token ? { Authorization: 'Bearer ' + token } : {},
        body: fd
      });
      const data = await res.json().catch(function () { return null; });
      if (!res.ok) throw { status: res.status, message: (data && data.message) || 'Upload error' };
      return { success: true, data: data };
    },
    update: function (id, data) { return apiFetch('/reviews/' + id, { method: 'PUT', body: JSON.stringify(data) }); },
    delete: function (id) { return apiFetch('/reviews/' + id, { method: 'DELETE' }); },
    adminList: async function (params) {
      const p = Object.assign({}, params || {});
      if (p.status === '' || p.status == null) delete p.status;
      const rows = await rawFetch('/reviews/admin/pending' + (Object.keys(p).length > 0 ? '?' + new URLSearchParams(p).toString() : ''));
      const content = (rows || []).map(function (r) {
        return {
          id: r.id,
          productId: r.product_id,
          productName: r.product_title,
          rating: toNumber(r.rating, 0),
          comment: r.comment || '',
          status: r.status || 'PENDING',
          userName: r.username || '',
          createdAt: r.created_at,
          imageUrls: Array.isArray(r.images) ? r.images.filter(Boolean).map(toAbsoluteAssetUrl) : []
        };
      });
      return { success: true, data: { content: content, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0 } };
    },
    adminModerate: function (id, status) {
      return apiFetch('/reviews/admin/' + id + '/status', { method: 'PUT', body: JSON.stringify({ status: status }) });
    }
  },

  coupons: {
    validate: async function (code, orderAmount) {
      const rs = await rawFetch('/coupons/validate', { method: 'POST', body: JSON.stringify({ code: code, orderAmount: orderAmount }) });
      let discountAmount = 0;
      const val = toNumber(rs.value, 0);
      if ((rs.type || '').toUpperCase() === 'PERCENT') discountAmount = toNumber(orderAmount, 0) * val / 100;
      else discountAmount = val;
      return { success: true, data: Object.assign({}, rs, { discountAmount: discountAmount }) };
    },
    list: function () { return apiFetch('/coupons'); },
    get: function (id) { return apiFetch('/coupons/' + id); },
    create: function (data) { return apiFetch('/coupons', { method: 'POST', body: JSON.stringify(data) }); },
    update: function (id, data) { return apiFetch('/coupons/' + id, { method: 'PUT', body: JSON.stringify(data) }); },
    delete: function (id) { return apiFetch('/coupons/' + id, { method: 'DELETE' }); },
    toggle: async function (id) {
      const c = await api.coupons.get(id);
      return api.coupons.update(id, { isActive: !c.data.is_active });
    }
  },

  users: {
    list: async function (params) {
      const p = Object.assign({}, params || {});
      if (p.size && !p.limit) p.limit = p.size;
      if (p.page != null) p.page = Number(p.page) + 1;
      if (p.search && !p.keyword) p.keyword = p.search;
      delete p.size;
      delete p.search;
      const rows = await rawFetch('/users?' + new URLSearchParams(p));
      const content = Array.isArray(rows) ? rows.map(normalizeUser) : [];
      return { success: true, data: { content: content, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0 } };
    },
    me: function () { return api.auth.profile(); },
    updateMe: async function () { throw { status: 400, message: 'Backend chưa hỗ trợ cập nhật profile user' }; },
    get: function (id) { return apiFetch('/users/' + id); },
    update: function (id, data) { return apiFetch('/users/' + id, { method: 'PUT', body: JSON.stringify(data) }); },
    delete: function (id) { return apiFetch('/users/' + id, { method: 'DELETE' }); },
    toggleStatus: async function (id) {
      const u = await api.users.get(id);
      const next = u.data.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
      return api.users.update(id, { status: next });
    }
  },

  flashSales: {
    getActive: async function () {
      const rows = await rawFetch('/flash-sales/active');
      const data = (rows || []).map(normalizeFlashSale);
      return { success: true, data: data };
    },
    getById: async function (id) {
      const row = await rawFetch('/flash-sales/' + id);
      return { success: true, data: normalizeFlashSale(row) };
    },
    adminList: async function () {
      const rows = await rawFetch('/flash-sales');
      const content = (rows || []).map(normalizeFlashSale);
      return { success: true, data: { content: content, totalElements: content.length, totalPages: content.length > 0 ? 1 : 0 } };
    },
    create: function (data) {
      return apiFetch('/flash-sales', { method: 'POST', body: JSON.stringify({ title: data.title || data.name, discountPercent: data.discountPercent, startsAt: data.startsAt, endsAt: data.endsAt }) });
    },
    update: function (id, data) {
      return apiFetch('/flash-sales/' + id, { method: 'PUT', body: JSON.stringify({ title: data.title || data.name, discountPercent: data.discountPercent, startsAt: data.startsAt, endsAt: data.endsAt, status: data.status }) });
    },
    delete: function (id) { return apiFetch('/flash-sales/' + id, { method: 'DELETE' }); },
    addProduct: function (id, productId, stockLimit) { return apiFetch('/flash-sales/' + id + '/products', { method: 'POST', body: JSON.stringify({ productId: productId, stockLimit: stockLimit }) }); },
    removeProduct: function (id, productId) { return apiFetch('/flash-sales/' + id + '/products/' + productId, { method: 'DELETE' }); }
  },

  wishlist: {
    get: async function () {
      const rows = await rawFetch('/wishlists');
      const items = (rows || []).map(function (r) {
        const productId = r.product_id || r.productId || r.id;
        const price = toNumber(r.price, 0);
        const salePrice = r.sale_price != null ? toNumber(r.sale_price, 0) : null;
        return {
          id: productId,
          productId: productId,
          name: r.name || r.title || '',
          title: r.title || r.name || '',
          slug: r.slug || '',
          price: price,
          salePrice: salePrice,
          flashPrice: null,
          categoryName: r.category_name || '',
          primaryImageUrl: toAbsoluteAssetUrl(r.primary_image || r.image || ''),
          imageUrl: toAbsoluteAssetUrl(r.primary_image || r.image || '')
        };
      });
      return { success: true, data: items };
    },
    toggle: function (productId) { return apiFetch('/wishlists/' + productId, { method: 'POST' }); },
    check: async function (productId) {
      const r = await rawFetch('/wishlists/check/' + productId);
      return { success: true, data: { wishlisted: !!r.isWishlisted, isWishlisted: !!r.isWishlisted } };
    }
  },

  dashboard: { get: async function () { throw { status: 400, message: 'Dashboard API chưa hỗ trợ' }; } },
  ai: {
    chat: async function () { throw { status: 400, message: 'AI API chưa hỗ trợ' }; },
    recommendations: async function () { throw { status: 400, message: 'AI API chưa hỗ trợ' }; }
  },
  loyalty: {
    getSummary: async function () { return { success: true, data: { totalPoints: 0 } }; },
    getReferralCode: async function () { return { success: true, data: { referralCode: '' } }; },
    adminListUsers: async function () { throw { status: 400, message: 'Loyalty API chưa hỗ trợ' }; },
    adminGetConfig: async function () { throw { status: 400, message: 'Loyalty API chưa hỗ trợ' }; },
    adminUpdateConfig: async function () { throw { status: 400, message: 'Loyalty API chưa hỗ trợ' }; },
    adminAdjustPoints: async function () { throw { status: 400, message: 'Loyalty API chưa hỗ trợ' }; }
  },
  inventory: {
    getMovements: async function () { throw { status: 400, message: 'Inventory API chưa hỗ trợ' }; },
    adjust: async function () { throw { status: 400, message: 'Inventory API chưa hỗ trợ' }; }
  },
  config: {
    getAll: async function () { throw { status: 400, message: 'Config API chưa hỗ trợ' }; },
    update: async function () { throw { status: 400, message: 'Config API chưa hỗ trợ' }; }
  },
  security: {
    getPublicConfig: async function () { return { success: true, data: {} }; },
    reportDevtools: async function () { return { success: true, data: {} }; }
  },
  payment: {
    momoCreate: async function () { throw { status: 400, message: 'Momo API chưa hỗ trợ' }; }
  }
};

function showToast(message, type) {
  if (!type) type = 'success';
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span>' + message + '</span>';
  document.body.appendChild(toast);
  setTimeout(function () { toast.classList.add('show'); }, 10);
  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () { toast.remove(); }, 300);
  }, 3000);
}

function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm"></span> Đang xử lý...';
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
  }
}

function renderStars(rating) {
  return [1, 2, 3, 4, 5].map(function (i) {
    const fill = i <= rating ? 'currentColor' : 'none';
    return '<svg class="star ' + (i <= rating ? 'filled' : '') + '" viewBox="0 0 24 24" fill="' + fill + '" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  }).join('');
}

function getStatusBadge(status) {
  const map = {
    PENDING: ['badge-warning', 'Chờ xác nhận'],
    CONFIRMED: ['badge-info', 'Đã xác nhận'],
    SHIPPING: ['badge-primary', 'Đang giao'],
    DELIVERED: ['badge-success', 'Đã giao'],
    CANCELLED: ['badge-danger', 'Đã hủy'],
    ACTIVE: ['badge-success', 'Hoạt động'],
    INACTIVE: ['badge-danger', 'Vô hiệu'],
    APPROVED: ['badge-success', 'Đã duyệt'],
    REJECTED: ['badge-danger', 'Từ chối'],
    BLOCKED: ['badge-danger', 'Đã khóa']
  };
  const x = map[status] || ['badge-secondary', status || 'N/A'];
  return '<span class="badge ' + x[0] + '">' + x[1] + '</span>';
}

async function updateCartCount() {
  if (!Auth.isLoggedIn()) return;
  try {
    const res = await api.cart.get();
    const count = res.data ? (res.data.totalItems || 0) : 0;
    document.querySelectorAll('.cart-count').forEach(function (el) {
      el.textContent = count;
      el.style.display = count > 0 ? 'flex' : 'none';
    });
  } catch (e) {}
}

function renderNavActions() {
  const user = Auth.getUser();
  const navActions = document.getElementById('navActions');
  if (!navActions) return;

  if (Auth.isLoggedIn()) {
    const adminLink = Auth.isAdmin() ? '<a href="/admin/products.html" class="nav-link admin-link">Admin</a>' : '';
    const userName = (user && (user.name || user.fullName || user.username)) || 'Tài khoản';
    navActions.innerHTML =
      adminLink +
      '<a href="/wishlist.html" class="nav-link" title="Yêu thích">Yêu thích</a>' +
      '<a href="/profile.html" class="nav-link user-link">' + userName + '</a>' +
      '<a href="/cart.html" class="navbar__cart" id="cartBtn">Giỏ<span class="navbar__cart-count cart-count" style="display:none">0</span></a>' +
      '<button onclick="handleLogout()" class="btn btn-outline btn-sm">Đăng xuất</button>';
    updateCartCount();
  } else {
    navActions.innerHTML =
      '<a href="/login.html" class="btn btn-outline btn-sm">Đăng nhập</a>' +
      '<a href="/register.html" class="btn btn-primary btn-sm">Đăng ký</a>';
  }
}

async function handleLogout() {
  try { await api.auth.logout(); } catch (e) {}
  Auth.clear();
  showToast('\u0110\u00e3 \u0111\u0103ng xu\u1ea5t');
  setTimeout(function () { window.location.href = '/index.html'; }, 500);
}
