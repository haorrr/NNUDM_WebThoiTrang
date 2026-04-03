var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.get('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  let data = await pool.query('SELECT * FROM roles WHERE is_deleted=false ORDER BY id');
  res.send(data.rows);
});

router.get('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'SELECT * FROM roles WHERE id=$1 AND is_deleted=false',
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

router.post('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { name, description } = req.body;
    if (!name) {
      return res.status(400).send({ message: 'name la bat buoc' });
    }
    let result = await pool.query(
      'INSERT INTO roles (name, description) VALUES ($1, $2) RETURNING *',
      [name, description || '']
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { name, description } = req.body;
    let result = await pool.query(
      `UPDATE roles SET name=COALESCE($1, name), description=COALESCE($2, description), updated_at=NOW()
       WHERE id=$3 AND is_deleted=false RETURNING *`,
      [name, description, req.params.id]
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
      'UPDATE roles SET is_deleted=true, updated_at=NOW() WHERE id=$1 AND is_deleted=false RETURNING id',
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

