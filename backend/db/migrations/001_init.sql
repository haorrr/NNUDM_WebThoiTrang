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

