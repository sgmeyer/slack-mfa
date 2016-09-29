var express = require('express');
var uuid = require('uuid');
var token = require('../helpers/token');
var mfa = require('../helpers/mfa');
var view = require('../views/enroll');
var router = express();

function getEnroll(req, res) {
  var connectionString = process.env.MONGO_CONNECTION || req.webtaskContext.data.mongo_connection;
  var client_secret = process.env.CLIENT_SECRET || req.webtaskContext.data.client_secret;
  var secret = new Buffer(client_secret, 'base64');

  var decodedToken;

  token.verify(req.query.token, secret, connectionString).then(function (decoded) {
    decodedToken = decoded;
    return token.revoke(decodedToken, connectionString);
  }).then(function () {
    return createToken(secret, decodedToken.sub, decodedToken.aud, decodedToken.slack_username, connectionString);
  }).then(function (signedToken) {
    res.end(require('ejs').render(view(), {
      token: signedToken,
      slack_username: decodedToken.slack_username
    }));
  }).catch(function (err) {
    console.log(err);
    res.status(500).send('Error.').end();
  });
}

function postEnroll(req, res) {
  var connectionString = process.env.MONGO_CONNECTION || req.webtaskContext.data.mongo_connection;
  var client_secret = process.env.CLIENT_SECRET || req.webtaskContext.data.client_secret;
  var secret = new Buffer(client_secret, 'base64');

  var decodedToken;

  token.verify(req.body.token, secret, connectionString).then(function (decoded) {
    if (decoded.slack_enrolled) { throw new Error('The user has already enrolled.') }

    decodedToken = decoded;
    return token.revoke(decodedToken, connectionString);
  }).then(function () {
    var userApiOptions = {
      apiDomain: process.env.AUTH0_DOMAIN || req.webtaskContext.data.auth0_domain,
      apiToken: process.env.AUTH0_API_TOKEN || req.webtaskContext.data.auth0_api_token,
      userId: decodedToken.sub,
      slack_username: req.body.slack_username
    }

    return mfa.enroll(userApiOptions);
  }).then(function () {
    return createToken(secret, decodedToken.sub, decodedToken.aud, req.body.slack_username, connectionString);
  }).then(function (signedToken) {
    res.writeHead(302, {Location: 'mfa?token=' + signedToken});
    res.end();
  }).catch(function (err) {
    console.log(err + '\r\n' + err.stack);
    res.status(500).send('Error.').end();
  });
}

function createToken(secret, sub, aud, slack_username, connectionString) {
  var options = { expiresIn: '5m' };
  var payload = {
    sub: sub,
    aud: aud,
    jti: uuid.v4(),
    iat: new Date().getTime() / 1000,
    issuer: 'urn:sgmeyer:slack:mfa',
    slack_username: slack_username,
    slack_enrolled: false
  };

  return token.issue(payload, secret, options, connectionString);
}

router.get('/enroll', getEnroll);
router.post('/enroll', postEnroll);

module.exports = router;
