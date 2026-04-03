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

    res.send(inserted);
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

