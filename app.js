var express = require('express');
var glob = require('glob');
var bodyParser = require('body-parser');

var app = express();

var controllers = [
  require('./controllers/cancel'),
  require('./controllers/enroll'),
  require('./controllers/mfa'),
  require('./controllers/verify')
];


app.use(bodyParser.urlencoded({ extended: false }));

app.use('/', controllers);
//app.set('view engine', 'ejs');

app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  console.log('Application Error Handler: ' + err + '\r\nStack: \r\n' + err.stack);
  res.status(err.status || 500).send("Oh no!  This is pretty embarrassing").end();
});

module.exports = app;
