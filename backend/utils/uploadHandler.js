let multer = require('multer');
let path = require('path');

let storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    let ext = path.extname(file.originalname);
    let fileName = Date.now() + '-' + Math.round(Math.random() * 1000000000) + ext;
    cb(null, fileName);
  }
});

let uploadImage = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    let ext = path.extname(file.originalname).toLowerCase();
    let allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('chi cho phep file anh'));
    }
  }
});

module.exports = {
  uploadImage: uploadImage
};

