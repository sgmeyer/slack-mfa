var express = require('express');
var uuid = require('uuid');
var token = require('../helpers/token');
var mfa = require('../helpers/mfa');
var router = express();

function getEnroll(req, res) {
  var connectionString = process.env.MONGO_CONNECTION || req.webtaskContext.data.mongo_connection;
  var client_secret = process.env.CLIENT_SECRET || req.webtaskContext.data.client_secret;
  var secret = new Buffer(client_secret, 'base64');

  var decodedToken;

  token.verify(req.query.token, secret, connectionString).then(function (decoded) {
    decodedToken = decoded;
    return token.revoke(decodedToken.jti, connectionString);
  }).then(function () {
    return createToken(secret, decodedToken.sub, decodedToken.aud, decodedToken.slack_username, connectionString);
  }).then(function (signedToken) {
    res.render('enroll', {
      token: signedToken,
      slack_username: decodedToken.slack_username
    });
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

  token.verify(req.query.token, secret, connectionString).then(function (decoded) {
    if (!slack_username) { throw new Error('A Slack username must be provided.'); }
    if (decoded.slack_enrolled) { throw new Error('The user has already enrolled.') }

    decodedToken = decoded;
    return token.revoke(decodedToken.jti, connectionString);
  }).then(function () {
    var userApiOptions = {
      apiDomain: process.env.AUTH0_DOMAIN || request.webtaskContext.data.auth0_domain,
      apiToken: process.env.AUTH0_API_TOKEN || request.webtaskContext.data.auth0_api_token,
      userId: decodedToken.sub
    }

    return mfa.enroll(userApiOptions);
  }).then(function () {
    return createToken(secret, decodedToken.sub, decodedToken.aud, decodedToken.slack_username, connectionString);
  }).then(function (signedToken) {

  }).catch(function (err) {
    console.log(err);
    res.status(500).send('Error.').end();
  });
}

function createToken(secret, sub, aud, slack_username, connectionString) {
  var payload = {
    sub: sub,
    aud: aud,
    jti: uuid.v4(),
    iat: new Date().getTime() / 1000,
    slack_username: slack_username,
    slack_enrolled: false
  };

  var options = {
    expiresIn: '5m',
    issuer: 'urn:sgmeyer:slack:mfa'
  };

  return token.issue(payload, secret, options, connectionString);
}

router.get('/enroll', getEnroll);
router.post('/enroll', postEnroll);

module.exports = router;
