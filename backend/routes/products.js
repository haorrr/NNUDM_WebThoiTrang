var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let slugify = require('slugify');
let { checkLogin, checkRole } = require('../utils/authHandler');
let productController = require('../controllers/products');

router.get('/', async function (req, res, next) {
  try {
    let { title, categoryId, minPrice, maxPrice, status, inStock, page, limit } = req.query;
    page = page ? parseInt(page) : 1;
    limit = limit ? parseInt(limit) : 10;
    let offset = (page - 1) * limit;

    let conditions = ['p.is_deleted=false'];
    let params = [];
    let idx = 1;

    if (title) {
      conditions.push('p.title ILIKE $' + idx);
      params.push('%' + title + '%');
      idx++;
    }
    if (categoryId) {
      conditions.push('p.category_id=$' + idx);
      params.push(categoryId);
      idx++;
    }
    if (minPrice) {
      conditions.push('p.price>=$' + idx);
      params.push(minPrice);
      idx++;
    }
    if (maxPrice) {
      conditions.push('p.price<=$' + idx);
      params.push(maxPrice);
      idx++;
    }
    if (status) {
      conditions.push('p.status=$' + idx);
      params.push(status);
      idx++;
    }
    if (String(inStock || '').toLowerCase() === 'true') {
      conditions.push('COALESCE(i.stock, 0) > 0');
    }

    let where = conditions.join(' AND ');
    let result = await pool.query(
      `SELECT p.*, c.name as category_name,
              CASE WHEN COALESCE(v.cnt, 0) > 0 THEN COALESCE(v.total, 0) ELSE COALESCE(i.stock, 0) END as stock,
              (SELECT url FROM product_images WHERE product_id=p.id AND is_primary=true LIMIT 1) as primary_image
       FROM products p
       LEFT JOIN categories c ON c.id=p.category_id
       LEFT JOIN inventories i ON i.product_id=p.id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int as cnt, COALESCE(SUM(pv.stock), 0)::int as total
         FROM product_variants pv
         WHERE pv.product_id=p.id AND pv.is_deleted=false
       ) v ON true
       WHERE ${where}
       ORDER BY p.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    );
    res.send(result.rows);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.get('/:id', async function (req, res, next) {
  try {
    let result = await productController.FindProductById(req.params.id);
    if (!result) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result);
  } catch (err) {
    res.status(404).send({ message: 'id not found' });
  }
});

router.post('/', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { title, description, price, salePrice, categoryId, status, stock } = req.body;
    if (!title) {
      return res.status(400).send({ message: 'title la bat buoc' });
    }

    let slug = slugify(title, { replacement: '-', locale: 'vi', trim: true, lower: true });
    let result = await pool.query(
      `INSERT INTO products (title, slug, description, price, sale_price, category_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, slug, description || '', price || 0, salePrice || null, categoryId || null, status || 'ACTIVE']
    );

    let product = result.rows[0];
    await pool.query(
      'INSERT INTO inventories (product_id, stock) VALUES ($1, $2)',
      [product.id, Number(stock || 0)]
    );
    res.send(product);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let { title, description, price, salePrice, categoryId, status, stock } = req.body;
    let slug = null;
    if (title) {
      slug = slugify(title, { replacement: '-', locale: 'vi', trim: true, lower: true });
    }

    let result = await pool.query(
      `UPDATE products
       SET title=COALESCE($1, title),
           slug=COALESCE($2, slug),
           description=COALESCE($3, description),
           price=COALESCE($4, price),
           sale_price=COALESCE($5, sale_price),
           category_id=COALESCE($6, category_id),
           status=COALESCE($7, status),
           updated_at=NOW()
       WHERE id=$8 AND is_deleted=false RETURNING *`,
      [title, slug, description, price, salePrice, categoryId, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    if (stock !== undefined && stock !== null && stock !== '') {
      await pool.query(
        'UPDATE inventories SET stock=$1, updated_at=NOW() WHERE product_id=$2',
        [Number(stock), req.params.id]
      );
    }
    res.send(result.rows[0]);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.delete('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let result = await pool.query(
      'UPDATE products SET is_deleted=true, updated_at=NOW() WHERE id=$1 AND is_deleted=false RETURNING id',
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
