var express = require('express');
var glob = require('glob');
var bodyParser = require('body-parser');

var app = express();

var controllerFiles  =  glob.sync('./controllers/*.js');

var controllers = [];
controllerFiles.forEach(function (file) {
  controllers.push(require(file));
});

app.use(bodyParser.urlencoded({ extended: false }));

app.use('/', controllers);
app.set('view engine', 'ejs');

app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  console.log(err);
  res.status(err.status || 500).send("Oh no!  This is pretty embarrassing").end();
});

module.exports = app;
