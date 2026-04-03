var express = require('express');
var router = express.Router({ mergeParams: true });
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.get('/', async function (req, res, next) {
  try {
    let productId = req.params.productId;
    let result = await pool.query(
      'SELECT * FROM product_variants WHERE product_id=$1 AND is_deleted=false ORDER BY id',
      [productId]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/:variantId', async function (req, res, next) {
  try {
    let result = await pool.query(
      'SELECT * FROM product_variants WHERE id=$1 AND product_id=$2 AND is_deleted=false',
      [req.params.variantId, req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result.rows[0]);
  } catch (err) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.post('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let productId = req.params.productId;
    let { size, color, colorCode, sku, stock, priceAdjustment } = req.body;
    let result = await pool.query(
      `INSERT INTO product_variants (product_id, size, color, color_code, sku, stock, price_adjustment)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [productId, size || '', color || '', colorCode || '', sku || null, stock || 0, priceAdjustment || 0]
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:variantId', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { size, color, colorCode, sku, stock, priceAdjustment } = req.body;
    let result = await pool.query(
      `UPDATE product_variants
       SET size=COALESCE($1, size),
           color=COALESCE($2, color),
           color_code=COALESCE($3, color_code),
           sku=COALESCE($4, sku),
           stock=COALESCE($5, stock),
           price_adjustment=COALESCE($6, price_adjustment),
           updated_at=NOW()
       WHERE id=$7 AND product_id=$8 AND is_deleted=false RETURNING *`,
      [size, color, colorCode, sku, stock, priceAdjustment, req.params.variantId, req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/:variantId', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'UPDATE product_variants SET is_deleted=true, updated_at=NOW() WHERE id=$1 AND product_id=$2 AND is_deleted=false RETURNING id',
      [req.params.variantId, req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send({ message: 'xoa thanh cong' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;

