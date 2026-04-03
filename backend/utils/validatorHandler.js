let { body, validationResult } = require('express-validator');

let changePasswordValidator = [
  body('oldPassword').notEmpty().withMessage('oldPassword la bat buoc'),
  body('newPassword').isLength({ min: 6 }).withMessage('newPassword toi thieu 6 ky tu')
];

let resetPasswordValidator = [
  body('newPassword').isLength({ min: 6 }).withMessage('newPassword toi thieu 6 ky tu')
];

let validateResult = function (req, res, next) {
  let errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).send({ message: errors.array()[0].msg });
  }
  next();
};

module.exports = {
  changePasswordValidator: changePasswordValidator,
  resetPasswordValidator: resetPasswordValidator,
  validateResult: validateResult
};

