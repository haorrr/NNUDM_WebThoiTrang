let pool = require('../db/index');

let FindProductById = async function (id) {
  let result = await pool.query(
    `SELECT p.*, c.name as category_name, COALESCE(i.stock, 0) as stock,
            json_agg(DISTINCT pi.*) FILTER (WHERE pi.id IS NOT NULL) as images
     FROM products p
     LEFT JOIN categories c ON c.id=p.category_id
     LEFT JOIN inventories i ON i.product_id=p.id
     LEFT JOIN product_images pi ON pi.product_id=p.id
     WHERE p.id=$1 AND p.is_deleted=false
     GROUP BY p.id, c.name, i.stock`,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = {
  FindProductById: FindProductById
};
