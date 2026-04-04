var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');
let { uploadImage } = require('../utils/uploadHandler');

router.get('/product/:productId', async function (req, res, next) {
  try {
    let result = await pool.query(
      `SELECT r.*, u.username, u.avatar_url,
              json_agg(ri.url) FILTER (WHERE ri.id IS NOT NULL) as images
       FROM reviews r
       JOIN users u ON u.id=r.user_id
       LEFT JOIN review_images ri ON ri.review_id=r.id
       WHERE r.product_id=$1 AND r.status='APPROVED' AND r.is_deleted=false
       GROUP BY r.id, u.username, u.avatar_url
       ORDER BY r.created_at DESC`,
      [req.params.productId]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/admin/pending', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let status = req.query.status;
    let params = [];
    let where = `r.is_deleted=false`;
    if (status) {
      params.push(status);
      where += ` AND r.status=$1`;
    }

    let result = await pool.query(
      `SELECT r.*, u.username, p.title as product_title,
              json_agg(ri.url) FILTER (WHERE ri.id IS NOT NULL) as images
       FROM reviews r
       JOIN users u ON u.id=r.user_id
       JOIN products p ON p.id=r.product_id
       LEFT JOIN review_images ri ON ri.review_id=r.id
       WHERE ${where}
       GROUP BY r.id, u.username, p.title
       ORDER BY r.created_at DESC`,
      params
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/my', checkLogin, async function (req, res, next) {
  try {
    let result = await pool.query(
      `SELECT r.*, p.title as product_title
       FROM reviews r JOIN products p ON p.id=r.product_id
       WHERE r.user_id=$1 AND r.is_deleted=false ORDER BY r.created_at DESC`,
      [req.user.id]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/', checkLogin, async function (req, res, next) {
  try {
    let { productId, rating, comment } = req.body;
    if (!productId || !rating) {
      return res.status(400).send({ message: 'productId va rating la bat buoc' });
    }
    let exist = await pool.query(
      'SELECT id FROM reviews WHERE user_id=$1 AND product_id=$2 AND is_deleted=false',
      [req.user.id, productId]
    );
    if (exist.rows.length > 0) {
      return res.status(400).send({ message: 'ban da review san pham nay roi' });
    }
    let result = await pool.query(
      `INSERT INTO reviews (user_id, product_id, rating, comment)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.user.id, productId, rating, comment || '']
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id', checkLogin, async function (req, res, next) {
  try {
    let { rating, comment } = req.body;
    let result = await pool.query(
      `UPDATE reviews SET rating=COALESCE($1, rating), comment=COALESCE($2, comment),
       status='PENDING', updated_at=NOW()
       WHERE id=$3 AND user_id=$4 AND is_deleted=false RETURNING *`,
      [rating, comment, req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/:id', checkLogin, async function (req, res, next) {
  try {
    let result = await pool.query(
      'UPDATE reviews SET is_deleted=true, updated_at=NOW() WHERE id=$1 AND user_id=$2 AND is_deleted=false RETURNING id',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send({ message: 'xoa thanh cong' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/:id/images', checkLogin, uploadImage.array('images', 5), async function (req, res, next) {
  try {
    let review = await pool.query(
      'SELECT id FROM reviews WHERE id=$1 AND user_id=$2 AND is_deleted=false',
      [req.params.id, req.user.id]
    );
    if (review.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    let inserted = [];
    for (let file of req.files) {
      let url = '/uploads/' + file.filename;
      let r = await pool.query(
        'INSERT INTO review_images (review_id, url) VALUES ($1,$2) RETURNING *',
        [req.params.id, url]
      );
      inserted.push(r.rows[0]);
    }
    res.send(inserted);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/admin/:id/status', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { status } = req.body;
    let allowed = ['APPROVED', 'REJECTED', 'PENDING'];
    if (!allowed.includes(status)) {
      return res.status(400).send({ message: 'status khong hop le' });
    }
    let result = await pool.query(
      'UPDATE reviews SET status=$1, updated_at=NOW() WHERE id=$2 AND is_deleted=false RETURNING *',
      [status, req.params.id]
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
