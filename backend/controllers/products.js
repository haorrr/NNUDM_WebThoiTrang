let pool = require('../db/index');

let FindProductById = async function (id) {
  let result = await pool.query(
    `SELECT p.*, c.name as category_name,
            CASE WHEN COALESCE(v.cnt, 0) > 0 THEN COALESCE(v.total, 0) ELSE COALESCE(i.stock, 0) END as stock,
            fs.discount_percent as flash_discount_percent,
            fs.ends_at as flash_ends_at,
            CASE
              WHEN fs.discount_percent IS NOT NULL
              THEN ROUND((COALESCE(p.sale_price, p.price)::numeric * (100 - fs.discount_percent) / 100), 0)
              ELSE NULL
            END as flash_price,
            json_agg(DISTINCT pi.*) FILTER (WHERE pi.id IS NOT NULL) as images
     FROM products p
     LEFT JOIN categories c ON c.id=p.category_id
     LEFT JOIN inventories i ON i.product_id=p.id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int as cnt, COALESCE(SUM(pv.stock), 0)::int as total
       FROM product_variants pv
       WHERE pv.product_id=p.id AND pv.is_deleted=false
     ) v ON true
     LEFT JOIN LATERAL (
       SELECT fs1.discount_percent, fs1.ends_at
       FROM flash_sale_products fsp
       JOIN flash_sales fs1 ON fs1.id=fsp.flash_sale_id
       WHERE fsp.product_id=p.id
         AND fs1.is_deleted=false
         AND fs1.status IN ('ACTIVE', 'SCHEDULED')
         AND fs1.starts_at <= NOW()
         AND fs1.ends_at >= NOW()
       ORDER BY fs1.discount_percent DESC, fs1.ends_at ASC
       LIMIT 1
     ) fs ON true
     LEFT JOIN product_images pi ON pi.product_id=p.id
     WHERE p.id=$1 AND p.is_deleted=false
     GROUP BY p.id, c.name, i.stock, v.cnt, v.total, fs.discount_percent, fs.ends_at`,
    [id]
  );
  return result.rows[0] || null;
};

module.exports = {
  FindProductById: FindProductById
};
