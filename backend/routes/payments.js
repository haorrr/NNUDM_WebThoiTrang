var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.post('/', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let { orderId, method, amount, note } = req.body;
    if (!orderId || !amount) {
      return res.status(400).send({ message: 'orderId va amount la bat buoc' });
    }

    let order = await pool.query(
      'SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND is_deleted=false',
      [orderId, userId]
    );
    if (order.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }

    let result = await pool.query(
      `INSERT INTO payments (user_id, order_id, method, amount, note)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, orderId, method || 'cod', amount, note || '']
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/order/:orderId', checkLogin, async function (req, res, next) {
  try {
    let userId = req.user.id;
    let result = await pool.query(
      'SELECT * FROM payments WHERE order_id=$1 AND user_id=$2',
      [req.params.orderId, userId]
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

    let conditions = [];
    let params = [];
    let idx = 1;
    if (status) {
      conditions.push('p.status=$' + idx);
      params.push(status);
      idx++;
    }
    let where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    let result = await pool.query(
      `SELECT p.*, u.username, o.status as order_status
       FROM payments p
       JOIN users u ON u.id=p.user_id
       JOIN orders o ON o.id=p.order_id
       ${where}
       ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id/status', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { status, transactionId } = req.body;
    let allowed = ['pending', 'paid', 'failed', 'cancelled', 'refunded'];
    if (!allowed.includes(status)) {
      return res.status(400).send({ message: 'status khong hop le' });
    }
    let paidAt = status === 'paid' ? new Date() : null;
    let result = await pool.query(
      `UPDATE payments SET status=$1, transaction_id=COALESCE($2, transaction_id),
       paid_at=COALESCE($3, paid_at), updated_at=NOW()
       WHERE id=$4 RETURNING *`,
      [status, transactionId || null, paidAt, req.params.id]
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

