var express = require('express');
var router = express.Router();
let pool = require('../db/index');
let usersController = require('../controllers/users');
let { checkLogin } = require('../utils/authHandler');
let { sendMail } = require('../utils/sendMailHandler');
let bcrypt = require('bcrypt');
let jwt = require('jsonwebtoken');
let crypto = require('crypto');
let {
  changePasswordValidator,
  resetPasswordValidator,
  validateResult
} = require('../utils/validatorHandler');

router.post('/register', async function (req, res, next) {
  try {
    let { username, password, email, fullName, phone } = req.body;
    if (!username || !password || !email) {
      return res.status(400).send({ message: 'username, password, email la bat buoc' });
    }

    let existUser = await usersController.FindUserByEmail(email);
    if (existUser) {
      return res.status(400).send({ message: 'email da ton tai' });
    }

    let existUsername = await pool.query(
      'SELECT id FROM users WHERE username=$1 AND is_deleted=false',
      [username]
    );
    if (existUsername.rows.length > 0) {
      return res.status(400).send({ message: 'username da ton tai' });
    }

    let hashedPassword = bcrypt.hashSync(password, 10);
    let newUser = await usersController.CreateAnUser(
      username,
      hashedPassword,
      email,
      fullName || '',
      phone || ''
    );

    await pool.query(
      'INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
      [newUser.id]
    );

    res.send(newUser);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/login', async function (req, res, next) {
  try {
    let { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).send({ message: 'username va password la bat buoc' });
    }

    let user = await usersController.QueryByUserNameAndPassword(username);
    if (!user) {
      return res.status(404).send({ message: 'tai khoan khong ton tai' });
    }
    if (user.status === 'BLOCKED') {
      return res.status(400).send({ message: 'tai khoan da bi khoa' });
    }

    let isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(400).send({ message: 'mat khau khong dung' });
    }

    await pool.query(
      'UPDATE users SET login_count=login_count+1, updated_at=NOW() WHERE id=$1',
      [user.id]
    );

    let token = jwt.sign(
      { id: user.id, username: user.username, roleId: user.role_id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1h' }
    );

    res.cookie('token', token, {
      maxAge: 60 * 60 * 1000,
      httpOnly: true
    });

    res.send({
      token: token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        avatarUrl: user.avatar_url,
        roleId: user.role_id
      }
    });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/logout', checkLogin, async function (req, res, next) {
  res.cookie('token', null, {
    maxAge: 0,
    httpOnly: true
  });
  res.send({ message: 'da logout' });
});

router.get('/profile', checkLogin, async function (req, res, next) {
  try {
    let user = await usersController.FindUserById(req.user.id);
    if (!user) {
      return res.status(404).send({ message: 'id not found' });
    }
    let { password, forgot_password_token, forgot_password_token_exp, ...safeUser } = user;
    res.send(safeUser);
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/forgot-password', async function (req, res, next) {
  try {
    let email = req.body.email;
    if (!email) {
      return res.status(400).send({ message: 'email la bat buoc' });
    }

    let user = await usersController.FindUserByEmail(email);
    if (!user) {
      return res.status(404).send({ message: 'email khong ton tai' });
    }

    let token = crypto.randomBytes(32).toString('hex');
    let exp = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      'UPDATE users SET forgot_password_token=$1, forgot_password_token_exp=$2, updated_at=NOW() WHERE id=$3',
      [token, exp, user.id]
    );

    let resetUrl = (process.env.FRONTEND_URL || 'http://localhost:5500') + '/reset-password?token=' + token;
    await sendMail(email, resetUrl);

    res.send({ message: 'email reset password da duoc gui' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.post('/reset-password', resetPasswordValidator, validateResult, async function (req, res, next) {
  try {
    let { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).send({ message: 'token va newPassword la bat buoc' });
    }

    let user = await usersController.FindUserByToken(token);
    if (!user) {
      return res.status(404).send({ message: 'token khong hop le' });
    }
    if (new Date() > new Date(user.forgot_password_token_exp)) {
      return res.status(400).send({ message: 'token da het han' });
    }

    let hashedPassword = bcrypt.hashSync(newPassword, 10);
    await pool.query(
      'UPDATE users SET password=$1, forgot_password_token=NULL, forgot_password_token_exp=NULL, updated_at=NOW() WHERE id=$2',
      [hashedPassword, user.id]
    );

    res.send({ message: 'dat lai mat khau thanh cong' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

router.put('/change-password', checkLogin, changePasswordValidator, validateResult, async function (req, res, next) {
  try {
    let { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).send({ message: 'oldPassword va newPassword la bat buoc' });
    }

    let user = await usersController.FindUserById(req.user.id);
    if (!user) {
      return res.status(404).send({ message: 'id not found' });
    }

    let isMatch = bcrypt.compareSync(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).send({ message: 'mat khau cu khong dung' });
    }

    let hashedPassword = bcrypt.hashSync(newPassword, 10);
    await pool.query(
      'UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2',
      [hashedPassword, user.id]
    );

    res.send({ message: 'doi mat khau thanh cong' });
  } catch (err) {
    res.status(400).send({ message: err.message });
  }
});

module.exports = router;

