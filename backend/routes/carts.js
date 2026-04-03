var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin } = require('../utils/authHandler');

router.get('/', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let cart = await pool.query('SELECT id FROM carts WHERE user_id=$1', [userId]);
    if (cart.rows.length === 0) {
      return res.send([]);
    }
    let cartId = cart.rows[0].id;
    let items = await pool.query(
      `SELECT ci.*, p.title, p.price, p.sale_price,
              (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=true LIMIT 1) as image,
              pv.size, pv.color, pv.price_adjustment
       FROM cart_items ci
       JOIN products p ON p.id=ci.product_id
       LEFT JOIN product_variants pv ON pv.id=ci.variant_id
       WHERE ci.cart_id=$1`,
      [cartId]
    );
    res.send(items.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/add-items', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let { productId, variantId, quantity } = req.body;
    if (!productId) {
      return res.status(400).send({ message: 'productId la bat buoc' });
    }

    let cart = await pool.query('SELECT id FROM carts WHERE user_id=$1', [userId]);
    let cartId;
    if (cart.rows.length === 0) {
      let newCart = await pool.query('INSERT INTO carts (user_id) VALUES ($1) RETURNING id', [userId]);
      cartId = newCart.rows[0].id;
    } else {
      cartId = cart.rows[0].id;
    }

    let existItem = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id=$1 AND product_id=$2 AND (variant_id=$3 OR (variant_id IS NULL AND $3 IS NULL))',
      [cartId, productId, variantId || null]
    );

    if (existItem.rows.length > 0) {
      let newQty = existItem.rows[0].quantity + (quantity || 1);
      await pool.query(
        'UPDATE cart_items SET quantity=$1, updated_at=NOW() WHERE id=$2',
        [newQty, existItem.rows[0].id]
      );
    } else {
      await pool.query(
        'INSERT INTO cart_items (cart_id, product_id, variant_id, quantity) VALUES ($1,$2,$3,$4)',
        [cartId, productId, variantId || null, quantity || 1]
      );
    }

    let items = await pool.query(
      `SELECT ci.*, p.title, p.price
       FROM cart_items ci JOIN products p ON p.id=ci.product_id
       WHERE ci.cart_id=$1`,
      [cartId]
    );
    res.send(items.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/decrease-items', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let { productId, variantId, quantity } = req.body;

    let cart = await pool.query('SELECT id FROM carts WHERE user_id=$1', [userId]);
    if (cart.rows.length === 0) {
      return res.status(404).send({ message: 'gio hang trong' });
    }
    let cartId = cart.rows[0].id;

    let item = await pool.query(
      'SELECT id, quantity FROM cart_items WHERE cart_id=$1 AND product_id=$2 AND (variant_id=$3 OR (variant_id IS NULL AND $3 IS NULL))',
      [cartId, productId, variantId || null]
    );
    if (item.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }

    let current = item.rows[0];
    let decrease = quantity || 1;
    if (current.quantity <= decrease) {
      await pool.query('DELETE FROM cart_items WHERE id=$1', [current.id]);
    } else {
      await pool.query(
        'UPDATE cart_items SET quantity=$1, updated_at=NOW() WHERE id=$2',
        [current.quantity - decrease, current.id]
      );
    }
    res.send({ message: 'da cap nhat gio hang' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/remove/:productId', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let cart = await pool.query('SELECT id FROM carts WHERE user_id=$1', [userId]);
    if (cart.rows.length === 0) {
      return res.status(404).send({ message: 'gio hang trong' });
    }
    let cartId = cart.rows[0].id;
    let result = await pool.query(
      'DELETE FROM cart_items WHERE cart_id=$1 AND product_id=$2 RETURNING id',
      [cartId, req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send({ message: 'xoa item thanh cong' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/clear', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let cart = await pool.query('SELECT id FROM carts WHERE user_id=$1', [userId]);
    if (cart.rows.length === 0) {
      return res.send({ message: 'gio hang da trong' });
    }
    await pool.query('DELETE FROM cart_items WHERE cart_id=$1', [cart.rows[0].id]);
    res.send({ message: 'da xoa gio hang' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;

