let pool = require('../db/index');

let CreateAnUser = async function (username, password, email, fullName, phone) {
  let result = await pool.query(
    `INSERT INTO users (username, password, email, full_name, phone, role_id, status, login_count, is_deleted, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, 2, 'ACTIVE', 0, false, NOW(), NOW())
     RETURNING id, username, email, full_name, avatar_url, phone, role_id, status, created_at`,
    [username, password, email, fullName, phone]
  );
  return result.rows[0];
};

let FindUserById = async function (id) {
  let result = await pool.query(
    'SELECT * FROM users WHERE id=$1 AND is_deleted=false',
    [id]
  );
  return result.rows[0] || null;
};

let FindUserByEmail = async function (email) {
  let result = await pool.query(
    'SELECT * FROM users WHERE email=$1 AND is_deleted=false',
    [email]
  );
  return result.rows[0] || null;
};

let FindUserByToken = async function (token) {
  let result = await pool.query(
    'SELECT * FROM users WHERE forgot_password_token=$1 AND is_deleted=false',
    [token]
  );
  return result.rows[0] || null;
};

let QueryByUserNameAndPassword = async function (username) {
  let result = await pool.query(
    'SELECT * FROM users WHERE username=$1 AND is_deleted=false',
    [username]
  );
  return result.rows[0] || null;
};

module.exports = {
  CreateAnUser: CreateAnUser,
  FindUserById: FindUserById,
  FindUserByEmail: FindUserByEmail,
  FindUserByToken: FindUserByToken,
  QueryByUserNameAndPassword: QueryByUserNameAndPassword
};

