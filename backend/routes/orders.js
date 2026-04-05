var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

let adjustFlashSaleSoldCountByItems = async function (client, items, delta) {
  for (let item of items) {
    let quantity = Number(item.quantity || 0);
    if (quantity <= 0) continue;
    await client.query(
      `UPDATE flash_sale_products fsp
       SET sold_count = GREATEST(0, sold_count + (($1::int) * ($2::int)))
       FROM flash_sales fs
       WHERE fsp.flash_sale_id=fs.id
         AND fsp.product_id=$3
         AND fs.is_deleted=false
         AND fs.status IN ('ACTIVE', 'SCHEDULED')
         AND fs.starts_at <= NOW()
         AND fs.ends_at >= NOW()`,
      [delta, quantity, item.product_id]
    );
  }
};

let syncInventoryFromVariants = async function (client, productId) {
  let sum = await client.query(
    'SELECT COALESCE(SUM(stock), 0)::int as total FROM product_variants WHERE product_id=$1 AND is_deleted=false',
    [productId]
  );
  let total = Number(sum.rows[0].total || 0);
  let updated = await client.query(
    'UPDATE inventories SET stock=$1, updated_at=NOW() WHERE product_id=$2 RETURNING product_id',
    [total, productId]
  );
  if (updated.rows.length === 0) {
    await client.query(
      'INSERT INTO inventories (product_id, stock) VALUES ($1, $2)',
      [productId, total]
    );
  }
};

let restoreStockForOrder = async function (client, orderId) {
  let items = await client.query(
    'SELECT product_id, variant_id, quantity FROM order_items WHERE order_id=$1',
    [orderId]
  );

  for (let item of items.rows) {
    if (item.variant_id) {
      await client.query(
        'UPDATE product_variants SET stock=stock+$1, updated_at=NOW() WHERE id=$2 AND is_deleted=false',
        [item.quantity, item.variant_id]
      );
      await syncInventoryFromVariants(client, item.product_id);
    } else {
      await client.query(
        'UPDATE inventories SET stock=stock+$1, updated_at=NOW() WHERE product_id=$2',
        [item.quantity, item.product_id]
      );
    }
  }
  await adjustFlashSaleSoldCountByItems(client, items.rows, -1);
};

router.post('/', checkLogin, async function (req, res, next) {
  let client = await pool.connect();
  try {
    await client.query('BEGIN');

    let userId = req.user.id;
    let { shippingName, shippingPhone, shippingAddress, notes, paymentMethod, couponCode } = req.body;
    if (!shippingName || !shippingPhone || !shippingAddress) {
      await client.query('ROLLBACK');
      return res.status(400).send({ message: 'thong tin giao hang la bat buoc' });
    }

    let cart = await client.query('SELECT id FROM carts WHERE user_id=$1', [userId]);
    if (cart.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).send({ message: 'gio hang trong' });
    }
    let cartId = cart.rows[0].id;

    let items = await client.query(
      `SELECT ci.*, p.title, p.price, p.sale_price,
              fs.discount_percent as flash_discount_percent,
              fs.ends_at as flash_ends_at,
              CASE
                WHEN fs.discount_percent IS NOT NULL
                THEN ROUND((COALESCE(p.sale_price, p.price)::numeric * (100 - fs.discount_percent) / 100), 0)
                ELSE NULL
              END as flash_price,
              pv.price_adjustment, pv.size, pv.color
       FROM cart_items ci
       JOIN products p ON p.id=ci.product_id
       LEFT JOIN product_variants pv ON pv.id=ci.variant_id
       LEFT JOIN LATERAL (
         SELECT fs1.discount_percent, fs1.ends_at
         FROM flash_sale_products fsp
         JOIN flash_sales fs1 ON fs1.id=fsp.flash_sale_id
         WHERE fsp.product_id=p.id
           AND fs1.is_deleted=false
           AND fs1.status IN ('ACTIVE', 'SCHEDULED')
           AND fs1.starts_at <= NOW()
           AND fs1.ends_at >= NOW()
         ORDER BY fs1.discount_percent DESC, fs1.ends_at ASC
         LIMIT 1
       ) fs ON true
       WHERE ci.cart_id=$1`,
      [cartId]
    );
    if (items.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).send({ message: 'gio hang trong' });
    }

    for (let item of items.rows) {
      let flash = await client.query(
        `SELECT fsp.stock_limit, fsp.sold_count
         FROM flash_sale_products fsp
         JOIN flash_sales fs ON fs.id=fsp.flash_sale_id
         WHERE fsp.product_id=$1
           AND fs.is_deleted=false
           AND fs.status IN ('ACTIVE', 'SCHEDULED')
           AND fs.starts_at <= NOW()
           AND fs.ends_at >= NOW()
         ORDER BY fs.discount_percent DESC, fs.ends_at ASC
         LIMIT 1
         FOR UPDATE`,
        [item.product_id]
      );
      if (flash.rows.length > 0) {
        let remaining = Number(flash.rows[0].stock_limit || 0) - Number(flash.rows[0].sold_count || 0);
        if (remaining < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).send({ message: 'san pham "' + item.title + '" vuot qua so luong flash sale con lai' });
        }
      }

      if (item.variant_id) {
        let variant = await client.query(
          'SELECT stock FROM product_variants WHERE id=$1 AND is_deleted=false FOR UPDATE',
          [item.variant_id]
        );
        if (variant.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).send({ message: 'bien the khong ton tai' });
        }
        if (Number(variant.rows[0].stock || 0) < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).send({ message: 'bien the cua san pham "' + item.title + '" khong du ton kho' });
        }
      } else {
        let inv = await client.query(
          'SELECT stock FROM inventories WHERE product_id=$1 FOR UPDATE',
          [item.product_id]
        );
        if (inv.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).send({ message: 'khong tim thay ton kho san pham ' + item.product_id });
        }
        if (Number(inv.rows[0].stock || 0) < item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).send({ message: 'san pham "' + item.title + '" khong du ton kho' });
        }
      }
    }

    let totalAmount = 0;
    for (let item of items.rows) {
      let basePrice = Number(item.flash_price || item.sale_price || item.price || 0);
      let adjustment = Number(item.price_adjustment || 0);
      totalAmount += (basePrice + adjustment) * item.quantity;
    }

    let discountAmount = 0;
    let validCouponCode = null;
    if (couponCode) {
      let coupon = await client.query(
        `SELECT * FROM coupons WHERE code=$1 AND is_active=true AND is_deleted=false
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (max_uses=0 OR used_count < max_uses)`,
        [couponCode]
      );
      if (coupon.rows.length > 0) {
        let c = coupon.rows[0];
        if (totalAmount >= c.min_order_amount) {
          if (c.type === 'PERCENT') {
            discountAmount = totalAmount * c.value / 100;
          } else {
            discountAmount = parseFloat(c.value);
          }
          validCouponCode = c.code;
          await client.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1', [c.id]);
        }
      }
    }

    let finalAmount = totalAmount - discountAmount;

    let orderResult = await client.query(
      `INSERT INTO orders (user_id, total_amount, discount_amount, final_amount, coupon_code,
        shipping_name, shipping_phone, shipping_address, notes, payment_method)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        userId,
        totalAmount,
        discountAmount,
        finalAmount,
        validCouponCode,
        shippingName,
        shippingPhone,
        shippingAddress,
        notes || '',
        paymentMethod || 'COD'
      ]
    );
    let order = orderResult.rows[0];

    for (let item of items.rows) {
      let basePrice = Number(item.flash_price || item.sale_price || item.price || 0);
      let adjustment = Number(item.price_adjustment || 0);
      let unitPrice = basePrice + adjustment;
      let variantInfo = [item.size, item.color].filter(Boolean).join(' / ');
      await client.query(
        `INSERT INTO order_items (order_id, product_id, variant_id, product_title, variant_info, price, quantity, subtotal)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          order.id,
          item.product_id,
          item.variant_id || null,
          item.title,
          variantInfo,
          unitPrice,
          item.quantity,
          unitPrice * item.quantity
        ]
      );

      if (item.variant_id) {
        await client.query(
          'UPDATE product_variants SET stock=stock-$1, updated_at=NOW() WHERE id=$2 AND is_deleted=false',
          [item.quantity, item.variant_id]
        );
        await syncInventoryFromVariants(client, item.product_id);
      } else {
        await client.query(
          'UPDATE inventories SET stock=stock-$1, updated_at=NOW() WHERE product_id=$2',
          [item.quantity, item.product_id]
        );
      }
    }
    await adjustFlashSaleSoldCountByItems(client, items.rows, 1);

    await client.query('DELETE FROM cart_items WHERE cart_id=$1', [cartId]);
    await client.query('COMMIT');
    res.send(order);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).send({ message: err.message });
  } finally {
    client.release();
  }
});

router.get('/', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let result = await pool.query(
      'SELECT * FROM orders WHERE user_id=$1 AND is_deleted=false ORDER BY created_at DESC',
      [userId]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/admin/all', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { status, page, limit } = req.query;
    page = page ? parseInt(page) : 1;
    limit = limit ? parseInt(limit) : 20;
    let offset = (page - 1) * limit;

    let conditions = ['o.is_deleted=false'];
    let params = [];
    let idx = 1;
    if (status) {
      conditions.push('o.status=$' + idx);
      params.push(status);
      idx++;
    }
    let where = conditions.join(' AND ');
    let result = await pool.query(
      `SELECT o.*, u.username, u.email FROM orders o
       JOIN users u ON u.id=o.user_id
       WHERE ${where}
       ORDER BY o.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/:id', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let order = await pool.query(
      'SELECT * FROM orders WHERE id=$1 AND is_deleted=false',
      [req.params.id]
    );
    if (order.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }

    let role = await pool.query(
      'SELECT r.name FROM users u JOIN roles r ON r.id=u.role_id WHERE u.id=$1',
      [userId]
    );
    let isAdmin = role.rows.length > 0 && role.rows[0].name === 'ADMIN';
    if (!isAdmin && order.rows[0].user_id !== userId) {
      return res.status(403).send({ message: 'ban khong co quyen' });
    }

    let items = await pool.query(
      `SELECT oi.*,
              (SELECT url
               FROM product_images
               WHERE product_id=oi.product_id AND is_primary=true
               ORDER BY id
               LIMIT 1) as image_url
       FROM order_items oi
       WHERE oi.order_id=$1`,
      [req.params.id]
    );
    res.send({ ...order.rows[0], items: items.rows });
  } catch (err) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.post('/:id/cancel', checkLogin, async function (req, res, next) {
  let client = await pool.connect();
  try {
    await client.query('BEGIN');

    let userId = req.user.id;
    let order = await client.query(
      'SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND is_deleted=false FOR UPDATE',
      [req.params.id, userId]
    );
    if (order.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send({ message: 'id not found' });
    }
    if (order.rows[0].status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).send({ message: 'chi huy duoc don o trang thai PENDING' });
    }
    let result = await client.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      ['CANCELLED', req.params.id]
    );
    await restoreStockForOrder(client, req.params.id);
    await client.query('COMMIT');
    res.send(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).send({ message: err.message });
  } finally {
    client.release();
  }
});

router.put('/admin/:id/status', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  let client = await pool.connect();
  try {
    await client.query('BEGIN');

    let { status } = req.body;
    let allowed = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).send({ message: 'status khong hop le' });
    }
    let oldOrder = await client.query(
      'SELECT id, status FROM orders WHERE id=$1 AND is_deleted=false FOR UPDATE',
      [req.params.id]
    );
    if (oldOrder.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).send({ message: 'id not found' });
    }

    let result = await client.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 AND is_deleted=false RETURNING *',
      [status, req.params.id]
    );
    if (status === 'CANCELLED' && oldOrder.rows[0].status !== 'CANCELLED') {
      await restoreStockForOrder(client, req.params.id);
    }
    await client.query('COMMIT');
    res.send(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).send({ message: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
