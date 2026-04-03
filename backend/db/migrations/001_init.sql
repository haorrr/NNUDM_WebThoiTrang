CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  is_deleted  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
INSERT INTO roles (name) VALUES ('ADMIN'), ('USER');

CREATE TABLE users (
  id                        SERIAL PRIMARY KEY,
  username                  VARCHAR(100) UNIQUE NOT NULL,
  password                  VARCHAR(255) NOT NULL,
  email                     VARCHAR(150) UNIQUE NOT NULL,
  full_name                 VARCHAR(200) DEFAULT '',
  avatar_url                TEXT DEFAULT 'https://i.sstatic.net/l60Hf.png',
  phone                     VARCHAR(20) DEFAULT '',
  role_id                   INT REFERENCES roles(id) DEFAULT 2,
  status                    VARCHAR(20) DEFAULT 'ACTIVE',
  login_count               INT DEFAULT 0,
  is_deleted                BOOLEAN DEFAULT FALSE,
  forgot_password_token     VARCHAR(255),
  forgot_password_token_exp TIMESTAMP,
  created_at                TIMESTAMP DEFAULT NOW(),
  updated_at                TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(200) NOT NULL,
  slug        VARCHAR(200) UNIQUE NOT NULL,
  image_url   TEXT DEFAULT '',
  parent_id   INT REFERENCES categories(id),
  status      VARCHAR(20) DEFAULT 'ACTIVE',
  is_deleted  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE products (
  id          SERIAL PRIMARY KEY,
  title       VARCHAR(300) NOT NULL,
  slug        VARCHAR(300) UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  price       NUMERIC(15,2) DEFAULT 0,
  sale_price  NUMERIC(15,2),
  category_id INT REFERENCES categories(id),
  status      VARCHAR(20) DEFAULT 'ACTIVE',
  is_deleted  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_images (
  id          SERIAL PRIMARY KEY,
  product_id  INT REFERENCES products(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  is_primary  BOOLEAN DEFAULT FALSE,
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE product_variants (
  id               SERIAL PRIMARY KEY,
  product_id       INT REFERENCES products(id) ON DELETE CASCADE,
  size             VARCHAR(50) DEFAULT '',
  color            VARCHAR(100) DEFAULT '',
  color_code       VARCHAR(20) DEFAULT '',
  sku              VARCHAR(100) UNIQUE,
  stock            INT DEFAULT 0,
  price_adjustment NUMERIC(15,2) DEFAULT 0,
  is_deleted       BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(product_id, size, color)
);

CREATE TABLE inventories (
  id          SERIAL PRIMARY KEY,
  product_id  INT REFERENCES products(id) UNIQUE NOT NULL,
  stock       INT DEFAULT 0,
  reserved    INT DEFAULT 0,
  sold_count  INT DEFAULT 0,
  updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE carts (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cart_items (
  id         SERIAL PRIMARY KEY,
  cart_id    INT REFERENCES carts(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id),
  variant_id INT REFERENCES product_variants(id),
  quantity   INT DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(cart_id, product_id, variant_id)
);

CREATE TABLE coupons (
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

CREATE TABLE orders (
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

CREATE TABLE order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INT REFERENCES orders(id) ON DELETE CASCADE,
  product_id   INT REFERENCES products(id),
  variant_id   INT REFERENCES product_variants(id),
  product_title VARCHAR(300),
  variant_info VARCHAR(200),
  price        NUMERIC(15,2) NOT NULL,
  quantity     INT NOT NULL,
  subtotal     NUMERIC(15,2) NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
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
