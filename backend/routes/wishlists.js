var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin } = require('../utils/authHandler');

router.get('/', checkLogin, async function (req, res, next) {
  try {
    let result = await pool.query(
      `SELECT w.*, p.title, p.price, p.sale_price, p.slug,
              fs.discount_percent as flash_discount_percent,
              fs.ends_at as flash_ends_at,
              CASE
                WHEN fs.discount_percent IS NOT NULL
                THEN ROUND((COALESCE(p.sale_price, p.price)::numeric * (100 - fs.discount_percent) / 100), 0)
                ELSE NULL
              END as flash_price,
              (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=true LIMIT 1) as image
       FROM wishlists w
       JOIN products p ON p.id=w.product_id
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
       WHERE w.user_id=$1 AND p.is_deleted=false
       ORDER BY w.created_at DESC`,
      [req.user.id]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/check/:productId', checkLogin, async function (req, res, next) {
  try {
    let result = await pool.query(
      'SELECT id FROM wishlists WHERE user_id=$1 AND product_id=$2',
      [req.user.id, req.params.productId]
    );
    res.send({ isWishlisted: result.rows.length > 0 });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/:productId', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let productId = req.params.productId;

    let exist = await pool.query(
      'SELECT id FROM wishlists WHERE user_id=$1 AND product_id=$2',
      [userId, productId]
    );

    if (exist.rows.length > 0) {
      await pool.query(
        'DELETE FROM wishlists WHERE user_id=$1 AND product_id=$2',
        [userId, productId]
      );
      res.send({ message: 'da xoa khoi wishlist', isWishlisted: false });
    } else {
      await pool.query(
        'INSERT INTO wishlists (user_id, product_id) VALUES ($1,$2)',
        [userId, productId]
      );
      res.send({ message: 'da them vao wishlist', isWishlisted: true });
    }
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
