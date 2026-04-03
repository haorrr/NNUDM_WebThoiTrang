let jwt = require('jsonwebtoken');

let checkLogin = async function (req, res, next) {
  try {
    let token = null;

    if (req.headers.authorization) {
      let parts = req.headers.authorization.split(' ');
      if (parts.length === 2 && parts[0] === 'Bearer') {
        token = parts[1];
      }
    }

    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).send({ message: 'ban chua dang nhap' });
    }

    let decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).send({ message: 'token khong hop le hoac da het han' });
  }
};

let checkRole = function (...roles) {
  return async function (req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).send({ message: 'ban chua dang nhap' });
      }

      let pool = require('../db/index');
      let result = await pool.query(
        'SELECT r.name FROM roles r JOIN users u ON u.role_id=r.id WHERE u.id=$1 AND u.is_deleted=false',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(403).send({ message: 'khong co quyen truy cap' });
      }

      let roleName = result.rows[0].name;
      if (!roles.includes(roleName)) {
        return res.status(403).send({ message: 'khong co quyen truy cap' });
      }

      next();
    } catch (err) {
      res.status(403).send({ message: err.message });
    }
  };
};

module.exports = {
  checkLogin: checkLogin,
  checkRole: checkRole
};

