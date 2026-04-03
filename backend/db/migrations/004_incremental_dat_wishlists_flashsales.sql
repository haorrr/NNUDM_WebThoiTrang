-- Incremental migration for dat plan: wishlists + flash_sales + flash_sale_products
-- Safe to run multiple times on existing database.

CREATE TABLE IF NOT EXISTS wishlists (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id),
  product_id INT REFERENCES products(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE wishlists ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS flash_sales (
  id               SERIAL PRIMARY KEY,
  title            VARCHAR(300) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL,
  starts_at        TIMESTAMP NOT NULL,
  ends_at          TIMESTAMP NOT NULL,
  status           VARCHAR(20) DEFAULT 'SCHEDULED',
  is_deleted       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'SCHEDULED';
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE flash_sales ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS flash_sale_products (
  id            SERIAL PRIMARY KEY,
  flash_sale_id INT REFERENCES flash_sales(id) ON DELETE CASCADE,
  product_id    INT REFERENCES products(id),
  stock_limit   INT DEFAULT 0,
  sold_count    INT DEFAULT 0,
  UNIQUE(flash_sale_id, product_id)
);

ALTER TABLE flash_sale_products ADD COLUMN IF NOT EXISTS sold_count INT DEFAULT 0;

