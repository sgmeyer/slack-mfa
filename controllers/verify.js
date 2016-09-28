var express = require('express');
var uuid = require('uuid');
var mfa = require('../helpers/mfa');
var token = require('../helpers/token');
var router = express();

function getVerify(req, res) {
  var client_secret = process.env.CLIENT_SECRET || req.webtaskContext.data.client_secret;
  var connectionString = process.env.MONGO_CONNECTION || req.webtaskContext.data.mongo_connection;
  var secret = new Buffer(client_secret, 'base64');
  var decodedToken;

  token.verify(req.query.token, secret, connectionString).then(function (decoded) {
    console.log('Decoding: ' + JSON.stringify(decoded));
    if (decoded.iss !== 'urn:sgmeyer:slack:mfaverify') {
      throw new Error('Invalid issuer.');
    }

    decodedToken = decoded;
    return token.revoke(decoded.jti, connectionString);
  }).then(function () {
    var userApiOptions = {
      apiDomain: process.env.AUTH0_DOMAIN || request.webtaskContext.data.auth0_domain,
      apiToken: process.env.AUTH0_API_TOKEN || request.webtaskContext.data.auth0_api_token,
      userId: decodedToken.sub
    }
    return mfa.verify(userApiOptions)
  }).then(function () {
    return createCallbackToken(secret, decodedToken.sub, decodedToken.aud, connectionString);
  }).then(function (signedToken) {
    var callbackDomain = process.env.AUTH0_DOMAIN || request.webtaskContext.data.auth0_domain;
    res.writeHead(302, { Location: 'https://' + callbackDomain + '/continue?id_token=' + signedToken });
    res.end();
  }).catch(function (err) {
    console.log(err);
    return res.status(500).send('Error.').end();
  });
}

function createCallbackToken(secret, sub, aud, connectionString) {
  var options = { expiresIn: '1m' };
  var payload = {
    sub: sub,
    aud: aud,
    jti: uuid.v4(),
    iat: new Date().getTime() / 1000,
    iss: 'urn:sgmeyer:slack:mfaverify'
  };

  return token.issue(payload, secret, options, connectionString);
}

router.get('/verify', getVerify);

module.exports = router;
