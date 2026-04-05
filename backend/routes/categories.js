var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let slugify = require('slugify');
let { checkLogin, checkRole } = require('../utils/authHandler');

router.get('/', async function (req, res, next) {
  let data = await pool.query(
    `WITH RECURSIVE category_tree AS (
       SELECT c0.id as root_id, c0.id as node_id
       FROM categories c0
       WHERE c0.is_deleted=false
       UNION ALL
       SELECT ct.root_id, c1.id as node_id
       FROM category_tree ct
       JOIN categories c1 ON c1.parent_id=ct.node_id
       WHERE c1.is_deleted=false
     ),
     product_count_by_root AS (
       SELECT ct.root_id, COUNT(pr.id)::int as product_count
       FROM category_tree ct
       LEFT JOIN products pr
         ON pr.category_id=ct.node_id AND pr.is_deleted=false
       GROUP BY ct.root_id
     )
     SELECT c.*, p.name as parent_name, COALESCE(pc.product_count, 0) as product_count
     FROM categories c
     LEFT JOIN categories p ON p.id=c.parent_id
     LEFT JOIN product_count_by_root pc ON pc.root_id=c.id
     WHERE c.is_deleted=false
     ORDER BY c.id`
  );
  res.send(data.rows);
});

router.get('/:id', async function (req, res, next) {
  try {
    let result = await pool.query(
      `WITH RECURSIVE subtree AS (
         SELECT id
         FROM categories
         WHERE id=$1 AND is_deleted=false
         UNION ALL
         SELECT c1.id
         FROM categories c1
         JOIN subtree s ON c1.parent_id=s.id
         WHERE c1.is_deleted=false
       ),
       cnt AS (
         SELECT COUNT(pr.id)::int as product_count
         FROM subtree s
         LEFT JOIN products pr ON pr.category_id=s.id AND pr.is_deleted=false
       )
       SELECT c.*, p.name as parent_name, cnt.product_count
       FROM categories c
       LEFT JOIN categories p ON p.id=c.parent_id
       CROSS JOIN cnt
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
    let { name, slug, imageUrl, parentId, status } = req.body;
    if (!name) {
      return res.status(400).send({ message: 'name la bat buoc' });
    }

    let nextSlug = slug
      ? slugify(slug, { replacement: '-', locale: 'vi', trim: true, lower: true })
      : slugify(name, { replacement: '-', locale: 'vi', trim: true, lower: true });
    if (!nextSlug) {
      return res.status(400).send({ message: 'slug khong hop le' });
    }
    await pool.query(
      `UPDATE categories
       SET slug = slug || '-deleted-' || id::text, updated_at=NOW()
       WHERE slug=$1 AND is_deleted=true`,
      [nextSlug]
    );
    if (parentId) {
      let parent = await pool.query('SELECT id FROM categories WHERE id=$1 AND is_deleted=false', [parentId]);
      if (parent.rows.length === 0) {
        return res.status(400).send({ message: 'danh muc cha khong ton tai' });
      }
    }
    let duplicated = await pool.query(
      'SELECT id FROM categories WHERE slug=$1 AND is_deleted=false LIMIT 1',
      [nextSlug]
    );
    if (duplicated.rows.length > 0) {
      return res.status(400).send({ message: 'slug da ton tai' });
    }

    let result = await pool.query(
      `INSERT INTO categories (name, slug, image_url, parent_id, status)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, nextSlug, imageUrl || '', parentId || null, status || 'ACTIVE']
    );
    res.send(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).send({ message: 'slug da ton tai' });
    }
    res.status(400).send({ message: err.message });
  }
});

router.put('/:id', checkLogin, checkRole('ADMIN'), async function (req, res, next) {
  try {
    let id = Number(req.params.id);
    let { name, slug, imageUrl, parentId, status } = req.body;
    let nextSlug = null;
    if (slug) {
      nextSlug = slugify(slug, { replacement: '-', locale: 'vi', trim: true, lower: true });
    } else if (name) {
      nextSlug = slugify(name, { replacement: '-', locale: 'vi', trim: true, lower: true });
    }
    if (nextSlug === '') {
      return res.status(400).send({ message: 'slug khong hop le' });
    }
    if (parentId && Number(parentId) === id) {
      return res.status(400).send({ message: 'parentId khong hop le' });
    }
    if (parentId) {
      let parent = await pool.query('SELECT id FROM categories WHERE id=$1 AND is_deleted=false', [parentId]);
      if (parent.rows.length === 0) {
        return res.status(400).send({ message: 'danh muc cha khong ton tai' });
      }
    }
    if (nextSlug) {
      await pool.query(
        `UPDATE categories
         SET slug = slug || '-deleted-' || id::text, updated_at=NOW()
         WHERE slug=$1 AND is_deleted=true`,
        [nextSlug]
      );
      let duplicated = await pool.query(
        'SELECT id FROM categories WHERE slug=$1 AND id<>$2 AND is_deleted=false LIMIT 1',
        [nextSlug, id]
      );
      if (duplicated.rows.length > 0) {
        return res.status(400).send({ message: 'slug da ton tai' });
      }
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
      [name, nextSlug, imageUrl, parentId, status, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).send({ message: 'id not found' });
    }
    res.send(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).send({ message: 'slug da ton tai' });
    }
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
