var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

function mapCouponRow(row) {
  let value = parseFloat(row.value || 0);
  let minOrderAmount = parseFloat(row.min_order_amount || 0);
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    value: value,
    discountType: row.type,
    discountValue: value,
    minOrderAmount: minOrderAmount,
    maxUses: row.max_uses || 0,
    usedCount: row.used_count || 0,
    expiresAt: row.expires_at,
    isActive: !!row.is_active,
    is_active: !!row.is_active,
    status: row.is_active ? 'ACTIVE' : 'INACTIVE',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function getCouponPayload(body) {
  let type = body.type || body.discountType;
  let value = body.value;
  if (value === undefined || value === null || value === '') {
    value = body.discountValue;
  }
  return {
    code: body.code,
    type: type ? String(type).toUpperCase() : type,
    value: value,
    minOrderAmount: body.minOrderAmount,
    maxUses: body.maxUses,
    expiresAt: body.expiresAt,
    isActive: body.isActive
  };
}

router.post('/validate', checkLogin, async function (req, res, next) {
  try {
    let { code, orderAmount } = req.body;
    if (!code) {
      return res.status(400).send({ message: 'code la bat buoc' });
    }

    let result = await pool.query(
      `SELECT * FROM coupons WHERE code=$1 AND is_active=true AND is_deleted=false
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (max_uses=0 OR used_count < max_uses)`,
      [code.toUpperCase()]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'coupon khong hop le hoac het han' });
    }
    let coupon = result.rows[0];
    if (orderAmount && parseFloat(orderAmount) < parseFloat(coupon.min_order_amount)) {
      return res.status(400).send({ message: 'don hang toi thieu ' + coupon.min_order_amount + ' VND' });
    }
    res.send(mapCouponRow(coupon));
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  let data = await pool.query(
    'SELECT * FROM coupons WHERE is_deleted=false ORDER BY created_at DESC'
  );
  res.send(data.rows.map(mapCouponRow));
});

router.get('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'SELECT * FROM coupons WHERE id=$1 AND is_deleted=false',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(mapCouponRow(result.rows[0]));
  } catch (err) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.post('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { code, type, value, minOrderAmount, maxUses, expiresAt, isActive } = getCouponPayload(req.body);
    if (!code || !type || value === undefined || value === null || value === '') {
      return res.status(400).send({ message: 'code, type, value la bat buoc' });
    }
    let result = await pool.query(
      `INSERT INTO coupons (code, type, value, min_order_amount, max_uses, expires_at, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [code.toUpperCase(), type, value, minOrderAmount || 0, maxUses || 0, expiresAt || null, isActive !== false]
    );
    res.send(mapCouponRow(result.rows[0]));
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { code, type, value, minOrderAmount, maxUses, expiresAt, isActive } = getCouponPayload(req.body);
    let result = await pool.query(
      `UPDATE coupons SET
       code=COALESCE($1, code), type=COALESCE($2, type), value=COALESCE($3, value),
       min_order_amount=COALESCE($4, min_order_amount), max_uses=COALESCE($5, max_uses),
       expires_at=COALESCE($6, expires_at), is_active=COALESCE($7, is_active),
       updated_at=NOW()
       WHERE id=$8 AND is_deleted=false RETURNING *`,
      [code ? code.toUpperCase() : null, type, value, minOrderAmount, maxUses, expiresAt, isActive, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(mapCouponRow(result.rows[0]));
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'UPDATE coupons SET is_deleted=true, updated_at=NOW() WHERE id=$1 AND is_deleted=false RETURNING id',
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

module.exports = router;
