var express = require('express');
var jwt = require('jsonwebtoken');
var Promise = require('bluebird');

var router = express();

var request = Promise.promisify(require('request'));

function getVerify(req, res) {
  var token = req.query.token;
  var client_secret = process.env.CLIENT_SECRET || req.webtaskContext.data.client_secret;
  var secret = new Buffer(client_secret, 'base64');

  jwt.verify(token, secret, function(err, decoded) {
    // Restricts this endpoint to the verification issuer.
    if (err || decoded.iss !== 'urn:sgmeyer:slack:mfaverify') {
      res.status(500).send('Error.' + err).end();
      return;
    }

    var userApiOptions = {
      apiDomain: process.env.AUTH0_DOMAIN || request.webtaskContext.data.auth0_domain,
      apiToken: process.env.AUTH0_API_TOKEN || request.webtaskContext.data.auth0_api_token,
      userId: decoded.sub
    }

    completeMfaEnrollment(userApiOptions).then(function () {
      var callbackToken = createCallbackToken(secret, decoded.sub, decoded.aud);
      var callbackDomain = process.env.AUTH0_DOMAIN || request.webtaskContext.data.auth0_domain;
      res.writeHead(301, {Location: 'https://' + callbackDomain + '/continue?id_token=' + callbackToken});
      res.end();
    });
  });
}

function createCallbackToken(secret, sub, aud) {
  var payload = {
    sub: sub,
    aud: aud,
  };

  var options = {
    expiresIn: '5m',
    issuer: 'urn:sgmeyer:slack:mfa'
  };

  return jwt.sign(payload, secret, options);
}

function completeMfaEnrollment(options) {
  return request({ method: 'PATCH',
    url: 'https://' + options.apiDomain + '/api/v2/users/' + options.userId,
    headers: {
      'cache-control': 'no-cache',
      'authorization': 'Bearer ' + options.apiToken,
      'content-type': 'application/json' },
    body: { user_metadata: { slack_mfa_enrolled: true }  },
    json: true });
}

router.get('/verify', getVerify);

module.exports = router;
