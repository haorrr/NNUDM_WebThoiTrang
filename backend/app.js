var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');
require('dotenv').config();
require('./db/index');

var app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/v1', function (req, res, next) {
  res.send({ message: 'fashion backend running' });
});

app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/roles', require('./routes/roles'));
app.use('/api/v1/categories', require('./routes/categories'));
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/products/:productId/variants', require('./routes/product_variants'));
app.use('/api/v1/products/:productId/images', require('./routes/product_images'));
app.use('/api/v1/inventories', require('./routes/inventories'));
app.use('/api/v1/carts', require('./routes/carts'));
app.use('/api/v1/orders', require('./routes/orders'));
app.use('/api/v1/payments', require('./routes/payments'));

app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.send({ message: err.message });
});

module.exports = app;
