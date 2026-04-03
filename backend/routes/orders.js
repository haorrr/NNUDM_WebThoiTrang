var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.post('/', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let { shippingName, shippingPhone, shippingAddress, notes, paymentMethod, couponCode } = req.body;
    if (!shippingName || !shippingPhone || !shippingAddress) {
      return res.status(400).send({ message: 'thong tin giao hang la bat buoc' });
    }

    let cart = await pool.query('SELECT id FROM carts WHERE user_id=$1', [userId]);
    if (cart.rows.length === 0) {
      return res.status(400).send({ message: 'gio hang trong' });
    }
    let cartId = cart.rows[0].id;

    let items = await pool.query(
      `SELECT ci.*, p.title, p.price, p.sale_price, pv.price_adjustment, pv.size, pv.color
       FROM cart_items ci
       JOIN products p ON p.id=ci.product_id
       LEFT JOIN product_variants pv ON pv.id=ci.variant_id
       WHERE ci.cart_id=$1`,
      [cartId]
    );
    if (items.rows.length === 0) {
      return res.status(400).send({ message: 'gio hang trong' });
    }

    let totalAmount = 0;
    for (let item of items.rows) {
      let basePrice = Number(item.sale_price || item.price || 0);
      let adjustment = Number(item.price_adjustment || 0);
      totalAmount += (basePrice + adjustment) * item.quantity;
    }

    let discountAmount = 0;
    let validCouponCode = null;
    if (couponCode) {
      let coupon = await pool.query(
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
          await pool.query('UPDATE coupons SET used_count=used_count+1 WHERE id=$1', [c.id]);
        }
      }
    }

    let finalAmount = totalAmount - discountAmount;

    let orderResult = await pool.query(
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
      let basePrice = Number(item.sale_price || item.price || 0);
      let adjustment = Number(item.price_adjustment || 0);
      let unitPrice = basePrice + adjustment;
      let variantInfo = [item.size, item.color].filter(Boolean).join(' / ');
      await pool.query(
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
    }

    await pool.query('DELETE FROM cart_items WHERE cart_id=$1', [cartId]);
    res.send(order);
  } catch (err) {
    res.status(400).send({ message: err.message });
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
      'SELECT * FROM order_items WHERE order_id=$1',
      [req.params.id]
    );
    res.send({ ...order.rows[0], items: items.rows });
  } catch (err) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.post('/:id/cancel', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let order = await pool.query(
      'SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND is_deleted=false',
      [req.params.id, userId]
    );
    if (order.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    if (order.rows[0].status !== 'PENDING') {
      return res.status(400).send({ message: 'chi huy duoc don o trang thai PENDING' });
    }
    let result = await pool.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      ['CANCELLED', req.params.id]
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/admin/:id/status', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { status } = req.body;
    let allowed = ['PENDING', 'CONFIRMED', 'SHIPPING', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      return res.status(400).send({ message: 'status khong hop le' });
    }
    let result = await pool.query(
      'UPDATE orders SET status=$1, updated_at=NOW() WHERE id=$2 AND is_deleted=false RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
