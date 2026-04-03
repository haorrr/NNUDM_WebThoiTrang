var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.get('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      `SELECT i.*, p.title as product_title, p.slug
       FROM inventories i JOIN products p ON p.id=i.product_id
       WHERE p.is_deleted=false ORDER BY p.title`
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/:productId', async function (req, res, next) {
  try {
    let result = await pool.query(
      'SELECT * FROM inventories WHERE product_id=$1',
      [req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result.rows[0]);
  } catch (err) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.put('/:productId', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { stock, reserved } = req.body;
    let result = await pool.query(
      `UPDATE inventories
       SET stock=COALESCE($1, stock),
           reserved=COALESCE($2, reserved),
           updated_at=NOW()
       WHERE product_id=$3 RETURNING *`,
      [stock, reserved, req.params.productId]
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

