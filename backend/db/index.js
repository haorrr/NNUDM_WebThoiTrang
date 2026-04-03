let { Pool } = require('pg');
require('dotenv').config();

let pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

pool.connect(function (err) {
  if (err) {
    console.log('DB connection error:', err.message);
  } else {
    console.log('connected to PostgreSQL');
  }
});

module.exports = pool;

