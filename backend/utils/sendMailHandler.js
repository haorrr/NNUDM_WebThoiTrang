let nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

let sendMail = async function (to, url) {
  await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: to,
    subject: 'Reset mat khau',
    text: 'Click vao link de reset mat khau: ' + url,
    html: '<p>Click vao link de reset mat khau: <a href="' + url + '">' + url + '</a></p>'
  });
};

module.exports = {
  sendMail: sendMail
};

