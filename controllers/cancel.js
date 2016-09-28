var express = require('express');
var token = require('../helpers/token');
var router = express();

function getCancel(req, res) {
  var client_secret = process.env.CLIENT_SECRET || req.webtaskContext.data.client_secret;
  var connectionString = process.env.MONGO_CONNECTION || req.webtaskContext.data.mongo_connection;
  var secret = new Buffer(client_secret, 'base64');

  token.verify(req.query.token, secret, connectionString).then(function (decoded) {
    return token.revoke(decoded, connectionString);
  }).then(function () {
    res.render('cancel');
    res.end();
  }).catch(function (err) {
    res.status(500).send('Error.').end();
  });
}

router.get('/cancel', getCancel);

module.exports = router;
