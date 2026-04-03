var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.get('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { page, limit, status, keyword } = req.query;
    page = page ? parseInt(page) : 1;
    limit = limit ? parseInt(limit) : 10;
    let offset = (page - 1) * limit;

    let conditions = ['u.is_deleted=false'];
    let params = [];
    let idx = 1;

    if (status) {
      conditions.push('u.status=$' + idx);
      params.push(status);
      idx++;
    }
    if (keyword) {
      conditions.push('(u.username ILIKE $' + idx + ' OR u.email ILIKE $' + idx + ')');
      params.push('%' + keyword + '%');
      idx++;
    }

    let where = conditions.join(' AND ');
    let result = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.phone,
              u.status, u.login_count, u.role_id, r.name as role_name, u.created_at
       FROM users u LEFT JOIN roles r ON r.id=u.role_id
       WHERE ${where}
       ORDER BY u.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      `SELECT u.id, u.username, u.email, u.full_name, u.avatar_url, u.phone,
              u.status, u.login_count, u.role_id, r.name as role_name, u.created_at
       FROM users u LEFT JOIN roles r ON r.id=u.role_id
       WHERE u.id=$1 AND u.is_deleted=false`,
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result.rows[0]);
  } catch (err) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.put('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { fullName, phone, status, roleId, avatarUrl } = req.body;
    let result = await pool.query(
      `UPDATE users
       SET full_name=COALESCE($1, full_name),
           phone=COALESCE($2, phone),
           status=COALESCE($3, status),
           role_id=COALESCE($4, role_id),
           avatar_url=COALESCE($5, avatar_url),
           updated_at=NOW()
       WHERE id=$6 AND is_deleted=false
       RETURNING id, username, email, full_name, phone, status, role_id, avatar_url`,
      [fullName, phone, status, roleId, avatarUrl, req.params.id]
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
      `UPDATE users SET is_deleted=true, updated_at=NOW()
       WHERE id=$1 AND is_deleted=false RETURNING id`,
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

