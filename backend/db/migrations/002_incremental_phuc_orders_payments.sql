-- Incremental migration for phuc plan: coupons + orders + order_items + payments
-- Safe to run multiple times on existing database.

CREATE TABLE IF NOT EXISTS coupons (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(100) UNIQUE NOT NULL,
  type             VARCHAR(20) NOT NULL,
  value            NUMERIC(15,2) NOT NULL,
  min_order_amount NUMERIC(15,2) DEFAULT 0,
  max_uses         INT DEFAULT 0,
  used_count       INT DEFAULT 0,
  expires_at       TIMESTAMP,
  is_active        BOOLEAN DEFAULT TRUE,
  is_deleted       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS min_order_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS max_uses INT DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS used_count INT DEFAULT 0;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS orders (
  id               SERIAL PRIMARY KEY,
  user_id          INT REFERENCES users(id),
  status           VARCHAR(50) DEFAULT 'PENDING',
  total_amount     NUMERIC(15,2) DEFAULT 0,
  discount_amount  NUMERIC(15,2) DEFAULT 0,
  final_amount     NUMERIC(15,2) DEFAULT 0,
  coupon_code      VARCHAR(100),
  shipping_name    VARCHAR(200),
  shipping_phone   VARCHAR(20),
  shipping_address TEXT,
  notes            TEXT DEFAULT '',
  payment_method   VARCHAR(50) DEFAULT 'COD',
  payment_status   VARCHAR(50) DEFAULT 'N_A',
  is_deleted       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'PENDING';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_name VARCHAR(200);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_phone VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'COD';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'N_A';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS order_items (
  id            SERIAL PRIMARY KEY,
  order_id      INT REFERENCES orders(id) ON DELETE CASCADE,
  product_id    INT REFERENCES products(id),
  variant_id    INT REFERENCES product_variants(id),
  product_title VARCHAR(300),
  variant_info  VARCHAR(200),
  price         NUMERIC(15,2) NOT NULL,
  quantity      INT NOT NULL,
  subtotal      NUMERIC(15,2) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_info VARCHAR(200);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  user_id           INT REFERENCES users(id),
  order_id          INT REFERENCES orders(id),
  method            VARCHAR(50) DEFAULT 'cod',
  status            VARCHAR(50) DEFAULT 'pending',
  amount            NUMERIC(15,2) NOT NULL,
  transaction_id    VARCHAR(200) DEFAULT '',
  provider_response JSONB,
  paid_at           TIMESTAMP,
  note              TEXT DEFAULT '',
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

ALTER TABLE payments ADD COLUMN IF NOT EXISTS method VARCHAR(50) DEFAULT 'cod';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount NUMERIC(15,2) DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(200) DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_response JSONB;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
ALTER TABLE payments ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

