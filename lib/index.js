var express = require('express');
var bodyParser = require('body-parser');

var cancel = require('../controllers/cancel');
var enroll = require('../controllers/enroll');
var mfa = require('../controllers/mfa');
var verify = require('../controllers/verify');

var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use('/', [cancel, enroll, mfa, verify]);

app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  console.log(err);
  res.status(err.status || 500).send("Oh no!\r\n\r\n" + err).end();
});

module.exports = app;
