var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.get('/active', async function (req, res, next) {
  try {
    let result = await pool.query(
      `SELECT fs.*,
              json_agg(json_build_object(
                'id', fsp.id, 'productId', fsp.product_id,
                'stockLimit', fsp.stock_limit, 'soldCount', fsp.sold_count,
                'title', p.title, 'price', p.price,
                'image', (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=true LIMIT 1)
              )) FILTER (WHERE fsp.id IS NOT NULL) as products
       FROM flash_sales fs
       LEFT JOIN flash_sale_products fsp ON fsp.flash_sale_id=fs.id
       LEFT JOIN products p ON p.id=fsp.product_id
       WHERE fs.is_deleted=false AND fs.status='ACTIVE'
         AND fs.starts_at <= NOW() AND fs.ends_at >= NOW()
       GROUP BY fs.id`
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'SELECT * FROM flash_sales WHERE is_deleted=false ORDER BY created_at DESC'
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/:id', async function (req, res, next) {
  try {
    let fs = await pool.query(
      'SELECT * FROM flash_sales WHERE id=$1 AND is_deleted=false',
      [req.params.id]
    );
    if (fs.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    let products = await pool.query(
      `SELECT fsp.*, p.title, p.price, p.sale_price,
              (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=true LIMIT 1) as image
       FROM flash_sale_products fsp JOIN products p ON p.id=fsp.product_id
       WHERE fsp.flash_sale_id=$1`,
      [req.params.id]
    );
    res.send({ ...fs.rows[0], products: products.rows });
  } catch (err) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.post('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { title, discountPercent, startsAt, endsAt } = req.body;
    if (!title || !discountPercent || !startsAt || !endsAt) {
      return res.status(400).send({ message: 'title, discountPercent, startsAt, endsAt la bat buoc' });
    }
    let result = await pool.query(
      `INSERT INTO flash_sales (title, discount_percent, starts_at, ends_at)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [title, discountPercent, startsAt, endsAt]
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { title, discountPercent, startsAt, endsAt, status } = req.body;
    let result = await pool.query(
      `UPDATE flash_sales SET
       title=COALESCE($1, title), discount_percent=COALESCE($2, discount_percent),
       starts_at=COALESCE($3, starts_at), ends_at=COALESCE($4, ends_at),
       status=COALESCE($5, status), updated_at=NOW()
       WHERE id=$6 AND is_deleted=false RETURNING *`,
      [title, discountPercent, startsAt, endsAt, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'UPDATE flash_sales SET is_deleted=true, updated_at=NOW() WHERE id=$1 AND is_deleted=false RETURNING id',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send({ message: 'xoa thanh cong' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/:id/products', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { productId, stockLimit } = req.body;
    if (!productId) {
      return res.status(400).send({ message: 'productId la bat buoc' });
    }
    let result = await pool.query(
      `INSERT INTO flash_sale_products (flash_sale_id, product_id, stock_limit)
       VALUES ($1,$2,$3)
       ON CONFLICT (flash_sale_id, product_id) DO UPDATE SET stock_limit=$3
       RETURNING *`,
      [req.params.id, productId, stockLimit || 0]
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/:id/products/:productId', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'DELETE FROM flash_sale_products WHERE flash_sale_id=$1 AND product_id=$2 RETURNING id',
      [req.params.id, req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send({ message: 'da xoa san pham khoi flash sale' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;

