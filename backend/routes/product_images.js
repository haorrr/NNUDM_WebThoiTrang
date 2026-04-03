var express = require('express');
var router = express.Router({ mergeParams: true });
let pool = require('../db/index');
let { checkLogin, checkRole } = require('../utils/authHandler');
let { uploadImage } = require('../utils/uploadHandler');

router.get('/', async function (req, res, next) {
  try {
    let productId = req.params.productId;
    let result = await pool.query(
      'SELECT * FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC, sort_order ASC, id ASC',
      [productId]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/', checkLogin, checkRole('ADMIN'), uploadImage.array('images', 10), async function (req, res, next) {
  try {
    let productId = req.params.productId;
    let files = req.files;
    let isPrimaryReq = String(req.body.isPrimary || '').toLowerCase() === 'true';
    if (!files || files.length === 0) {
      return res.status(400).send({ message: 'khong co file duoc upload' });
    }

    let product = await pool.query(
      'SELECT id FROM products WHERE id=$1 AND is_deleted=false',
      [productId]
    );
    if (product.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }

    let hasPrimary = await pool.query(
      'SELECT id FROM product_images WHERE product_id=$1 AND is_primary=true',
      [productId]
    );

    if (isPrimaryReq) {
      await pool.query(
        'UPDATE product_images SET is_primary=false WHERE product_id=$1',
        [productId]
      );
      hasPrimary.rows = [];
    }

    let inserted = [];
    for (let i = 0; i < files.length; i++) {
      let url = '/uploads/' + files[i].filename;
      let isPrimary = hasPrimary.rows.length === 0 && i === 0;
      let result = await pool.query(
        'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
        [productId, url, isPrimary, i]
      );
      inserted.push(result.rows[0]);
    }

    let images = await pool.query(
      'SELECT * FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC, sort_order ASC, id ASC',
      [productId]
    );
    res.send(images.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/url', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let productId = req.params.productId;
    let { url, isPrimary } = req.body;
    if (!url || !/^https?:\/\//i.test(url)) {
      return res.status(400).send({ message: 'url khong hop le' });
    }

    let product = await pool.query(
      'SELECT id FROM products WHERE id=$1 AND is_deleted=false',
      [productId]
    );
    if (product.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }

    let isPrimaryReq = !!isPrimary;
    let hasPrimary = await pool.query(
      'SELECT id FROM product_images WHERE product_id=$1 AND is_primary=true',
      [productId]
    );

    if (isPrimaryReq) {
      await pool.query(
        'UPDATE product_images SET is_primary=false WHERE product_id=$1',
        [productId]
      );
      hasPrimary.rows = [];
    }

    let sortOrderResult = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 as next_sort FROM product_images WHERE product_id=$1',
      [productId]
    );
    let nextSort = sortOrderResult.rows[0].next_sort;

    await pool.query(
      'INSERT INTO product_images (product_id, url, is_primary, sort_order) VALUES ($1,$2,$3,$4)',
      [productId, url, hasPrimary.rows.length === 0, nextSort]
    );

    let images = await pool.query(
      'SELECT * FROM product_images WHERE product_id=$1 ORDER BY is_primary DESC, sort_order ASC, id ASC',
      [productId]
    );
    res.send(images.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:imageId/primary', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let imageId = req.params.imageId;
    let productId = req.params.productId;
    let img = await pool.query(
      'SELECT * FROM product_images WHERE id=$1 AND product_id=$2',
      [imageId, productId]
    );
    if (img.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }

    await pool.query(
      'UPDATE product_images SET is_primary=false WHERE product_id=$1',
      [productId]
    );
    let result = await pool.query(
      'UPDATE product_images SET is_primary=true WHERE id=$1 RETURNING *',
      [imageId]
    );
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/:imageId', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'DELETE FROM product_images WHERE id=$1 AND product_id=$2 RETURNING id',
      [req.params.imageId, req.params.productId]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send({ message: 'xoa anh thanh cong' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;
