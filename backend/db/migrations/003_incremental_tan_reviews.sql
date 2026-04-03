-- Incremental migration for tan plan: reviews + review_images
-- Safe to run multiple times on existing database.

CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL PRIMARY KEY,
  user_id     INT REFERENCES users(id),
  product_id  INT REFERENCES products(id),
  rating      INT CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT DEFAULT '',
  status      VARCHAR(20) DEFAULT 'PENDING',
  is_deleted  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reviews_user_product_unique'
  ) THEN
    ALTER TABLE reviews
    ADD CONSTRAINT reviews_user_product_unique UNIQUE (user_id, product_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS review_images (
  id         SERIAL PRIMARY KEY,
  review_id  INT REFERENCES reviews(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE review_images ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

