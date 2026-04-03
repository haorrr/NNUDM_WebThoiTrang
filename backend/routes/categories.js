var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let slugify = require('slugify');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.get('/', async function (req, res, next) {
  let data = await pool.query(
    `SELECT c.*, p.name as parent_name
     FROM categories c LEFT JOIN categories p ON p.id=c.parent_id
     WHERE c.is_deleted=false ORDER BY c.id`
  );
  res.send(data.rows);
});

router.get('/:id', async function (req, res, next) {
  try {
    let result = await pool.query(
      `SELECT c.*, p.name as parent_name
       FROM categories c LEFT JOIN categories p ON p.id=c.parent_id
       WHERE c.id=$1 AND c.is_deleted=false`,
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
    let { name, imageUrl, parentId, status } = req.body;
    if (!name) {
      return res.status(400).send({ message: 'name la bat buoc' });
    }

    let slug = slugify(name, { replacement: '-', locale: 'vi', trim: true, lower: true });
    let result = await pool.query(
      `INSERT INTO categories (name, slug, image_url, parent_id, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, slug, imageUrl || '', parentId || null, status || 'ACTIVE']
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { name, imageUrl, parentId, status } = req.body;
    let slug = null;
    if (name) {
      slug = slugify(name, { replacement: '-', locale: 'vi', trim: true, lower: true });
    }

    let result = await pool.query(
      `UPDATE categories
       SET name=COALESCE($1, name),
           slug=COALESCE($2, slug),
           image_url=COALESCE($3, image_url),
           parent_id=COALESCE($4, parent_id),
           status=COALESCE($5, status),
           updated_at=NOW()
       WHERE id=$6 AND is_deleted=false RETURNING *`,
      [name, slug, imageUrl, parentId, status, req.params.id]
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
      'UPDATE categories SET is_deleted=true, updated_at=NOW() WHERE id=$1 AND is_deleted=false RETURNING id',
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

